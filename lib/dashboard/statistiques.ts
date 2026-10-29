import "server-only";

import { debutDuMois, serieMensuelle, type Barre } from "@/lib/dashboard/mois";
import { db } from "@/lib/db";

/**
 * « Statistiques » de `Baobart Dashboard.dc.html`, avec ce qui se mesure.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES VUES DE FICHES NE SONT PAS COMPTÉES
 *
 * La maquette ouvre sur « Vues de fiches » et trace des vues par mois. Mesuré
 * le 27/10 : `ConsumptionType` déclare `VIEW`, mais aucun code ne l'écrit, et
 * la base de développement ne contient que des `DOWNLOAD`. Seule la vitrine a
 * un compteur (`Profile.viewCount`, depuis le 16/10), cumulé, sans date.
 *
 * On montre donc ce qui est daté : les téléchargements (`consumedAt`), les
 * ventes, les nouveaux abonnés (`Follow.createdAt`). La courbe est celle des
 * téléchargements, et elle le dit dans son titre.
 */

export interface StatistiquesCreateur {
  vuesVitrine: number;
  telechargements: number;
  telechargementsMois: number;
  ventes: number;
  ventesMois: number;
  abonnes: number;
  nouveauxAbonnes: number;
  parMois: Barre[];
  meilleures: Array<{ id: string; nom: string; couverture: string | null; ventes: number; telechargements: number }>;
}

export async function statistiquesCreateur(userId: string, maintenant = new Date()): Promise<StatistiquesCreateur> {
  const ceMois = debutDuMois(maintenant);
  const depuis = debutDuMois(maintenant, -5);
  const deSesRessources = { product: { sellerId: userId } };
  // `ConsumptionEvent` n'a pas de relation `product` dans le schéma, seulement
  // `productId` : on filtre par la liste. Mesuré le 27/10 — le filtre partagé
  // avec `orderItem` passait les types (étalé) et levait à l'exécution.
  const ids = (await db.product.findMany({ where: { sellerId: userId }, select: { id: true } })).map((p) => p.id);
  const telecharges = { productId: { in: ids }, eventType: { in: ["DOWNLOAD", "DOWNLOAD_ALL", "FOLDER_DOWNLOAD"] as const } };

  const [profil, telechargements, telechargementsMois, ventes, ventesMois, nouveauxAbonnes, parMois, meilleures] = await Promise.all([
    db.profile.findUnique({ where: { userId }, select: { viewCount: true, followerCount: true } }),
    db.consumptionEvent.count({ where: { ...telecharges, eventType: { in: [...telecharges.eventType.in] } } }),
    db.consumptionEvent.count({ where: { ...telecharges, eventType: { in: [...telecharges.eventType.in] }, consumedAt: { gte: ceMois } } }),
    db.orderItem.count({ where: { ...deSesRessources, state: { in: ["SUCCESSFUL", "NOT_CHARGED"] } } }),
    db.orderItem.count({ where: { ...deSesRessources, state: { in: ["SUCCESSFUL", "NOT_CHARGED"] }, createdAt: { gte: ceMois } } }),
    db.follow.count({ where: { followingId: userId, createdAt: { gte: ceMois } } }),
    db.$queryRaw<Array<{ mois: string; montant: bigint | number }>>`
      SELECT to_char(date_trunc('month', e."consumedAt"), 'YYYY-MM') AS mois, COUNT(*) AS montant
      FROM "ConsumptionEvent" e
      JOIN "Product" p ON p."id" = e."productId"
      WHERE p."sellerId" = ${userId}
        AND e."eventType"::text IN ('DOWNLOAD', 'DOWNLOAD_ALL', 'FOLDER_DOWNLOAD')
        AND e."consumedAt" >= ${depuis}
      GROUP BY 1`,
    db.product.findMany({
      where: { sellerId: userId, OR: [{ salesCount: { gt: 0 } }, { downloadsCount: { gt: 0 } }] },
      orderBy: [{ salesCount: "desc" }, { downloadsCount: "desc" }, { createdAt: "desc" }],
      take: 3,
      select: { id: true, name: true, coverUrl: true, salesCount: true, downloadsCount: true },
    }),
  ]);

  return {
    vuesVitrine: profil?.viewCount ?? 0,
    telechargements,
    telechargementsMois,
    ventes,
    ventesMois,
    abonnes: profil?.followerCount ?? 0,
    nouveauxAbonnes,
    parMois: serieMensuelle(parMois.map((l) => ({ mois: l.mois, montant: Number(l.montant) })), maintenant),
    meilleures: meilleures.map((p) => ({ id: p.id, nom: p.name, couverture: p.coverUrl, ventes: p.salesCount, telechargements: p.downloadsCount })),
  };
}
