import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";
import {
  reponseTropDeGestes,
  verifierLimiteHttp,
} from "@/lib/securite/garde";
import { recevoir } from "@/lib/payments/encaissement/reception";
import { piloteNomme } from "@/lib/payments/encaissement/pilotes";

/**
 * Le rappel d'un opérateur de paiement.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QU'EST CETTE ROUTE
 *
 * Le seul endroit où un inconnu peut faire créditer un compte. Tout ce qui
 * suit découle de là.
 *
 * **Le corps est lu brut.** Une signature porte sur les octets reçus. Décoder
 * puis ré-encoder change les espaces, l'ordre des clés et l'échappement des
 * accents : la signature ne correspondrait plus, et on finirait par la
 * désactiver « parce qu'elle ne marche pas ».
 *
 * **Rien n'est cru avant d'être authentifié.** Ni la référence, ni le montant,
 * ni même le fait qu'il s'agisse d'un paiement.
 *
 * **On répond 200 à presque tout.** Un opérateur qui reçoit une erreur rejoue,
 * et rejoue encore, parfois des jours. Le 200 signifie « reçu et classé », pas
 * « d'accord ». Les seules exceptions sont celles où l'opérateur peut corriger
 * quelque chose : signature invalide (401) et corps illisible (400) — deux
 * pannes de configuration qu'il faut lui faire remonter, pas absorber en
 * silence.
 */

export const dynamic = "force-dynamic";

/** Un rappel d'opérateur tient dans quelques kilo-octets. Au-delà, on refuse. */
const TAILLE_MAX = 64 * 1024;

/**
 * Au-delà, on cesse de tracer les refus pour cette heure.
 *
 * Cinquante lignes suffisent largement à diagnostiquer un secret décalé. Ce
 * qu'on achète avec ce plafond, c'est la certitude qu'un inconnu ne peut pas
 * faire grossir la table indéfiniment depuis une route publique.
 */
const REFUS_TRACES_MAX = 50;
const HEURE_MS = 3_600_000;

/**
 * Garde une trace d'un appel qu'on n'a pas voulu.
 *
 * La référence est l'empreinte du corps, faute de pouvoir croire ce qu'il
 * contient. Un même corps rejoué mille fois n'écrit donc qu'une ligne.
 *
 * Cela ne suffit pas : rien n'empêche d'envoyer mille corps DIFFÉRENTS, et
 * chacun réclamerait sa ligne. D'où le plafond horaire. On perd le compte
 * exact des refus au-delà — mais ce compte-là n'apprend plus rien : la
 * cinquantième ligne dit déjà tout ce que dira la millième.
 */
async function tracerRefus(
  fournisseur: string,
  corps: string,
  raison: string,
): Promise<void> {
  const empreinte = createHash("sha256").update(corps, "utf8").digest("hex");

  const dejaTraces = await db.paymentWebhookEvent.count({
    where: {
      provider: fournisseur,
      status: "REJECTED",
      receivedAt: { gte: new Date(Date.now() - HEURE_MS) },
    },
  });

  if (dejaTraces >= REFUS_TRACES_MAX) {
    journal.avertissement("plafond de traces de refus atteint", {
      fournisseur,
      raison,
    });
    return;
  }

  try {
    await db.paymentWebhookEvent.create({
      data: {
        provider: fournisseur,
        eventRef: `refus-${empreinte}`,
        // Le corps est conservé tel quel : c'est lui qui dira, le jour où on
        // le regardera, si le secret a été tourné ou si quelqu'un tâtonne.
        payload: { brut: corps.slice(0, 4000) } as Prisma.InputJsonValue,
        status: "REJECTED",
        error: raison,
        processedAt: new Date(),
      },
    });
  } catch (cause) {
    // P2002 : le même corps refusé est déjà tracé. Rien à ajouter.
    if (
      cause instanceof Prisma.PrismaClientKnownRequestError &&
      cause.code === "P2002"
    ) {
      return;
    }
    throw cause;
  }
}

export async function POST(
  requete: Request,
  { params }: { params: Promise<{ fournisseur: string }> },
) {
  const { fournisseur } = await params;

  // ── La borne, avant tout le reste ─────────────────────────────────────────
  //
  // Large à dessein : un opérateur qui rattrape un incident envoie des
  // centaines de rappels d'un coup, et les refuser coûterait des ventes. Elle
  // existe pour l'inconnu qui frappe la route sans signature — celui-là paie
  // une vérification de signature et deux requêtes en base à chaque essai.
  const borne = await verifierLimiteHttp("rappelPaiement", requete);
  if (!borne.autorise) return reponseTropDeGestes(borne);

  const pilote = piloteNomme(fournisseur);
  if (!pilote || pilote.nom === "aucun") {
    // 404 plutôt que 400 : la liste des opérateurs branchés n'a pas à se
    // découvrir en tâtonnant sur l'URL.
    return NextResponse.json({ erreur: "inconnu" }, { status: 404 });
  }

  if (!pilote.configure()) {
    // Le pilote existe mais son secret manque. Le dire à l'opérateur plutôt
    // que d'accepter sans vérifier : accepter serait pire que refuser.
    journal.erreur("rappel reçu pour un opérateur non configuré", { fournisseur });
    return NextResponse.json({ erreur: "indisponible" }, { status: 503 });
  }

  const declaree = Number(requete.headers.get("content-length") ?? 0);
  if (declaree > TAILLE_MAX) {
    return NextResponse.json({ erreur: "trop long" }, { status: 413 });
  }

  const corps = await requete.text();
  if (corps.length > TAILLE_MAX) {
    return NextResponse.json({ erreur: "trop long" }, { status: 413 });
  }

  if (!pilote.authentifier(corps, requete.headers)) {
    await tracerRefus(fournisseur, corps, "signature invalide");
    journal.avertissement("rappel de paiement à la signature invalide", {
      fournisseur,
    });
    return NextResponse.json({ erreur: "signature" }, { status: 401 });
  }

  const lecture = pilote.lire(corps);

  if (lecture === null) {
    await tracerRefus(fournisseur, corps, "corps illisible");
    return NextResponse.json({ erreur: "corps" }, { status: 400 });
  }

  // Authentique, mais rien à faire ici : un litige, un remboursement, une
  // facture. On accuse réception et on n'écrit rien.
  //
  // Rien du tout, et c'est délibéré : un opérateur envoie beaucoup plus
  // d'événements qu'on n'en traite. En garder une trace remplirait la table
  // d'un bruit permanent, et le plafond horaire des refus finirait par masquer
  // le seul signal qui compte — un secret de signature décalé.
  if (lecture === "HORS_SUJET") {
    return NextResponse.json({ recu: true, effet: "HORS_SUJET" }, { status: 200 });
  }

  const fait = lecture;

  // À partir d'ici l'appel est authentique. Tout ce qui suit se solde par un
  // 200 : l'opérateur a fait son travail, c'est à nous de gérer la suite.
  let suite;
  try {
    suite = await recevoir(fournisseur, fait, JSON.parse(corps));
  } catch (cause) {
    // Une vraie panne de notre côté. Là, le rejeu est souhaitable : on rend
    // 500 pour que l'opérateur revienne quand le service sera debout.
    journal.erreur("traitement d'un rappel de paiement en échec", {
      fournisseur,
      evenement: fait.evenement,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
    return NextResponse.json({ erreur: "interne" }, { status: 500 });
  }

  if (!suite.recu) {
    journal.avertissement("rappel de paiement sans effet", {
      fournisseur,
      motif: suite.motif,
    });
  }

  return NextResponse.json(
    { recu: true, effet: suite.recu ? suite.effet : suite.motif },
    { status: 200 },
  );
}
