import "server-only";

import {
  licenceCommerciale,
  ordreBibliotheque,
  resteAToi,
} from "@/lib/dashboard/bibliotheque-regles";
import { ETATS_ABOUTIS, formatsLisibles } from "@/lib/dashboard/historique";
import { db } from "@/lib/db";

/**
 * « Ma bibliothèque » : ce que l'acheteur possède. Les règles et la raison
 * d'être : `lib/dashboard/bibliotheque-regles.ts`.
 *
 * Ce que l'écran ne montre pas, et pourquoi : les ressources offertes ou
 * prises sous un forfait. Elles ne laissent aucune ligne d'achat — seulement
 * un retrait dans `ConsumptionEvent` — et l'historique des téléchargements
 * les liste déjà. La maquette les mêle (« PASS EXPIRÉ ») ; les y ajouter
 * demanderait de décider ce qu'un forfait laisse « pour toujours », ce que le
 * code ne tranche pas encore.
 */

export interface RessourcePossedee {
  orderItemId: string;
  produitId: string;
  slug: string;
  titre: string;
  auteur: string;
  couverture: string | null;
  formats: string;
  octets: number | null;
  fichiers: Array<{ id: string; nom: string; externe: boolean }>;
  licence: string;
  commerciale: boolean;
  acheteLe: Date;
  retraits: number;
  dernierRetrait: Date | null;
}

export interface Bibliotheque {
  ressources: RessourcePossedee[];
  jamaisRetirees: number;
  /** La somme des poids connus ; les liens externes n'en ont pas. */
  octets: number;
  commerciales: number;
}

/** Le libellé de la fiche quand le créateur n'a pas choisi (`lib/products/queries.ts`). */
const LICENCE_PAR_DEFAUT = "Licence commerciale";

export async function bibliothequeDe(userId: string): Promise<Bibliotheque> {
  const lignes = await db.orderItem.findMany({
    where: { order: { buyerId: userId }, state: { in: [...ETATS_ABOUTIS] } },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      createdAt: true,
      price: true,
      quantity: true,
      tipAmount: true,
      refundedAmount: true,
      chargebackAt: true,
      chargebackReversedAt: true,
      accessRevokedAt: true,
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          coverUrl: true,
          licenseType: { select: { code: true, title: true } },
          // Le nom public seulement : l'adresse du vendeur n'a rien à faire
          // chez ses acheteurs.
          seller: { select: { profile: { select: { displayName: true } } } },
          files: {
            where: { role: "SOURCE", deletedAt: null },
            orderBy: { position: "asc" },
            select: { id: true, filename: true, sizeBytes: true, externalUrl: true },
          },
        },
      },
    },
  });

  // Une ressource, une entrée : la plus récente des lignes qui la laissent à
  // l'acheteur. Racheter après un remboursement est possible, et deux lignes
  // pour un même titre feraient croire qu'il le possède deux fois.
  const parProduit = new Map<string, (typeof lignes)[number]>();
  for (const l of lignes) {
    if (!resteAToi(l) || parProduit.has(l.product.id)) continue;
    parProduit.set(l.product.id, l);
  }

  const ids = [...parProduit.keys()];
  const retraits = ids.length
    ? await db.consumptionEvent.groupBy({
        by: ["productId"],
        where: { userId, productId: { in: ids } },
        _count: { _all: true },
        _max: { consumedAt: true },
      })
    : [];
  const retraitsPar = new Map(retraits.map((r) => [r.productId, r]));

  const ressources: RessourcePossedee[] = [...parProduit.values()].map((l) => {
    const p = l.product;
    const r = retraitsPar.get(p.id);
    const poids = p.files.reduce((s, f) => s + (f.sizeBytes ?? 0), 0);
    return {
      orderItemId: l.id,
      produitId: p.id,
      slug: p.slug,
      titre: p.name,
      auteur: p.seller.profile?.displayName ?? "un créateur",
      couverture: p.coverUrl,
      formats: formatsLisibles(p.files.map((f) => f.filename)),
      octets: poids > 0 ? poids : null,
      fichiers: p.files.map((f) => ({ id: f.id, nom: f.filename, externe: f.externalUrl !== null })),
      licence: p.licenseType?.title ?? LICENCE_PAR_DEFAUT,
      commerciale: licenceCommerciale(p.licenseType?.code ?? null),
      acheteLe: l.createdAt,
      retraits: r?._count._all ?? 0,
      dernierRetrait: r?._max.consumedAt ?? null,
    };
  });

  ressources.sort(ordreBibliotheque);

  return {
    ressources,
    jamaisRetirees: ressources.filter((r) => r.dernierRetrait === null).length,
    octets: ressources.reduce((s, r) => s + (r.octets ?? 0), 0),
    commerciales: ressources.filter((r) => r.commerciale).length,
  };
}
