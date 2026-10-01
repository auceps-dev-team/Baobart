import "server-only";

/**
 * Lectures brutes du tableau de bord.
 *
 * Nommé `lectures` et non `queries` : ce dernier est déjà pris par les
 * historiques de l'acheteur, qui portent des règles (états de commande,
 * regroupement des retraits, filtres). Ici on ne fait que chercher — un
 * `select` par écran, sans décision.
 */

import { ETATS_ABOUTIS } from "@/lib/dashboard/historique";
import { db } from "@/lib/db";
import type {
  Currency,
  ProductFamily,
  ProductStatus,
} from "@/lib/domain/prisma-types";

// Ré-exporté, jamais recopié : la copie qui vivait ici a manqué `SUSPENDED`,
// et c'est le typecheck qui l'a signalé — pas le test du miroir, qui ne
// regarde que `prisma-types.ts`.
export type { ProductStatus };

/**
 * Ce que le créateur lit sur sa fiche.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UN `Record` EXHAUSTIF, PAS UN TERNAIRE
 *
 * Trois écrans écrivaient `status === "PUBLISHED" ? "En ligne" : "Brouillon"`.
 * Tant qu'il n'y avait que trois états, `ARCHIVED` s'affichait « Brouillon » —
 * inexact, sans conséquence. Avec `SUSPENDED`, la même ligne dit à un créateur
 * dont la ressource est sous retrait juridique qu'elle est en brouillon : il
 * clique « publier », et se fait renvoyer par une garde qu'il ne comprend pas.
 *
 * Un `Record<ProductStatus, string>` ne compile pas tant qu'un état n'a pas de
 * libellé. C'est le seul dispositif ici qui rende l'oubli impossible plutôt
 * qu'improbable.
 */
export const LIBELLE_STATUT: Record<ProductStatus, string> = {
  DRAFT: "Brouillon",
  PUBLISHED: "En ligne",
  ARCHIVED: "Archivée",
  // Court, parce qu'il s'affiche dans une pastille. Le détail — quelle
  // notification, depuis quand — est sur la fiche.
  SUSPENDED: "Retirée (juridique)",
};
export type OrderStatus = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
export type PurchaseState = "IN_PROGRESS" | "SUCCESSFUL" | "FAILED" | "NOT_CHARGED";

export interface ProduitDashboard {
  id: string;
  slug: string;
  name: string;
  status: ProductStatus;
  family: ProductFamily | null;
  price: number;
  currency: Currency;
  downloadsCount: number;
  salesCount: number;
  ratingAvg: { toString(): string } | number | string;
  ratingCount: number;
  coverUrl: string | null;
  _count: { files: number; orderItems?: number };
}

export interface CommandeAcheteur {
  id: string;
  status: OrderStatus;
  total: number;
  currency: Currency;
  createdAt: Date;
  items: Array<{
    id: string;
    quantity: number;
    state: PurchaseState;
    price: number;
    product: { name: string; slug: string; coverUrl: string | null };
  }>;
}

export interface VenteCreateur {
  id: string;
  quantity: number;
  state: PurchaseState;
  price: number;
  platformFee: number;
  processorFee: number;
  affiliateFee: number;
  refundedAmount: number;
  /// Paiement contesté auprès de la banque, contestation non tranchée.
  chargebackAt: Date | null;
  chargebackReversedAt: Date | null;
  /// Accès coupé à la main par le vendeur, sans remboursement.
  accessRevokedAt: Date | null;
  createdAt: Date;
  order: { buyer: { email: string; profile: { displayName: string } | null } };
  product: { name: string; slug: string; currency: Currency };
}


export interface CollectionDashboard {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  savesCount: number;
  createdAt: Date;
  _count: { saves: number };
}

export interface TelechargementDashboard {
  id: string;
  productId: string;
  productFileId: string | null;
  eventType: string;
  platform: string;
  consumedAt: Date;
}

export interface AbonnementDashboard {
  id: string;
  status: string;
  cycleStart: Date;
  cycleEnd: Date;
  plan: {
    code: string;
    name: string;
    priceMonthly: number;
    downloadsPerMonth: number | null;
    licenseIncluded: string | null;
    shieldLevel: string;
  };
  quotas: Array<{ period: string; used: number; limit: number }>;
}

export interface PlanDashboard {
  id: string;
  code: string;
  name: string;
  priceMonthly: number;
  downloadsPerMonth: number | null;
  licenseIncluded: string | null;
  shieldLevel: string;
  features: unknown;
}

export interface BalanceDashboard {
  id: string;
  date: Date;
  state: string;
  amount: number;
  currency: Currency;
  holdingAmount: number;
  holdingCurrency: Currency;
}

export interface TransactionDashboard {
  id: string;
  type: string;
  occurredAt: Date;
  holdingNet: number;
  holdingCurrency: Currency;
  issuedNet: number;
  issuedCurrency: Currency;
}

export interface PayoutDashboard {
  id: string;
  status: string;
  amount: number;
  currency: Currency;
  method: string;
  provider: string;
  scheduledDate: Date | null;
  createdAt: Date;
}

export interface CommissionDashboard {
  id: string;
  sellerId: string;
  buyerId: string;
  productId: string;
  status: string;
  depositAmount: number;
  completionAmount: number | null;
  brief: string | null;
  createdAt: Date;
}

export async function lireProduitsCreateur(userId: string, limit = 8) {
  return db.product.findMany({
    where: { sellerId: userId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      family: true,
      price: true,
      currency: true,
      downloadsCount: true,
      salesCount: true,
      ratingAvg: true,
      ratingCount: true,
      coverUrl: true,
      _count: { select: { files: true, orderItems: true } },
    },
  }) as Promise<ProduitDashboard[]>;
}

export async function lireCommandesAcheteur(userId: string, limit = 10) {
  return db.order.findMany({
    where: { buyerId: userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      status: true,
      total: true,
      currency: true,
      createdAt: true,
      items: {
        select: {
          id: true,
          quantity: true,
          state: true,
          price: true,
          product: { select: { name: true, slug: true, coverUrl: true } },
        },
      },
    },
  }) as Promise<CommandeAcheteur[]>;
}

/**
 * Les lignes vendues par ce créateur.
 *
 * Par défaut, seulement celles qui ont abouti : une vente est un paiement
 * reçu. Les lignes en cours ou échouées s'affichaient « Paiement encaissé,
 * accès actif », avec « Rembourser… » — 9 000 F « encaissés » pour un
 * paiement abandonné (mesuré le 25/09, S15). `toutes` sert l'écran des
 * commandes, qui montre chaque ligne avec son état réel.
 */
export async function lireVentesCreateur(
  userId: string,
  limit = 10,
  { toutes = false }: { toutes?: boolean } = {},
) {
  return db.orderItem.findMany({
    where: {
      product: { sellerId: userId },
      ...(toutes ? {} : { state: { in: [...ETATS_ABOUTIS] } }),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      quantity: true,
      state: true,
      price: true,
      platformFee: true,
      processorFee: true,
      affiliateFee: true,
      refundedAmount: true,
      chargebackAt: true,
      chargebackReversedAt: true,
      accessRevokedAt: true,
      createdAt: true,
      order: {
        select: {
          buyer: { select: { email: true, profile: { select: { displayName: true } } } },
        },
      },
      product: { select: { name: true, slug: true, currency: true } },
    },
  }) as Promise<VenteCreateur[]>;
}

export async function lireProfilDashboard(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      phone: true,
      defaultCurrency: true,
      kycStatus: true,
      riskState: true,
      payoutFrequency: true,
      payoutRail: true,
      profile: {
        select: {
          username: true,
          displayName: true,
          bio: true,
          city: true,
          country: true,
          avatarUrl: true,
          bannerUrl: true,
          isVerified: true,
          ratingAvg: true,
          ratingCount: true,
          workCount: true,
          followerCount: true,
          speciality: true,
          portfolioUrl: true,
          instagram: true,
          behance: true,
          openToCommissions: true,
          dailyRate: true,
        },
      },
      billing: {
        select: {
          firstName: true,
          lastName: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          postalCode: true,
          country: true,
          region: true,
        },
      },
    },
  });
}

export async function lireResumeDashboard(userId: string) {
  const [produits, produitsPublies, commandes, telechargements, collections, abonnements, ventes, solde] =
    await Promise.all([
      db.product.count({ where: { sellerId: userId } }),
      db.product.count({ where: { sellerId: userId, status: "PUBLISHED" } }),
      db.order.count({ where: { buyerId: userId } }),
      db.consumptionEvent.count({ where: { userId } }),
      db.board.count({ where: { ownerId: userId } }),
      db.subscription.count({ where: { userId, status: "ACTIVE" } }),
      db.orderItem.count({ where: { product: { sellerId: userId }, state: { in: ["SUCCESSFUL", "NOT_CHARGED"] } } }),
      db.balance.aggregate({ where: { userId, state: "UNPAID" }, _sum: { holdingAmount: true } }),
    ]);

  return {
    produits,
    produitsPublies,
    commandes,
    telechargements,
    collections,
    abonnements,
    ventes,
    soldeDisponible: solde._sum.holdingAmount ?? 0,
  };
}

export async function lireCollections(userId: string): Promise<CollectionDashboard[]> {
  return db.board.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      isPublic: true,
      savesCount: true,
      createdAt: true,
      _count: { select: { saves: true } },
    },
  });
}

export async function lireTelechargements(userId: string, limit = 20): Promise<TelechargementDashboard[]> {
  return db.consumptionEvent.findMany({
    where: { userId },
    orderBy: { consumedAt: "desc" },
    take: limit,
    select: {
      id: true,
      productId: true,
      productFileId: true,
      eventType: true,
      platform: true,
      consumedAt: true,
    },
  });
}

export async function lireAbonnements(userId: string): Promise<AbonnementDashboard[]> {
  return db.subscription.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      cycleStart: true,
      cycleEnd: true,
      plan: {
        select: {
          code: true,
          name: true,
          priceMonthly: true,
          downloadsPerMonth: true,
          licenseIncluded: true,
          shieldLevel: true,
        },
      },
      quotas: { select: { period: true, used: true, limit: true } },
    },
  });
}

export async function lirePlans(): Promise<PlanDashboard[]> {
  return db.plan.findMany({
    orderBy: { priceMonthly: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      priceMonthly: true,
      downloadsPerMonth: true,
      licenseIncluded: true,
      shieldLevel: true,
      features: true,
    },
  });
}

export async function lireRevenus(userId: string): Promise<{
  balances: BalanceDashboard[];
  transactions: TransactionDashboard[];
  payouts: PayoutDashboard[];
}> {
  const [balances, transactions, payouts] = await Promise.all([
    db.balance.findMany({
      where: { userId },
      orderBy: [{ date: "desc" }],
      take: 12,
      select: { id: true, date: true, state: true, amount: true, currency: true, holdingAmount: true, holdingCurrency: true },
    }),
    db.balanceTransaction.findMany({
      where: { userId },
      orderBy: { occurredAt: "desc" },
      take: 12,
      select: { id: true, type: true, occurredAt: true, holdingNet: true, holdingCurrency: true, issuedNet: true, issuedCurrency: true },
    }),
    db.payout.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, status: true, amount: true, currency: true, method: true, provider: true, scheduledDate: true, createdAt: true },
    }),
  ]);

  return { balances, transactions, payouts };
}

export async function lireCommissions(userId: string): Promise<CommissionDashboard[]> {
  return db.commission.findMany({
    where: { OR: [{ sellerId: userId }, { buyerId: userId }] },
    orderBy: { createdAt: "desc" },
    select: { id: true, sellerId: true, buyerId: true, productId: true, status: true, depositAmount: true, completionAmount: true, brief: true, createdAt: true },
  });
}
