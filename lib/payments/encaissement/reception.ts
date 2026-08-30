import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { LigneDejaEncaisseeError } from "@/lib/domain/orders";
import { journal } from "@/lib/observabilite/journal";
import type { FaitPaiement } from "@/lib/payments/encaissement/pilotes";
import {
  abandonnerVente,
  finaliserVente,
} from "@/lib/payments/encaissement/reglement";

/**
 * Appliquer à une commande ce qu'un opérateur affirme.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TROIS CHOSES QU'UN OPÉRATEUR FAIT, ET DONT IL NE PRÉVIENT PAS
 *
 * **Il rejoue.** Le même succès arrive deux, cinq, douze fois — sur incident
 * réseau, sur dépassement de délai, parfois des heures plus tard. Deux
 * protections se superposent ici : la clé unique sur l'événement, et la
 * condition d'état dans le `WHERE` de l'encaissement. La première suffit
 * presque toujours ; la seconde tient quand l'opérateur change d'identifiant
 * d'événement entre deux rejeux, ce qui arrive.
 *
 * **Il annonce des montants.** Il faut les confronter aux nôtres. Un rappel
 * qui dit « payé 100 F » sur une ressource à 5 000 F n'est pas une erreur
 * d'arrondi : c'est soit un rappel forgé, soit une transaction qui n'est pas la
 * nôtre. Dans les deux cas on ne crédite rien.
 *
 * **Il se dédit.** Un « échoué » peut arriver après un « réussi ». On ne
 * défait pas un encaissement sur cette base — un renversement est un litige, il
 * passe par `lib/domain/litiges.ts`, où il laisse une écriture inverse au lieu
 * d'effacer la première.
 */

export type Effet =
  /** La vente est passée : vendeur crédité, reçu déposé. */
  | "ENCAISSE"
  /** L'acheteur n'a pas payé : commande refermée, rien crédité. */
  | "ABANDONNE"
  /** Authentique et sans effet : rejeu, ou étape intermédiaire. */
  | "SANS_EFFET";

export type Reception =
  | { recu: true; effet: Effet }
  | {
      recu: false;
      motif:
        | "COMMANDE_INTROUVABLE"
        | "MONTANT_DISCORDANT"
        | "DEVISE_DISCORDANTE";
      detail: string;
    };

/**
 * Enregistre l'appel, puis agit.
 *
 * L'enregistrement passe **avant** le traitement, et c'est volontaire : si le
 * traitement casse au milieu, la ligne reste avec son erreur et se voit à
 * l'écran Système. L'ordre inverse perdrait la trace de l'appel qui a fait
 * tomber le service — précisément celui qu'on cherche.
 */
export async function recevoir(
  fournisseur: string,
  fait: FaitPaiement,
  corps: unknown,
): Promise<Reception | { recu: false; motif: "REJEU"; detail: string }> {
  let evenementId: string;

  try {
    const trace = await db.paymentWebhookEvent.create({
      data: {
        provider: fournisseur,
        eventRef: fait.evenement,
        providerRef: fait.referenceOperateur,
        payload: corps as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    evenementId = trace.id;
  } catch (cause) {
    // P2002 : cet événement est déjà passé. C'est le cas nominal d'un rejeu,
    // pas une anomalie — on ne journalise donc pas en avertissement.
    if (
      cause instanceof Prisma.PrismaClientKnownRequestError &&
      cause.code === "P2002"
    ) {
      return { recu: false, motif: "REJEU", detail: fait.evenement };
    }
    throw cause;
  }

  const suite = await appliquer(fait);

  await db.paymentWebhookEvent.update({
    where: { id: evenementId },
    data: suite.recu
      ? {
          status: suite.effet === "SANS_EFFET" ? "IGNORED" : "PROCESSED",
          processedAt: new Date(),
        }
      : { status: "REJECTED", error: suite.detail, processedAt: new Date() },
  });

  return suite;
}

async function appliquer(fait: FaitPaiement): Promise<Reception> {
  // Notre référence est l'identifiant de la commande : c'est ce qu'on a envoyé
  // à l'ouverture, et c'est ce que l'opérateur nous rend.
  const commande = await db.order.findUnique({
    where: { id: fait.reference },
    select: {
      id: true,
      total: true,
      currency: true,
      items: { select: { id: true, state: true } },
    },
  });

  if (!commande || commande.items.length === 0) {
    return {
      recu: false,
      motif: "COMMANDE_INTROUVABLE",
      detail: `Aucune commande pour la référence ${fait.reference}.`,
    };
  }

  // Une étape intermédiaire — « l'invite est partie sur le téléphone » — ne
  // décide de rien. On la garde en trace et on attend la suite.
  if (fait.issue === "EN_COURS") {
    return { recu: true, effet: "SANS_EFFET" };
  }

  const ligneId = commande.items[0]!.id;

  if (fait.issue === "ECHOUE") {
    const referme = await abandonnerVente(ligneId);
    return { recu: true, effet: referme ? "ABANDONNE" : "SANS_EFFET" };
  }

  // ── Succès annoncé : on confronte avant de créditer ────────────────────────
  if (fait.montant !== null && fait.montant !== commande.total) {
    // Ne rien créditer, et le dire fort. Un écart de montant est soit un
    // rappel forgé, soit la transaction de quelqu'un d'autre — jamais une
    // broutille à arrondir.
    journal.erreur("rappel de paiement au montant discordant", {
      commande: commande.id,
      attendu: commande.total,
      annonce: fait.montant,
    });
    return {
      recu: false,
      motif: "MONTANT_DISCORDANT",
      detail: `Attendu ${commande.total}, annoncé ${fait.montant}.`,
    };
  }

  if (fait.devise !== null && fait.devise !== commande.currency) {
    journal.erreur("rappel de paiement dans une autre devise", {
      commande: commande.id,
      attendue: commande.currency,
      annoncee: fait.devise,
    });
    return {
      recu: false,
      motif: "DEVISE_DISCORDANTE",
      detail: `Attendu ${commande.currency}, annoncé ${fait.devise}.`,
    };
  }

  await db.order.update({
    where: { id: commande.id },
    data: { providerRef: fait.referenceOperateur },
  });

  try {
    await finaliserVente(ligneId);
    return { recu: true, effet: "ENCAISSE" };
  } catch (cause) {
    // La ligne n'était plus `IN_PROGRESS` : un autre rappel est passé avant.
    // La garde vit dans le `WHERE` de l'encaissement, donc un seul des deux a
    // pu créditer ; celui-ci n'a rien fait, et c'est exactement ce qu'on veut.
    if (cause instanceof LigneDejaEncaisseeError) {
      return { recu: true, effet: "SANS_EFFET" };
    }
    throw cause;
  }
}
