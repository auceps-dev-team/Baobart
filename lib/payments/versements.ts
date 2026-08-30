import "server-only";

import type { Currency, PayoutMethod, PayoutStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { deposer } from "@/lib/email/outbox";
import { formatMoney } from "@/lib/i18n/money";
import { masquerCompte } from "@/lib/payments/gains";
import {
  CONFIG_PAR_DEFAUT,
  finDePeriodePourVersement,
  jour,
  type PayoutConfig,
  type PayoutRail,
} from "@/lib/payments/payout-schedule";

/**
 * Exécution d'un versement.
 *
 * Le calendrier dit **quand** et **combien** ; ce module fait passer l'argent
 * d'un état à l'autre. Il ne parle à aucun opérateur : envoyer réellement les
 * fonds demande une intégration Wave, Orange Money ou virement, qui viendra
 * avec les paiements. Ce qui est ici, c'est la comptabilité — et c'est elle
 * qui doit être irréprochable avant qu'un franc bouge.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LES QUATRE MOMENTS
 *
 *   PRÉPARER    les soldes passent de « non versé » à « en cours ». Ils sont
 *               figés : plus aucune vente ni remboursement ne s'y ajoute.
 *   ENVOYER     l'ordre est parti chez l'opérateur, avec sa référence.
 *   CONFIRMER   l'opérateur dit que l'argent est arrivé. Soldes « versés ».
 *   ÉCHOUER     l'ordre n'est pas passé, ou l'argent est revenu. Les soldes
 *               **exactement ceux du versement** redeviennent versables.
 *
 * Le dernier point est la raison d'être de cette machine. Rendre un versement
 * échoué en recalculant « tout ce qui n'est pas versé » rendrait aussi les
 * ventes arrivées entre-temps, et le créateur serait payé deux fois pour
 * elles. On rend ce qu'on avait pris, ligne par ligne.
 */

export class VersementIntrouvableError extends Error {
  constructor(payoutId: string) {
    super(`Versement ${payoutId} introuvable.`);
    this.name = "VersementIntrouvableError";
  }
}

export class TransitionInterditeError extends Error {
  constructor(payoutId: string, depuis: string, vers: string) {
    super(
      `Versement ${payoutId} : passage de ${depuis} à ${vers} interdit.`,
    );
    this.name = "TransitionInterditeError";
  }
}

export class VersementsSuspendusError extends Error {
  constructor(payoutId: string, motif: string | null) {
    super(
      `Les versements de ce compte sont suspendus : ${motif ?? "motif non précisé"}. ` +
        `Le versement ${payoutId} ne peut pas partir.`,
    );
    this.name = "VersementsSuspendusError";
  }
}

export class RienAVerserError extends Error {
  constructor(userId: string, finDePeriode: Date) {
    super(
      `Aucun solde versable pour ${userId} au ${finDePeriode.toISOString().slice(0, 10)}.`,
    );
    this.name = "RienAVerserError";
  }
}

export interface PreparationInput {
  userId: string;
  /** Cycle auquel ce versement appartient — il décide des ventes incluses. */
  cycleDate: Date;
  rail: PayoutRail;
  method: PayoutMethod;
  /** Référence du compte destinataire : numéro mobile money, IBAN… */
  accountRef: string;
  holdingCurrency?: Currency;
  config?: PayoutConfig;
  /** Ignore le seuil minimum. Réservé à un versement déclenché à la main. */
  forcer?: boolean;
}

/**
 * Réserve les soldes versables et crée le versement.
 *
 * Tout tient dans une transaction : des soldes marqués « en cours » sans
 * versement pour les porter seraient de l'argent bloqué que personne ne
 * réclamerait.
 */
export async function preparerVersement(input: PreparationInput) {
  const {
    userId,
    cycleDate,
    rail,
    method,
    accountRef,
    holdingCurrency = "XOF",
    config = CONFIG_PAR_DEFAUT,
    forcer = false,
  } = input;

  const cycle = jour(cycleDate);
  const periodEnd = finDePeriodePourVersement(
    // La fin de période s'obtient du cycle : on repasse par la date de
    // versement pour réutiliser la même règle que la projection, plutôt que
    // d'en écrire une seconde qui pourrait diverger.
    ajouterRecul(cycle, rail, config),
    rail,
    config,
  );

  return db.$transaction(async (tx) => {
    const soldes = await tx.balance.findMany({
      where: {
        userId,
        holdingCurrency,
        state: "UNPAID",
        date: { lte: periodEnd },
      },
      select: { id: true, holdingAmount: true },
    });

    const montant = soldes.reduce((s, b) => s + b.holdingAmount, 0);

    // Un solde négatif net — plus de remboursements que de ventes sur la
    // période — ne se verse pas : on ne réclame pas d'argent au créateur.
    if (soldes.length === 0 || montant <= 0) {
      throw new RienAVerserError(userId, periodEnd);
    }
    if (!forcer && montant < config.minimumAmount) {
      throw new RienAVerserError(userId, periodEnd);
    }

    const versement = await tx.payout.create({
      data: {
        userId,
        method,
        provider: rail.id,
        accountRef,
        amount: montant,
        currency: holdingCurrency,
        status: "CREATING",
        cycleDate: cycle,
        periodEnd,
        scheduledDate: ajouterRecul(cycle, rail, config),
      },
      select: { id: true, amount: true },
    });

    // `updateMany` filtré sur UNPAID, pas une boucle : si un autre processus a
    // pris ces soldes entre-temps, le compte mis à jour ne correspondra pas et
    // on refuse plutôt que de payer deux fois.
    const { count } = await tx.balance.updateMany({
      where: { id: { in: soldes.map((b) => b.id) }, state: "UNPAID" },
      data: { state: "PROCESSING", payoutId: versement.id },
    });

    if (count !== soldes.length) {
      throw new RienAVerserError(userId, periodEnd);
    }

    return { versement, periodEnd, soldes: soldes.length };
  });
}

/** Transitions autorisées, énoncées une fois. */
const SUITES: Record<PayoutStatus, PayoutStatus[]> = {
  CREATING: ["PROCESSING", "CANCELLED", "FAILED"],
  PROCESSING: ["COMPLETED", "UNCLAIMED", "FAILED"],
  UNCLAIMED: ["COMPLETED", "FAILED", "RETURNED"],
  COMPLETED: ["RETURNED", "REVERSED"],
  CANCELLED: [],
  FAILED: [],
  RETURNED: [],
  REVERSED: [],
};

async function transiter(
  payoutId: string,
  vers: PayoutStatus,
  extra: Record<string, unknown> = {},
) {
  return db.$transaction(async (tx) => {
    const versement = await tx.payout.findUnique({
      where: { id: payoutId },
      select: {
        id: true,
        status: true,
        userId: true,
        amount: true,
        currency: true,
        accountRef: true,
        user: {
          select: {
            payoutsPausedAt: true,
            payoutsPausedReason: true,
            email: true,
            profile: { select: { displayName: true } },
          },
        },
      },
    });
    if (!versement) throw new VersementIntrouvableError(payoutId);

    if (!SUITES[versement.status]?.includes(vers)) {
      throw new TransitionInterditeError(payoutId, versement.status, vers);
    }

    // ────────────────────────────────────────────────────────────────
    // UN COMPTE GELÉ NE LAISSE PARTIER AUCUN ARGENT
    //
    // `peutEtrePaye()` vérifie la suspension à la **création** du versement.
    // Rien ne la vérifiait ensuite : un versement déjà créé quand un litige gelait
    // le compte pouvait être envoyé malgré tout, ce que le gel existe précisément
    // pour empêcher.
    //
    // Seul PROCESSING est gardé, et c'est délibéré : c'est la seule transition
    // où l'argent **sort**. Les autres ne font qu'inscrire ce que l'opérateur a
    // répondu. Refuser COMPLETED sur un compte gelé ne rappellerait pas des fonds
    // déjà partis — cela laisserait seulement nos livres affirmer « en transit »
    // pour un argent arrivé, et un registre faux se paie plus cher qu'un
    // versement de trop bloqué.
    if (vers === "PROCESSING" && versement.user.payoutsPausedAt !== null) {
      throw new VersementsSuspendusError(
        payoutId,
        versement.user.payoutsPausedReason,
      );
    }

    const misAJour = await tx.payout.update({
      where: { id: payoutId },
      data: { status: vers, ...extra },
    });

    // L'avis part avec le versement, dans la même transaction.
    //
    // Déposé à l'envoi et non à la confirmation : c'est le moment où le créateur
    // a besoin de savoir que son argent est en route, pas trois jours plus tard
    // quand il est arrivé. La clé tient au versement, donc un rejeu de la même
    // transition n'enverrait pas deux avis.
    if (vers === "PROCESSING") {
      await deposer(
        {
          cle: `versement-${payoutId}`,
          destinataire: versement.user.email,
          modele: "AVIS_VERSEMENT",
          charge: {
            nom: versement.user.profile?.displayName ?? versement.user.email,
            montant: formatMoney(versement.amount, versement.currency),
            compte: masquerCompte(versement.accountRef),
          },
        },
        tx,
      );
    }

    // Les soldes suivent le versement, jamais l'inverse.
    if (vers === "COMPLETED") {
      await tx.balance.updateMany({
        where: { payoutId, state: "PROCESSING" },
        data: { state: "PAID" },
      });
    } else if (
      vers === "FAILED" ||
      vers === "RETURNED" ||
      vers === "CANCELLED" ||
      vers === "REVERSED"
    ) {
      // On rend exactement les soldes que ce versement avait pris. Recalculer
      // « ce qui n'est pas versé » rendrait aussi les ventes arrivées depuis,
      // et le créateur serait payé deux fois pour elles.
      //
      // REVERSED dit la même chose que RETURNED — l'argent qu'on croyait livré
      // ne l'est pas resté — et n'était pas dans cette liste. Un versement
      // repris laissait donc le créateur inscrit comme payé pour un argent
      // revenu. Refuser de recréditer n'est pas la bonne défense contre un
      // créateur de mauvaise foi : le solde lui reste dû tant qu'on n'a pas
      // gelé son compte, et c'est à ce gel-là d'arrêter la sortie.
      await tx.balance.updateMany({
        where: { payoutId },
        data: { state: "UNPAID", payoutId: null },
      });
    }

    return misAJour;
  });
}

/** L'ordre est parti chez l'opérateur. */
export async function marquerVersementEnvoye(
  payoutId: string,
  reference: string,
) {
  return transiter(payoutId, "PROCESSING", {
    failureReason: null,
    // La référence de l'opérateur est ce qui permet de retrouver l'ordre chez
    // lui le jour où le créateur dit ne rien avoir reçu.
    providerRef: reference,
  });
}

/**
 * L'opérateur détient les fonds et attend que le bénéficiaire les retire.
 *
 * Cas courant du mobile money : l'ordre est passé, l'argent est chez
 * l'opérateur, mais le bénéficiaire ne l'a pas encore réclamé. Personne n'a
 * échoué ; l'argent n'est simplement pas arrivé à destination.
 *
 * Comme REVERSED, cet état existait sans qu'aucune fonction n'y mène.
 */
export async function marquerVersementNonReclame(payoutId: string) {
  return transiter(payoutId, "UNCLAIMED");
}

/** L'opérateur confirme que l'argent est arrivé. */
export async function confirmerVersement(payoutId: string) {
  return transiter(payoutId, "COMPLETED", { processedAt: new Date() });
}

/**
 * L'ordre n'est pas passé.
 *
 * Les soldes redeviennent versables : la somme repartira au cycle suivant,
 * cumulée aux ventes de la période.
 */
export async function echouerVersement(payoutId: string, raison: string) {
  return transiter(payoutId, "FAILED", { failureReason: raison });
}

/** L'argent est revenu — coordonnées invalides, compte fermé. */
export async function retournerVersement(payoutId: string, raison: string) {
  return transiter(payoutId, "RETURNED", { failureReason: raison });
}

/** Annulé avant d'avoir été envoyé. */
export async function annulerVersement(payoutId: string, raison: string) {
  return transiter(payoutId, "CANCELLED", { failureReason: raison });
}

/**
 * Repris par l'opérateur après avoir été payé.
 *
 * Distinct de RETURNED, qui décrit un envoi jamais parvenu à destination. Ici
 * l'argent était arrivé, puis l'opérateur l'a repris — fraude constatée chez
 * lui, erreur de son côté.
 *
 * L'état existait au schéma et dans la table des suites, mais aucune fonction
 * n'y menait : il était inatteignable. C'est ce qui l'avait fait oublier de la
 * liste des états qui rendent leurs soldes.
 */
export async function reprendreVersement(payoutId: string, raison: string) {
  return transiter(payoutId, "REVERSED", { failureReason: raison });
}

/**
 * Date de versement d'un cycle, sans repasser par le module de calendrier —
 * qui exporte la conversion mais pas le recul lui-même.
 */
function ajouterRecul(
  cycle: Date,
  rail: PayoutRail,
  config: PayoutConfig,
): Date {
  const recul = (config.anchorWeekday - rail.weekday + 7) % 7;
  const d = jour(cycle);
  d.setUTCDate(d.getUTCDate() - recul);
  return d;
}
