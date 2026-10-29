import "server-only";

import type { Currency } from "@prisma/client";

import { debutDuMois, serieMensuelle, type Barre } from "@/lib/dashboard/mois";
import { db } from "@/lib/db";

/**
 * « Aperçu » acheteur de `Baobart Dashboard.dc.html` : ton activité du mois.
 *
 * Tout est daté ici : les téléchargements (`ConsumptionEvent.consumedAt`), les
 * achats (`Order.createdAt`, commandes abouties), les collections
 * (`Board.createdAt`), les créateurs suivis (`Follow.createdAt`). La maquette
 * parle de collections « partagées » avec une équipe : ce partage n'existe
 * pas — on compte les collections publiques.
 */

export interface ApercuAcheteur {
  telechargementsMois: number;
  quota: { utilise: number; limite: number } | null;
  achats: number;
  achatsMois: number;
  collections: number;
  collectionsPubliques: number;
  suivis: number;
  suivisMois: number;
  parMois: Barre[];
  recents: Array<{ id: string; slug: string; nom: string; couverture: string | null; quand: Date; prix: number; devise: Currency; achete: boolean }>;
}

const TELECHARGEMENTS = ["DOWNLOAD", "DOWNLOAD_ALL", "FOLDER_DOWNLOAD"] as const;

export async function apercuAcheteur(userId: string, maintenant = new Date()): Promise<ApercuAcheteur> {
  const ceMois = debutDuMois(maintenant);
  const depuis = debutDuMois(maintenant, -5);
  const telecharges = { userId, eventType: { in: [...TELECHARGEMENTS] } };

  const [telechargementsMois, abonnement, achats, achatsMois, collections, collectionsPubliques, suivis, suivisMois, parMois, derniers] = await Promise.all([
    db.consumptionEvent.count({ where: { ...telecharges, consumedAt: { gte: ceMois } } }),
    db.subscription.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: { quotas: { orderBy: { period: "desc" }, take: 1, select: { used: true, limit: true } } },
    }),
    db.order.count({ where: { buyerId: userId, status: "COMPLETED" } }),
    db.order.count({ where: { buyerId: userId, status: "COMPLETED", createdAt: { gte: ceMois } } }),
    db.board.count({ where: { ownerId: userId } }),
    db.board.count({ where: { ownerId: userId, isPublic: true } }),
    db.follow.count({ where: { followerId: userId } }),
    db.follow.count({ where: { followerId: userId, createdAt: { gte: ceMois } } }),
    db.$queryRaw<Array<{ mois: string; montant: bigint | number }>>`
      SELECT to_char(date_trunc('month', "consumedAt"), 'YYYY-MM') AS mois, COUNT(*) AS montant
      FROM "ConsumptionEvent"
      WHERE "userId" = ${userId}
        AND "eventType"::text IN ('DOWNLOAD', 'DOWNLOAD_ALL', 'FOLDER_DOWNLOAD')
        AND "consumedAt" >= ${depuis}
      GROUP BY 1`,
    db.consumptionEvent.findMany({
      where: telecharges,
      orderBy: { consumedAt: "desc" },
      take: 12,
      select: { id: true, productId: true, orderItemId: true, consumedAt: true },
    }),
  ]);

  // Un produit par ligne, le plus récent d'abord : télécharger trois fois le
  // même pack ne fait pas trois activités.
  const vus = new Set<string>();
  const uniques = derniers.filter((d) => (vus.has(d.productId) ? false : (vus.add(d.productId), true))).slice(0, 4);
  const produits = await db.product.findMany({
    where: { id: { in: uniques.map((u) => u.productId) } },
    select: { id: true, slug: true, name: true, coverUrl: true, price: true, currency: true },
  });
  const parId = new Map(produits.map((p) => [p.id, p]));

  const quota = abonnement?.quotas[0];
  return {
    telechargementsMois,
    quota: quota && quota.limit ? { utilise: quota.used, limite: quota.limit } : null,
    achats,
    achatsMois,
    collections,
    collectionsPubliques,
    suivis,
    suivisMois,
    parMois: serieMensuelle(parMois.map((l) => ({ mois: l.mois, montant: Number(l.montant) })), maintenant),
    recents: uniques.flatMap((u) => {
      const p = parId.get(u.productId);
      return p ? [{ id: u.id, slug: p.slug, nom: p.name, couverture: p.coverUrl, quand: u.consumedAt, prix: p.price, devise: p.currency, achete: u.orderItemId !== null }] : [];
    }),
  };
}
