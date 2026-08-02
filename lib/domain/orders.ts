/**
 * Encaissement d'une ligne d'achat.
 *
 * C'est ici que le décideur pur (`fees.ts`) rencontre la base : on calcule la
 * décomposition brut → net, on la fige sur la ligne, et on crédite le créateur.
 *
 * Le tout dans **une seule transaction**. Une ligne marquée encaissée sans
 * écriture au grand livre, ou l'inverse, c'est de l'argent qui existe d'un côté
 * et pas de l'autre.
 */

import type { Currency } from "@prisma/client";

import { crediterSolde } from "@/lib/domain/balances";
import { computeFees, type FeeRegime } from "@/lib/domain/fees";
import { db } from "@/lib/db";

export class LigneDejaEncaisseeError extends Error {
  constructor(orderItemId: string, state: string) {
    super(
      `La ligne ${orderItemId} est déjà en état ${state} : on ne l'encaisse pas deux fois.`,
    );
    this.name = "LigneDejaEncaisseeError";
  }
}

export interface EncaissementInput {
  orderItemId: string;
  /** Qui a amené l'acheteur — décide du taux de commission (voir fees.ts). */
  regime: FeeRegime;
  affiliateBasisPoints?: number;
  sellerBearsAffiliateFee?: boolean;
  taxAmount?: number;
  /** Devise de versement du créateur. Par défaut la sienne. */
  holdingCurrency?: Currency;
  tauxChange?: number;
  date?: Date;
}

/**
 * Encaisse une ligne d'achat : fige les frais, marque la ligne réussie et
 * crédite le solde du créateur.
 *
 * Renvoie la décomposition, pour que l'appelant puisse l'afficher sans la
 * recalculer — un montant recalculé est un montant qui peut diverger.
 */
export async function encaisserLigne(input: EncaissementInput) {
  const {
    orderItemId,
    regime,
    affiliateBasisPoints = 0,
    sellerBearsAffiliateFee = false,
    taxAmount = 0,
    holdingCurrency,
    tauxChange,
    date = new Date(),
  } = input;

  return db.$transaction(async (tx) => {
    const ligne = await tx.orderItem.findUniqueOrThrow({
      where: { id: orderItemId },
      include: {
        order: true,
        product: { include: { seller: true } },
      },
    });

    if (ligne.state !== "IN_PROGRESS") {
      throw new LigneDejaEncaisseeError(orderItemId, ligne.state);
    }

    const frais = computeFees({
      unitPrice: ligne.price,
      quantity: ligne.quantity,
      regime,
      affiliateBasisPoints,
      sellerBearsAffiliateFee,
      taxAmount,
    });

    // Un produit gratuit est livré sans encaissement : la ligne aboutit, mais
    // rien ne transite. `NOT_CHARGED` dit exactement cela.
    const etat = frais.gross === 0 ? "NOT_CHARGED" : "SUCCESSFUL";

    const ligneEncaissee = await tx.orderItem.update({
      where: { id: orderItemId },
      data: {
        state: etat,
        platformFee: frais.platformFee,
        processorFee: frais.processorFee,
        affiliateFee: frais.affiliateCredit,
        taxAmount: frais.taxAmount,
      },
    });

    if (frais.gross === 0) {
      return { ligne: ligneEncaissee, frais, mouvement: null };
    }

    const { mouvement } = await crediterSolde(tx, {
      userId: ligne.product.sellerId,
      type: "SALE",
      issuedCurrency: ligne.order.currency,
      issuedGross: frais.gross,
      issuedNet: frais.sellerNet,
      holdingCurrency:
        holdingCurrency ?? ligne.product.seller.defaultCurrency,
      tauxChange,
      orderItemId,
      date,
    });

    return { ligne: ligneEncaissee, frais, mouvement };
  });
}

/**
 * Rembourse tout ou partie d'une ligne, et débite le créateur d'autant.
 *
 * Un remboursement est un **enregistrement**, jamais un changement de statut :
 * c'est ce qui permet d'en empiler plusieurs partiels sur la même ligne.
 */
export async function rembourserLigne(input: {
  orderItemId: string;
  amount: number;
  reason?: string;
  refundedById?: string;
  holdingCurrency?: Currency;
  tauxChange?: number;
  date?: Date;
}) {
  const {
    orderItemId,
    amount,
    reason,
    refundedById,
    holdingCurrency,
    tauxChange,
    date = new Date(),
  } = input;

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new RangeError(`Montant de remboursement invalide : ${amount}`);
  }

  return db.$transaction(async (tx) => {
    const ligne = await tx.orderItem.findUniqueOrThrow({
      where: { id: orderItemId },
      include: { order: true, product: { include: { seller: true } } },
    });

    const encaisse = ligne.price * ligne.quantity;
    const dejaRembourse = ligne.refundedAmount;
    if (dejaRembourse + amount > encaisse) {
      throw new RangeError(
        `Remboursement de ${amount} impossible : ${dejaRembourse} déjà remboursés sur ${encaisse}.`,
      );
    }

    const remboursement = await tx.refund.create({
      data: {
        orderItemId,
        amount,
        currency: ligne.order.currency,
        reason,
        refundedById,
      },
    });

    await tx.orderItem.update({
      where: { id: orderItemId },
      data: { refundedAmount: { increment: amount } },
    });

    // Le créateur rend ce qu'il avait touché sur la part remboursée, au prorata
    // de son net — il ne rend pas la commission de la plateforme, qu'il n'a
    // jamais reçue.
    const partNette = encaisse === 0 ? 0 : Math.round(
      (amount * (encaisse - ligne.platformFee - ligne.processorFee - ligne.affiliateFee)) /
        encaisse,
    );

    const { mouvement } = await crediterSolde(tx, {
      userId: ligne.product.sellerId,
      type: "REFUND",
      issuedCurrency: ligne.order.currency,
      issuedGross: -amount,
      issuedNet: -partNette,
      holdingCurrency:
        holdingCurrency ?? ligne.product.seller.defaultCurrency,
      tauxChange,
      orderItemId,
      refundId: remboursement.id,
      date,
    });

    return { remboursement, mouvement, partNette };
  });
}
