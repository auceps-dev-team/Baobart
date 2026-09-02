import "server-only";

import { urlDuSite } from "@/lib/config/site";
import { db } from "@/lib/db";
import { deposer } from "@/lib/email/outbox";
import { formatMoney, type Currency } from "@/lib/i18n/money";
import { journal } from "@/lib/observabilite/journal";
import { cycleSuivant, type Cadence, type Cycle } from "@/lib/ndank/cycle";
import { cycleDe } from "@/lib/ndank/baobart";
import { appareilsDe, envoyerA } from "@/lib/push/abonnements";

/**
 * Ce qui se passe quand l'argent d'un renouvellement est vraiment arrivé.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX CHEMINS, UNE SEULE FIN
 *
 * Un renouvellement aboutit soit par la simulation de développement, soit par
 * le rappel d'un opérateur. Ce qui doit alors se produire est identique :
 * avancer le cycle, rouvrir l'accès, déposer le reçu. Écrire cette suite deux
 * fois garantissait qu'un jour l'une des deux oublierait le reçu — ou pire, le
 * cycle, et l'abonné serait relancé le lendemain de son paiement.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA GARDE EST DANS LE `WHERE`, PAS AVANT
 *
 * Un opérateur rejoue. Deux rappels concurrents liraient tous deux `PENDING` ;
 * seul l'un obtiendra la transition, parce que la condition d'état voyage dans
 * l'écriture elle-même. L'autre repart sans rien faire.
 *
 * C'est ce qui empêche un rejeu d'avancer le cycle une seconde fois — un abonné
 * qui gagnerait deux mois pour un paiement, et personne pour s'en apercevoir.
 */

/** Ce qu'un règlement a produit. */
export type Suite =
  /** Le cycle a été avancé, le reçu déposé. */
  | { fait: true; cycle: Cycle }
  /** Déjà réglé, ou déjà refermé : un rejeu. Rien à faire, rien de cassé. */
  | { fait: false; motif: "DEJA_REGLE" }
  | { fait: false; motif: "INTROUVABLE" };

/**
 * Avance le cycle, rouvre l'accès, dépose le reçu.
 *
 * Le nouveau cycle s'enchaîne sur **l'échéance** et non sur la date du
 * paiement — sauf si l'accès était déjà éteint, auquel cas il repart du jour
 * même. Toute cette règle vit dans `cycleSuivant`, où elle s'éprouve sans base.
 */
export async function finaliserRenouvellement(
  paiementId: string,
  maintenant: Date = new Date(),
): Promise<Suite> {
  const paiement = await db.subscriptionPayment.findUnique({
    where: { id: paiementId },
    select: {
      id: true,
      status: true,
      amount: true,
      currency: true,
      provider: true,
      providerRef: true,
      subscription: {
        select: {
          id: true,
          userId: true,
          cadence: true,
          cycleStart: true,
          cycleEnd: true,
          plan: { select: { name: true } },
        },
      },
    },
  });

  if (!paiement) return { fait: false, motif: "INTROUVABLE" };
  if (paiement.status !== "PENDING") return { fait: false, motif: "DEJA_REGLE" };

  const abonnement = paiement.subscription;

  // Le cycle courant est reconstruit depuis les deux dates rangées : la grâce
  // et la fenêtre de reprise se déduisent des réglages plutôt que d'être
  // stockées. Voir `cycleDe`.
  const courant = cycleDe(abonnement.cycleStart, abonnement.cycleEnd);
  const suivant = cycleSuivant(
    courant,
    maintenant,
    abonnement.cadence as Cadence,
  );

  const regle = await db.$transaction(async (tx) => {
    // TOUTE la garde est ici. Deux rappels concurrents lisent `PENDING`
    // au-dessus ; un seul obtient cette transition, et lui seul avance le
    // cycle.
    const transition = await tx.subscriptionPayment.updateMany({
      where: { id: paiement.id, status: "PENDING" },
      data: { status: "PAID", paidAt: maintenant },
    });

    if (transition.count !== 1) return false;

    await tx.subscription.update({
      where: { id: abonnement.id },
      data: {
        cycleStart: suivant.debut,
        cycleEnd: suivant.echeance,
        status: "ACTIVE",
        // Payer annule une résiliation demandée. C'est ce que veut dire un
        // paiement volontaire, et c'est cohérent avec nos relances : Ndank
        // écrit aux PENDING_CANCELLATION tant qu'il leur reste de l'accès.
        cancelledAt: null,
        // Par où l'argent est passé, pour retrouver la transaction en cas de
        // litige. Écrit au règlement et non à l'ouverture : une tentative
        // abandonnée ne doit pas laisser croire que cet opérateur a encaissé.
        paymentProvider: paiement.provider,
        providerRef: paiement.providerRef ?? undefined,
      },
    });

    const abonne = await tx.user.findUniqueOrThrow({
      where: { id: abonnement.userId },
      select: { email: true, profile: { select: { displayName: true } } },
    });

    const base = urlDuSite();

    await deposer(
      {
        // La même clé quel que soit le chemin : un rejeu ne peut pas produire
        // un second reçu, même s'il vient d'un autre événement.
        cle: `abo-recu-${paiement.id}`,
        destinataire: abonne.email,
        modele: "RECU_ABONNEMENT",
        charge: {
          nom: abonne.profile?.displayName ?? abonne.email,
          offre: abonnement.plan.name,
          montant: formatMoney(paiement.amount, paiement.currency as Currency),
          prochaine: dateLisible(suivant.echeance),
          lien: base ? `${base}/dashboard/forfait` : undefined,
        },
      },
      tx,
    );

    return true;
  });

  if (!regle) return { fait: false, motif: "DEJA_REGLE" };

  // ───────────────────────────────────────────────────────────────────────
  // LA CONFIRMATION, PARCE QU'ON L'A PROMISE
  //
  // L'écran de réglage annonce trois choses à qui active les notifications :
  // la relance, le rappel de la veille, et la confirmation. Les deux premières
  // partent du moteur Ndank ; celle-ci n'existerait pas sans ces lignes, et
  // l'écran promettrait ce qui n'arrive jamais.
  //
  // HORS de la transaction, et sans jamais lever : un service de poussée
  // injoignable ne doit pas défaire un renouvellement déjà payé. Le paiement
  // est acquis, la notification est un confort.
  try {
    const appareils = await appareilsDe(abonnement.userId);
    if (appareils.length > 0) {
      await envoyerA(appareils, {
        titre: `${abonnement.plan.name} — c'est renouvelé`,
        corps: `Prochaine échéance : ${dateLisible(suivant.echeance)}.`,
        lien: "/dashboard/forfait",
        // Pas d'étiquette : une confirmation ne doit remplacer aucune relance.
        // Les regrouper effacerait le seul message que l'abonné voulait voir.
      });
    }
  } catch (cause) {
    journal.avertissement("confirmation de renouvellement non poussée", {
      paiement: paiement.id,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
  }

  return { fait: true, cycle: suivant };
}

/**
 * Le renouvellement n'a pas eu lieu.
 *
 * On ne touche PAS au cycle : il n'a jamais avancé. La ligne reste en base —
 * une tentative abandonnée est une information, c'est elle qui dit qu'un rail
 * échoue trop souvent.
 */
export async function abandonnerRenouvellement(
  paiementId: string,
  motif: string,
): Promise<boolean> {
  // La condition est dans le `WHERE` : un paiement déjà réglé ne doit pas
  // pouvoir être renversé par un rappel tardif annonçant un échec.
  const transition = await db.subscriptionPayment.updateMany({
    where: { id: paiementId, status: "PENDING" },
    data: { status: "FAILED", failedAt: new Date(), failureReason: motif },
  });

  return transition.count === 1;
}

/**
 * Au-delà, un paiement ouvert n'attend plus personne.
 *
 * Même durée qu'une commande, et pour la même raison : l'invite mobile money
 * part sur un téléphone qui peut être hors réseau, et les opérateurs rappellent
 * parfois des heures après un incident chez eux. Fermer trop tôt fabriquerait
 * le pire cas — un abonné qui a payé, et un paiement qu'on a refermé avant de
 * le savoir.
 */
export const PEREMPTION_MS = 24 * 3_600_000;

/**
 * Referme les paiements qu'aucun rappel n'est venu conclure.
 *
 * Sans ce ménage, une tentative abandonnée reste `PENDING` à jamais et fausse
 * le compteur des paiements en attente — qui finit par ne plus rien signaler.
 */
export async function perimerPaiementsOublies(
  maintenant: Date = new Date(),
): Promise<number> {
  const limite = new Date(maintenant.getTime() - PEREMPTION_MS);

  const oublies = await db.subscriptionPayment.findMany({
    where: { status: "PENDING", createdAt: { lt: limite } },
    select: { id: true },
    take: 500,
  });

  let fermes = 0;
  for (const p of oublies) {
    if (await abandonnerRenouvellement(p.id, "Aucune réponse de l'opérateur.")) {
      fermes += 1;
    }
  }

  if (fermes > 0) {
    journal.info("paiements d'abonnement oubliés refermés", { fermes });
  }

  return fermes;
}

/**
 * Une date qu'un abonné lit sans effort.
 *
 * Pas d'ISO dans un courriel : « 2026-10-02 » se déchiffre, « 2 octobre 2026 »
 * se lit. Et la prochaine échéance est l'information principale du reçu.
 */
function dateLisible(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
