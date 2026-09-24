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

import type { Prisma } from "@prisma/client";

import type { Currency } from "@/lib/domain/prisma-types";

import { crediterSolde } from "@/lib/domain/balances";
import {
  computeFees,
  partProportionnelle,
  type FeeRegime,
} from "@/lib/domain/fees";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/i18n/money";
import { notifier } from "@/lib/notifications/aiguilleur";

export class LigneDejaEncaisseeError extends Error {
  constructor(orderItemId: string, state: string) {
    super(
      `La ligne ${orderItemId} est déjà en état ${state} : on ne l'encaisse pas deux fois.`,
    );
    this.name = "LigneDejaEncaisseeError";
  }
}

export class RemboursementInterditError extends Error {
  constructor(orderItemId: string, state: string) {
    super(
      `La ligne ${orderItemId} est en état ${state} : elle ne peut pas être remboursée.`,
    );
    this.name = "RemboursementInterditError";
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

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
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
      // Le pourboire entre dans le brut, une fois — il se donne à la commande,
      // pas à l'exemplaire. Il supporte les mêmes frais que le reste : il
      // emprunte le même rail de paiement, qui coûte le même pourcentage.
      tipAmount: ligne.tipAmount,
    });

    // Un produit gratuit est livré sans encaissement : la ligne aboutit, mais
    // rien ne transite. `NOT_CHARGED` dit exactement cela.
    const etat = frais.gross === 0 ? "NOT_CHARGED" : "SUCCESSFUL";

    // Garde anti double-encaissement : le test de l'état vit dans le WHERE de
    // l'écriture, pas seulement dans la lecture précédente. Deux webhooks de
    // paiement concurrents peuvent lire IN_PROGRESS ; un seul doit réussir à
    // faire la transition.
    const transition = await tx.orderItem.updateMany({
      where: { id: orderItemId, state: "IN_PROGRESS" },
      data: {
        state: etat,
        platformFee: frais.platformFee,
        processorFee: frais.processorFee,
        affiliateFee: frais.affiliateCredit,
        taxAmount: frais.taxAmount,
      },
    });

    if (transition.count !== 1) {
      const etatActuel = await tx.orderItem.findUnique({
        where: { id: orderItemId },
        select: { state: true },
      });
      throw new LigneDejaEncaisseeError(
        orderItemId,
        etatActuel?.state ?? "INCONNU",
      );
    }

    const ligneEncaissee = await tx.orderItem.findUniqueOrThrow({
      where: { id: orderItemId },
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
  }, { isolationLevel: "Serializable" });
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

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const ligne = await tx.orderItem.findUniqueOrThrow({
      where: { id: orderItemId },
      include: { order: true, product: { include: { seller: true } } },
    });

    if (ligne.state !== "SUCCESSFUL" && ligne.state !== "NOT_CHARGED") {
      throw new RemboursementInterditError(orderItemId, ligne.state);
    }

    // ══════════════════════════════════════════════════════════════════════
    // LE POURBOIRE SE REMBOURSE COMME LE RESTE
    //
    // Il aurait été plus simple de le laisser dehors : un pourboire est un
    // geste, et on pourrait défendre qu'il ne se reprend pas.
    //
    // Mais du point de vue de qui demande son argent, c'est indéfendable :
    // on lui rendrait tout sauf ce qu'il a donné en plus par bonne volonté,
    // et personne ne comprendrait que la générosité soit la seule chose non
    // remboursable. Le plafond de remboursement est donc la somme des deux.
    //
    // La ligne vaut pour toutes les ventes passées : `tipAmount` vaut zéro
    // par défaut, l'expression est identique pour elles.
    const encaisse = ligne.price * ligne.quantity + ligne.tipAmount;
    const dejaRembourse = ligne.refundedAmount;
    if (dejaRembourse + amount > encaisse) {
      throw new RangeError(
        `Remboursement de ${amount} impossible : ${dejaRembourse} déjà remboursés sur ${encaisse}.`,
      );
    }

    // Même protection que pour l'encaissement : le plafond de remboursement est
    // contrôlé par l'UPDATE lui-même. Deux remboursements concurrents ne peuvent
    // donc pas dépasser le montant encaissé en s'appuyant sur la même lecture.
    const increment = await tx.orderItem.updateMany({
      where: {
        id: orderItemId,
        state: { in: ["SUCCESSFUL", "NOT_CHARGED"] },
        refundedAmount: { lte: encaisse - amount },
      },
      data: { refundedAmount: { increment: amount } },
    });

    if (increment.count !== 1) {
      const courant = await tx.orderItem.findUnique({
        where: { id: orderItemId },
        select: { refundedAmount: true, state: true },
      });
      if (!courant || (courant.state !== "SUCCESSFUL" && courant.state !== "NOT_CHARGED")) {
        throw new RemboursementInterditError(orderItemId, courant?.state ?? "INCONNU");
      }
      throw new RangeError(
        `Remboursement de ${amount} impossible : ${courant.refundedAmount} déjà remboursés sur ${encaisse}.`,
      );
    }

    // Ce que la plateforme garde sur ce remboursement. N'entre dans aucun
    // calcul : la somme est notée faute d'un compte plateforme au grand livre,
    // pour qu'on puisse un jour répondre à « combien avons-nous conservé ».
    // Répartie par différence sur le cumul, sans quoi cent remboursements d'un
    // franc n'additionneraient pas la commission entière.
    const retenu = partProportionnelle({
      brut: encaisse,
      part: ligne.platformFee,
      dejaRembourse,
      montant: amount,
    });

    const remboursement = await tx.refund.create({
      data: {
        orderItemId,
        amount,
        currency: ligne.order.currency,
        reason,
        refundedById,
        retainedFee: retenu,
      },
    });

    // ────────────────────────────────────────────────────────────────
    // LE VENDEUR FINANCE LE REMBOURSEMENT EN ENTIER
    //
    // Décision commerciale, août 2026 : la commission n'est pas rendue, et les
    // frais d'opérateur — que la passerelle de paiement ne restitue jamais —
    // restent à la charge du vendeur. L'acheteur reçoit le brut ; la plateforme
    // ne verse rien ; le vendeur est donc débité du brut, pas de son net.
    //
    // Conséquence à connaître : sur une vente à 5 000 remboursée intégralement,
    // le vendeur avait reçu 4 425 et rend 5 000 — son solde descend à −575.
    // Aucune contrainte ne l'interdit, et le versement suivant absorbera le
    // déficit. C'est voulu : rembourser coûte au vendeur, pas à la plateforme.
    const { mouvement } = await crediterSolde(tx, {
      userId: ligne.product.sellerId,
      type: "REFUND",
      issuedCurrency: ligne.order.currency,
      issuedGross: -amount,
      issuedNet: -amount,
      holdingCurrency:
        holdingCurrency ?? ligne.product.seller.defaultCurrency,
      tauxChange,
      orderItemId,
      refundId: remboursement.id,
      date,
    });

    // ════════════════════════════════════════════════════════════════════════
    // PRÉVENIR L'ACHETEUR — DE L'ARGENT QUI REPART
    //
    // `COMMANDE_REMBOURSEE` est impératif au catalogue, et pour la même raison
    // que le reçu : c'est un mouvement d'argent. Quelqu'un doit pouvoir dire
    // quand et combien lui a été rendu, sans dépendre d'un courriel retrouvé.
    //
    // Dans la transaction, comme le reste : un avis de remboursement envoyé
    // pour un remboursement qui n'a finalement pas abouti est pire que pas
    // d'avis du tout.
    //
    // La clé porte le remboursement, pas la ligne de commande : un
    // remboursement partiel peut être suivi d'un autre, et les deux méritent
    // chacun leur avis.
    await notifier(
      {
        destinataireId: ligne.order.buyerId,
        evenement: "COMMANDE_REMBOURSEE",
        cle: `remboursement-${remboursement.id}`,
        titre: `Remboursement — ${ligne.product.name}`,
        corps: `${formatMoney(amount, ligne.product.currency)} repartent vers ton moyen de paiement. Compte quelques jours selon l'opérateur.`,
        lien: "/dashboard/achats",
        charge: {
          ressource: ligne.product.name,
          montant: formatMoney(amount, ligne.product.currency),
          ...(reason ? { raison: reason } : {}),
        },
      },
      tx,
    );

    return { remboursement, mouvement, retenu, aCharge: amount };
  }, { isolationLevel: "Serializable" });
}
