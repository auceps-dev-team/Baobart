/**
 * Écriture au grand livre.
 *
 * Seul endroit du code autorisé à toucher `Balance` et `BalanceTransaction`.
 * Tout passe par ici pour que les invariantes tiennent en un seul lieu :
 *
 *   - un solde par (créateur, jour, devise de détention) ;
 *   - les montants ne bougent qu'en état UNPAID ;
 *   - chaque mouvement laisse une écriture immuable.
 *
 * Les deux dernières sont aussi tenues par des triggers Postgres. Le code les
 * vérifie quand même, pour échouer avec un message lisible plutôt qu'avec une
 * erreur de contrainte à cinq niveaux de profondeur.
 */

import type { Prisma } from "@prisma/client";

import type {
  BalanceTransactionType,
  Currency,
} from "@/lib/domain/prisma-types";

import { jour } from "@/lib/payments/payout-schedule";

/** Le solde du jour est figé : impossible de le créditer. */
export class SoldeFigeError extends Error {
  constructor(balanceId: string, state: string) {
    super(
      `Le solde ${balanceId} est en état ${state} : ses montants sont figés. ` +
        `Un versement en cours ne doit jamais absorber une vente arrivée après lui.`,
    );
    this.name = "SoldeFigeError";
  }
}

export class DeviseNonConvertibleError extends Error {
  constructor(de: Currency, vers: Currency) {
    super(
      `Encaissement en ${de} vers un solde en ${vers} sans taux de change. ` +
        `Fournir \`tauxChange\` ou aligner les devises (voir le modèle ExchangeRate).`,
    );
    this.name = "DeviseNonConvertibleError";
  }
}

export interface CreditInput {
  userId: string;
  type: BalanceTransactionType;
  /** Devise et montants tels qu'encaissés auprès de l'acheteur. */
  issuedCurrency: Currency;
  issuedGross: number;
  issuedNet: number;
  /** Devise dans laquelle le créateur sera payé. */
  holdingCurrency: Currency;
  /**
   * Taux d'encaissement → détention. Obligatoire si les deux devises diffèrent.
   * Exprimé en unités de détention par unité encaissée.
   */
  tauxChange?: number;
  orderItemId?: string;
  refundId?: string;
  payoutId?: string;
  date?: Date;
}

/**
 * Crédite le solde du jour d'un créateur et écrit le mouvement correspondant.
 *
 * À appeler DANS une transaction : créditer un solde sans écrire au grand livre,
 * ou l'inverse, laisserait la comptabilité fausse.
 */
export async function crediterSolde(
  tx: Prisma.TransactionClient,
  input: CreditInput,
) {
  const {
    userId,
    type,
    issuedCurrency,
    issuedGross,
    issuedNet,
    holdingCurrency,
    tauxChange,
    orderItemId,
    refundId,
    payoutId,
    date = new Date(),
  } = input;

  if (issuedCurrency !== holdingCurrency && tauxChange === undefined) {
    throw new DeviseNonConvertibleError(issuedCurrency, holdingCurrency);
  }

  const taux = issuedCurrency === holdingCurrency ? 1 : (tauxChange as number);
  const holdingGross = Math.round(issuedGross * taux);
  const holdingNet = Math.round(issuedNet * taux);

  const dateSolde = jour(date);

  // Le solde du jour est créé au premier mouvement, puis réutilisé.
  const solde = await tx.balance.upsert({
    where: {
      userId_date_holdingCurrency: {
        userId,
        date: dateSolde,
        holdingCurrency,
      },
    },
    create: {
      userId,
      date: dateSolde,
      currency: issuedCurrency,
      amount: 0,
      holdingCurrency,
      holdingAmount: 0,
    },
    update: {},
  });

  // Échec explicite plutôt qu'une violation de trigger. Ce cas ne devrait pas
  // survenir : un versement ne prend que des soldes antérieurs au délai de
  // rétention, donc jamais celui du jour.
  if (solde.state !== "UNPAID") {
    throw new SoldeFigeError(solde.id, solde.state);
  }

  const [soldeMisAJour, mouvement] = await Promise.all([
    tx.balance.update({
      where: { id: solde.id },
      data: {
        amount: { increment: issuedNet },
        holdingAmount: { increment: holdingNet },
      },
    }),
    tx.balanceTransaction.create({
      data: {
        userId,
        balanceId: solde.id,
        type,
        issuedCurrency,
        issuedGross,
        issuedNet,
        holdingCurrency,
        holdingGross,
        holdingNet,
        orderItemId,
        refundId,
        payoutId,
      },
    }),
  ]);

  return { solde: soldeMisAJour, mouvement };
}

/**
 * Les soldes qu'un versement prend — la règle, écrite une seule fois.
 *
 * Le versement, la décision de verser (`cycle.ts`) et l'écran « Gains » la
 * lisent tous trois ici : un créateur ne doit pas lire « disponible : 3 673 F »
 * pour recevoir 873 F le jour dit.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LES CRÉDITS ATTENDENT, LES DETTES N'ATTENDENT PAS (Q-41, décidé le 21/11/2026)
 *
 * Une vente attend la fin de sa période de rétention : c'est la protection
 * contre un remboursement ou une contestation. Un remboursement, lui, est déjà
 * parti chez l'acheteur. Le laisser attendre la même borne, c'était faire
 * avancer l'argent par la plateforme : mesuré le 14/11 (recette, J+10), un
 * versement « arrêté au 20 » payait 3 673 F alors qu'un remboursement de
 * 2 800 F était parti le 22 — solde réel, 873 F.
 *
 * D'où, en plus des soldes jusqu'à la fin de période, **les soldes négatifs
 * qui la suivent**, jusqu'à la veille de `dettesAvant`. Deux bornes, chacune
 * avec sa raison :
 *
 *   — **négatifs seulement.** Un solde est la somme d'une journée. Un jour où
 *     les ventes couvrent le remboursement reste positif ; ses ventes, encore
 *     retenues, couvrent déjà ce qui est parti, et la plateforme n'avance rien.
 *     Le prendre paierait ces ventes avant la fin de leur rétention ;
 *   — **jamais le jour même.** Un solde pris par un versement est figé, et
 *     `crediterSolde` refuse d'y écrire (`SoldeFigeError`) : une vente arrivée
 *     dans l'après-midi échouerait. Aucun appel de production ne date une
 *     écriture dans le passé (lu le 21/11 : `encaisserLigne`, `rembourserLigne`,
 *     `enregistrerLitige` écrivent au jour même) ; figer un jour passé est sûr.
 *     Un remboursement du jour même attend donc le versement suivant.
 *
 * Sans `dettesAvant`, la règle d'avant : la fin de période, et elle seule.
 */
export function filtreSoldesAVerser(
  userId: string,
  holdingCurrency: Currency,
  finDePeriode: Date,
  dettesAvant?: Date,
): Prisma.BalanceWhereInput {
  const fin = jour(finDePeriode);
  const jusquALaFin: Prisma.BalanceWhereInput = { date: { lte: fin } };
  return {
    userId,
    holdingCurrency,
    state: "UNPAID",
    ...(dettesAvant && jour(dettesAvant) > fin
      ? {
          OR: [
            jusquALaFin,
            { date: { gt: fin, lt: jour(dettesAvant) }, holdingAmount: { lt: 0 } },
          ],
        }
      : jusquALaFin),
  };
}

/**
 * Cumul versable d'un créateur, arrêté à une date de fin de période incluse —
 * dettes postérieures comprises quand `dettesAvant` est donné (voir
 * `filtreSoldesAVerser`). C'est la fonction que consomme la projection des
 * versements.
 */
export async function soldeVersableJusqua(
  db: Prisma.TransactionClient,
  userId: string,
  finDePeriode: Date,
  holdingCurrency: Currency = "XOF",
  dettesAvant?: Date,
): Promise<number> {
  const agregat = await db.balance.aggregate({
    where: filtreSoldesAVerser(userId, holdingCurrency, finDePeriode, dettesAvant),
    _sum: { holdingAmount: true },
  });

  return agregat._sum.holdingAmount ?? 0;
}
