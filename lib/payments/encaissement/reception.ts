import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { LigneDejaEncaisseeError } from "@/lib/domain/orders";
import { journal } from "@/lib/observabilite/journal";
import {
  TransitionInterditeError,
  VersementIntrouvableError,
  confirmerVersement,
  echouerVersement,
  retournerVersement,
} from "@/lib/payments/versements";
import {
  piloteNomme,
  type FaitPaiement,
} from "@/lib/payments/encaissement/pilotes";
import {
  abandonnerVente,
  finaliserVente,
} from "@/lib/payments/encaissement/reglement";
import {
  abandonnerRenouvellement,
  finaliserRenouvellement,
} from "@/lib/abonnements/reglement";
import { paiementDeReference } from "@/lib/abonnements/renouvellement";

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
  /** Le virement est arrivé chez le créateur. */
  | "VERSE"
  /** Le virement n'est pas parti, ou est revenu. Les soldes sont rendus. */
  | "VERSEMENT_ECHOUE"
  /** Un abonnement est renouvelé : cycle avancé, accès rouvert, reçu déposé. */
  | "RENOUVELE"
  /** Le renouvellement n'a pas été payé : le cycle n'a pas bougé. */
  | "RENOUVELLEMENT_ECHOUE"
  /** Authentique et sans effet : rejeu, ou étape intermédiaire. */
  | "SANS_EFFET";

export type Reception =
  | { recu: true; effet: Effet }
  | {
      recu: false;
      motif:
        | "COMMANDE_INTROUVABLE"
        /** La référence annonçait un renouvellement qui n'existe pas. */
        | "ABONNEMENT_INTROUVABLE"
        | "VERSEMENT_INTROUVABLE"
        | "TRANSITION_REFUSEE"
        | "MONTANT_DISCORDANT"
        | "DEVISE_DISCORDANTE"
        /** L'opérateur, interrogé, ne reconnaît pas la transaction annoncée. */
        | "NON_CONFIRME"
        /** Un paiement est arrivé sur une commande déjà refermée. Grave. */
        | "COMMANDE_REFERMEE";
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
    if (
      !(cause instanceof Prisma.PrismaClientKnownRequestError) ||
      cause.code !== "P2002"
    ) {
      throw cause;
    }

    // ────────────────────────────────────────────────────────────────────────
    // TOUT DOUBLON N'EST PAS UN REJEU
    //
    // La ligne existe, donc cet événement est déjà arrivé. Mais est-il déjà
    // *traité* ? Si un passage précédent est mort entre l'enregistrement et la
    // décision — un déploiement au mauvais moment, une base qui coupe —, la
    // ligne est restée en RECEIVED. Répondre « rejeu » à la nouvelle tentative
    // de l'opérateur enterrerait la commande pour de bon : il ne rejouera pas
    // indéfiniment, et personne ne serait jamais crédité.
    //
    // On reprend donc là où le passage mort s'est arrêté. Deux reprises
    // simultanées ne font pas de dégât : la garde d'encaissement vit dans le
    // `WHERE` de l'écriture, une seule crédite.
    const existante = await db.paymentWebhookEvent.findUnique({
      where: {
        provider_eventRef: { provider: fournisseur, eventRef: fait.evenement },
      },
      select: { id: true, status: true },
    });

    if (!existante || existante.status !== "RECEIVED") {
      return { recu: false, motif: "REJEU", detail: fait.evenement };
    }

    journal.avertissement("reprise d'un rappel resté sans décision", {
      fournisseur,
      evenement: fait.evenement,
    });
    evenementId = existante.id;
  }

  const suite =
    fait.sens === "VERSEMENT"
      ? await appliquerVersement(fait)
      : await appliquer(fournisseur, fait);

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

/**
 * Un rappel qui parle d'un virement sortant.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE N'EST PAS SYMÉTRIQUE DE L'ENCAISSEMENT
 *
 * À l'encaissement, on attend la confirmation avant de créditer : tant que
 * l'opérateur n'a rien dit, personne n'a rien touché.
 *
 * Au versement, l'argent est **déjà parti** quand le rappel arrive. On ne
 * décide plus s'il faut agir : on enregistre ce qui s'est passé. Un échec ou
 * un retour rend les soldes au créateur, pour qu'ils repartent au cycle
 * suivant — c'est la machine à huit états qui s'en charge, et elle a ses
 * propres gardes.
 *
 * On ne confronte pas les montants ici. Le montant du virement, c'est nous qui
 * l'avons fixé en l'ordonnant ; l'opérateur ne fait que le répéter. Le
 * confronter n'ajouterait qu'un motif de refus sur un ordre déjà exécuté.
 */
async function appliquerVersement(fait: FaitPaiement): Promise<Reception> {
  // Notre référence est l'identifiant du versement, celui qu'on a envoyé en
  // ordonnant le virement.
  const versement = await db.payout.findUnique({
    where: { id: fait.reference },
    select: { id: true, status: true },
  });

  if (!versement) {
    return {
      recu: false,
      motif: "VERSEMENT_INTROUVABLE",
      detail: `Aucun versement pour la référence ${fait.reference}.`,
    };
  }

  if (fait.issue === "EN_COURS") return { recu: true, effet: "SANS_EFFET" };

  const reference = fait.referenceOperateur ?? "sans référence";

  try {
    if (fait.issue === "REUSSI") {
      await confirmerVersement(versement.id);
      return { recu: true, effet: "VERSE" };
    }

    if (fait.issue === "RETOURNE") {
      // ──────────────────────────────────────────────────────────────────────
      // « RETOURNÉ » NE VEUT PAS DIRE LA MÊME CHOSE PARTOUT
      //
      // Notre machine réserve `RETURNED` aux versements dont l'argent est
      // arrivé quelque part avant de revenir — d'où `COMPLETED` et `UNCLAIMED`
      // pour seuls départs. Un versement encore `PROCESSING` n'a rien atteint :
      // le renversement annoncé par l'opérateur est, de notre point de vue, un
      // échec d'acheminement.
      //
      // On ne force donc pas une transition que la machine refuse. On enregistre
      // l'échec, et le motif dit explicitement qu'il s'agit d'un renversement —
      // l'information que l'exploitant cherchera est là, dans un mot plutôt que
      // dans un état.
      if (versement.status === "COMPLETED" || versement.status === "UNCLAIMED") {
        await retournerVersement(
          versement.id,
          `Renversé par l'opérateur (${reference}).`,
        );
      } else {
        await echouerVersement(
          versement.id,
          `Renversé par l'opérateur avant d'arriver (${reference}).`,
        );
      }
      return { recu: true, effet: "VERSEMENT_ECHOUE" };
    }

    await echouerVersement(
      versement.id,
      `Refusé par l'opérateur (${reference}).`,
    );
    return { recu: true, effet: "VERSEMENT_ECHOUE" };
  } catch (cause) {
    // La machine refuse la transition : le versement était déjà dans cet état,
    // ou dans un état d'où l'on ne va pas là. Un rejeu, presque toujours.
    if (cause instanceof TransitionInterditeError) {
      return { recu: true, effet: "SANS_EFFET" };
    }
    if (cause instanceof VersementIntrouvableError) {
      return {
        recu: false,
        motif: "VERSEMENT_INTROUVABLE",
        detail: `Versement ${fait.reference} disparu en cours de traitement.`,
      };
    }
    throw cause;
  }
}

async function appliquer(
  fournisseur: string,
  fait: FaitPaiement,
): Promise<Reception> {
  // ───────────────────────────────────────────────────────────────────
  // UN ACHAT ET UN RENOUVELLEMENT ARRIVENT PAR LE MÊME ÉVÉNEMENT
  //
  // Les deux sont un `charge.success` : rien dans le rappel ne les sépare.
  // Le seul discriminant est NOTRE référence, celle qu'on a envoyée à
  // l'ouverture — un cuid nu pour une commande, `abo-<id>` pour un abonnement.
  //
  // Sans cet aiguillage, un renouvellement payé serait cherché parmi les
  // commandes, n'y serait pas, et refusé comme « commande introuvable » :
  // l'abonné aurait payé et son accès serait coupé le lendemain.
  const paiementAbonnement = paiementDeReference(fait.reference);
  if (paiementAbonnement !== null) {
    return appliquerRenouvellement(fournisseur, fait, paiementAbonnement);
  }

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
  //
  // ──────────────────────────────────────────────────────────────────────────
  // ON REFUSE LE MANQUE, PAS LE SURPLUS
  //
  // Le seul écart qui nous coûte est celui **par le bas** : quelqu'un paie cent
  // francs pour une ressource à cinq mille, et repart avec. Celui-là est refusé
  // sans discussion.
  //
  // Un montant SUPÉRIEUR au total n'est pas une attaque — c'est un arrondi
  // d'opérateur, des frais absorbés, ou une devise reconvertie. Le refuser
  // fabriquerait le pire cas possible : l'acheteur a payé plus que demandé et
  // ne reçoit rien. On livre, et on le journalise pour que quelqu'un regarde.
  //
  // C'est la règle du plugin officiel de Paystack, et elle est meilleure que
  // celle qu'on avait.
  if (fait.montant !== null && fait.montant < commande.total) {
    journal.erreur("rappel de paiement au montant insuffisant", {
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

  if (fait.montant !== null && fait.montant > commande.total) {
    // Livré quand même. La ligne existe pour qu'on puisse rendre la
    // différence, pas pour bloquer la vente.
    journal.avertissement("paiement supérieur au total, livré quand même", {
      commande: commande.id,
      attendu: commande.total,
      annonce: fait.montant,
    });
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

  // ── On demande à l'opérateur, plutôt que de le croire ─────────────────────
  //
  // La signature prouve que le message vient de lui — tant que le secret n'a
  // pas fui. Un secret dérobé permet de forger un rappel signé annonçant un
  // paiement qui n'a jamais eu lieu. Interroger son serveur ferme cette porte :
  // personne ne peut lui faire dire qu'une transaction existe.
  const pilote = piloteNomme(fournisseur);
  if (pilote?.confirmer) {
    const verdict = await pilote.confirmer(fait.reference);

    if (!verdict.confirme) {
      journal.erreur("l'opérateur ne confirme pas le paiement annoncé", {
        commande: commande.id,
        fournisseur,
      });
      return {
        recu: false,
        motif: "NON_CONFIRME",
        detail: "L'opérateur ne confirme pas cette transaction.",
      };
    }

    // Et on reconfronte sur SA valeur, pas sur celle du corps reçu.
    if (verdict.montant !== null && verdict.montant !== commande.total) {
      journal.erreur("montant confirmé différent du nôtre", {
        commande: commande.id,
        attendu: commande.total,
        confirme: verdict.montant,
      });
      return {
        recu: false,
        motif: "MONTANT_DISCORDANT",
        detail: `Attendu ${commande.total}, confirmé ${verdict.montant}.`,
      };
    }
  }

  await db.order.update({
    where: { id: commande.id },
    data: { providerRef: fait.referenceOperateur },
  });

  try {
    await finaliserVente(ligneId);
    return { recu: true, effet: "ENCAISSE" };
  } catch (cause) {
    if (!(cause instanceof LigneDejaEncaisseeError)) throw cause;

    // ────────────────────────────────────────────────────────────────────────
    // DEUX SITUATIONS TRÈS DIFFÉRENTES, ET LE MÊME SYMPTÔME
    //
    // La ligne n'est plus `IN_PROGRESS`. Si elle est déjà encaissée, un autre
    // rappel est simplement passé avant : la garde a fait son travail, celui-ci
    // n'a rien à faire, tout va bien.
    //
    // Mais si elle est ÉCHOUÉE, un succès vient d'arriver sur une commande
    // qu'on avait refermée — parce qu'elle avait dépassé sa péremption, ou
    // qu'un rappel d'échec l'avait précédé. Alors quelqu'un a payé et ne
    // recevra rien. Aucun code ne peut réparer cela tout seul : il faut un
    // humain, et il faut donc qu'il le voie.
    const etat = await db.orderItem.findUnique({
      where: { id: ligneId },
      select: { state: true },
    });

    if (etat?.state === "FAILED") {
      journal.erreur("PAIEMENT REÇU SUR UNE COMMANDE REFERMÉE", {
        commande: commande.id,
        ligne: ligneId,
        remede:
          "L'acheteur a payé et n'a rien reçu. Rembourser, ou rendre l'accès à la main.",
      });
      return {
        recu: false,
        motif: "COMMANDE_REFERMEE",
        detail:
          "Succès annoncé sur une commande déjà refermée : l'acheteur a payé sans rien recevoir.",
      };
    }

    return { recu: true, effet: "SANS_EFFET" };
  }
}

/**
 * Un rappel qui parle d'un renouvellement d'abonnement.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LES MÊMES GARDES QU'UNE VENTE, ET POUR LES MÊMES RAISONS
 *
 * L'opérateur rejoue, annonce des montants, et se dédit. On confronte donc
 * avant d'avancer quoi que ce soit, et on lui demande confirmation plutôt que
 * de le croire sur signature — un secret dérobé permettrait sinon d'offrir un
 * mois d'abonnement à qui sait forger un rappel.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QUI DIFFÈRE : IL N'Y A PERSONNE À CRÉDITER
 *
 * Une vente crédite le solde d'un vendeur, et un paiement arrivé sur une
 * commande refermée laisse un acheteur sans rien. Ici, l'argent est celui de la
 * plateforme et le « produit » est du temps : un paiement arrivé en retard sur
 * un abonnement déjà suspendu se règle tout seul, parce que `cycleSuivant`
 * repart du jour du paiement quand l'accès était éteint.
 *
 * C'est pourquoi il n'y a pas d'équivalent de « PAIEMENT REÇU SUR UNE COMMANDE
 * REFERMÉE » ici : le cas existe, et il n'est pas grave.
 */
async function appliquerRenouvellement(
  fournisseur: string,
  fait: FaitPaiement,
  paiementId: string,
): Promise<Reception> {
  const paiement = await db.subscriptionPayment.findUnique({
    where: { id: paiementId },
    select: { id: true, status: true, amount: true, currency: true },
  });

  if (!paiement) {
    return {
      recu: false,
      motif: "ABONNEMENT_INTROUVABLE",
      detail: `Aucun paiement d'abonnement pour la référence ${fait.reference}.`,
    };
  }

  // Une étape intermédiaire — « l'invite est partie sur le téléphone » — ne
  // décide de rien.
  if (fait.issue === "EN_COURS") return { recu: true, effet: "SANS_EFFET" };

  if (fait.issue === "ECHOUE" || fait.issue === "RETOURNE") {
    const referme = await abandonnerRenouvellement(
      paiement.id,
      `Refusé par l'opérateur (${fait.referenceOperateur ?? "sans référence"}).`,
    );
    return {
      recu: true,
      effet: referme ? "RENOUVELLEMENT_ECHOUE" : "SANS_EFFET",
    };
  }

  // ── Succès annoncé : on confronte avant d'avancer le cycle ────────────────
  //
  // Même règle qu'à la vente : on refuse le manque, pas le surplus. Quelqu'un
  // qui paierait cent francs pour un mois à deux mille est refusé ; un montant
  // supérieur est un arrondi d'opérateur ou des frais absorbés, et refuser
  // fabriquerait le pire cas — l'abonné a payé plus que demandé et son accès
  // est coupé.
  if (fait.montant !== null && fait.montant < paiement.amount) {
    journal.erreur("renouvellement au montant insuffisant", {
      paiement: paiement.id,
      attendu: paiement.amount,
      annonce: fait.montant,
    });
    return {
      recu: false,
      motif: "MONTANT_DISCORDANT",
      detail: `Attendu ${paiement.amount}, annoncé ${fait.montant}.`,
    };
  }

  if (fait.montant !== null && fait.montant > paiement.amount) {
    journal.avertissement("renouvellement supérieur au montant, accepté", {
      paiement: paiement.id,
      attendu: paiement.amount,
      annonce: fait.montant,
    });
  }

  if (fait.devise !== null && fait.devise !== paiement.currency) {
    journal.erreur("renouvellement dans une autre devise", {
      paiement: paiement.id,
      attendue: paiement.currency,
      annoncee: fait.devise,
    });
    return {
      recu: false,
      motif: "DEVISE_DISCORDANTE",
      detail: `Attendu ${paiement.currency}, annoncé ${fait.devise}.`,
    };
  }

  // On demande à l'opérateur plutôt que de le croire. La signature prouve
  // l'origine tant que le secret n'a pas fui ; l'interroger ferme la porte que
  // laisserait un secret dérobé.
  const pilote = piloteNomme(fournisseur);
  if (pilote?.confirmer) {
    const verdict = await pilote.confirmer(fait.reference);

    if (!verdict.confirme) {
      journal.erreur("l'opérateur ne confirme pas le renouvellement annoncé", {
        paiement: paiement.id,
        fournisseur,
      });
      return {
        recu: false,
        motif: "NON_CONFIRME",
        detail: "L'opérateur ne confirme pas cette transaction.",
      };
    }

    if (verdict.montant !== null && verdict.montant !== paiement.amount) {
      journal.erreur("montant de renouvellement confirmé différent du nôtre", {
        paiement: paiement.id,
        attendu: paiement.amount,
        confirme: verdict.montant,
      });
      return {
        recu: false,
        motif: "MONTANT_DISCORDANT",
        detail: `Attendu ${paiement.amount}, confirmé ${verdict.montant}.`,
      };
    }
  }

  // La référence de l'opérateur est écrite AVANT le règlement : c'est elle qui
  // permet de retrouver la transaction, et un règlement qui casse au milieu ne
  // doit pas laisser un paiement encaissé sans trace de où le chercher.
  await db.subscriptionPayment.update({
    where: { id: paiement.id },
    data: { providerRef: fait.referenceOperateur },
  });

  const suite = await finaliserRenouvellement(paiement.id);

  if (!suite.fait) {
    // « Déjà réglé » est le résultat normal d'un rejeu : la garde a fait son
    // travail. « Introuvable » ne peut plus arriver ici — on vient de le lire.
    return { recu: true, effet: "SANS_EFFET" };
  }

  return { recu: true, effet: "RENOUVELE" };
}
