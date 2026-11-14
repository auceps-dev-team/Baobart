import "server-only";

import { Prisma } from "@prisma/client";

import { BON_PUBLIC_AVIS } from "@/lib/badges/merites";
import { aObtenu, resumeDesNotes, type Resume } from "@/lib/avis/regles";
import { AVIS_COMPTE } from "@/lib/avis/recompte";
import { db } from "@/lib/db";

/**
 * Ce que les écrans lisent des avis : la fiche d'une ressource, et la boîte
 * de son créateur (`/dashboard/avis`).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON N'AFFICHE QUE CE QUI COMPTE
 *
 * Un avis sorti des comptes (remboursé, litige, accès retiré) ne s'affiche plus
 * en public : la note dit « 4,6 sur 12 avis », et la liste doit montrer ces
 * douze-là, pas un treizième que la note ignore. Son auteur, lui, le revoit
 * dans son formulaire, avec la raison (décision du 09/11).
 */

/** Combien d'avis s'affichent sur une fiche. Le reste viendra avec une pagination. */
const AVIS_PAR_FICHE = 50;

export interface AvisAffiche {
  id: string;
  note: number;
  texte: string | null;
  le: Date;
  auteur: {
    nom: string;
    username: string | null;
    avatarUrl: string | null;
    /** « Bon public » : le seul mérite qui s'affiche à côté d'un avis (maquette des badges). */
    bonPublic: boolean;
  };
  reponse: { texte: string; le: Date } | null;
}

export interface AvisDeLaRessource {
  resume: Resume;
  avis: AvisAffiche[];
  /** L'avis du visiteur, et s'il compte encore. */
  monAvis: { note: number; texte: string | null; compte: boolean } | null;
  peutNoter: boolean;
  estCreateur: boolean;
}

/** Le nom affiché d'un auteur ; un compte effacé n'en a plus. */
function nomDe(auteur: { anonymizedAt: Date | null; profile: { displayName: string } | null }): string {
  if (auteur.anonymizedAt) return "Ancien membre";
  return auteur.profile?.displayName ?? "Membre Baobart";
}

/** Les auteurs, parmi ceux-là, qui portent « Bon public ». */
async function bonsPublics(auteurs: readonly string[]): Promise<Set<string>> {
  if (auteurs.length === 0) return new Set();
  const lignes = await db.$queryRaw<Array<{ auteur: string; n: bigint | number }>>`
    SELECT r."authorId" AS auteur, COUNT(*) AS n
    FROM "ProductReview" r
    JOIN "Product" p ON p."id" = r."productId"
    WHERE r."authorId" IN (${Prisma.join([...auteurs])}) AND ${AVIS_COMPTE}
    GROUP BY r."authorId"`;
  return new Set(lignes.filter((l) => Number(l.n) >= BON_PUBLIC_AVIS).map((l) => l.auteur));
}

const AVEC_AUTEUR = {
  id: true,
  rating: true,
  body: true,
  createdAt: true,
  authorId: true,
  author: { select: { anonymizedAt: true, profile: { select: { displayName: true, username: true, avatarUrl: true } } } },
  response: { select: { body: true, createdAt: true } },
} as const;

type AvisLu = Prisma.ProductReviewGetPayload<{ select: typeof AVEC_AUTEUR }>;

function versAffiche(a: AvisLu, bons: ReadonlySet<string>): AvisAffiche {
  return {
    id: a.id,
    note: a.rating,
    texte: a.body,
    le: a.createdAt,
    auteur: {
      nom: nomDe(a.author),
      username: a.author.anonymizedAt ? null : (a.author.profile?.username ?? null),
      avatarUrl: a.author.anonymizedAt ? null : (a.author.profile?.avatarUrl ?? null),
      bonPublic: bons.has(a.authorId),
    },
    reponse: a.response ? { texte: a.response.body, le: a.response.createdAt } : null,
  };
}

async function idsComptes(where: Prisma.Sql, limite: number): Promise<string[]> {
  const lignes = await db.$queryRaw<Array<{ id: string }>>`
    SELECT r."id"
    FROM "ProductReview" r
    JOIN "Product" p ON p."id" = r."productId"
    WHERE ${where} AND ${AVIS_COMPTE}
    ORDER BY r."createdAt" DESC
    LIMIT ${limite}`;
  return lignes.map((l) => l.id);
}

async function lireDansLOrdre(ids: readonly string[]): Promise<AvisLu[]> {
  if (ids.length === 0) return [];
  const lus = await db.productReview.findMany({ where: { id: { in: [...ids] } }, select: AVEC_AUTEUR });
  const parId = new Map(lus.map((a) => [a.id, a]));
  return ids.map((id) => parId.get(id)).filter((a): a is AvisLu => a !== undefined);
}

export async function avisDeLaRessource(produitId: string, visiteurId: string | null): Promise<AvisDeLaRessource | null> {
  const produit = await db.product.findUnique({ where: { id: produitId }, select: { sellerId: true, ratingStars: true } });
  if (!produit) return null;

  const ids = await idsComptes(Prisma.sql`r."productId" = ${produitId}`, AVIS_PAR_FICHE);
  const lus = await lireDansLOrdre(ids);
  const bons = await bonsPublics([...new Set(lus.map((a) => a.authorId))]);

  let monAvis: AvisDeLaRessource["monAvis"] = null;
  let peutNoter = false;
  const estCreateur = visiteurId !== null && visiteurId === produit.sellerId;
  if (visiteurId && !estCreateur) {
    const [mien, lignes] = await Promise.all([
      db.productReview.findUnique({
        where: { authorId_productId: { authorId: visiteurId, productId: produitId } },
        select: { id: true, rating: true, body: true },
      }),
      db.orderItem.findMany({
        where: { productId: produitId, order: { buyerId: visiteurId } },
        select: { state: true, price: true, quantity: true, tipAmount: true, refundedAmount: true, chargebackAt: true, chargebackReversedAt: true, accessRevokedAt: true },
      }),
    ]);
    peutNoter = aObtenu(lignes);
    if (mien) {
      const compte = (await idsComptes(Prisma.sql`r."id" = ${mien.id}`, 1)).length === 1;
      monAvis = { note: mien.rating, texte: mien.body, compte };
    }
  }

  return { resume: resumeDesNotes(produit.ratingStars), avis: lus.map((a) => versAffiche(a, bons)), monAvis, peutNoter, estCreateur };
}

export type FiltreAvis = "tous" | "sans-reponse" | "cinq" | "bas";

/** Les filtres de la maquette (`c_avis`), dans son ordre. */
export const FILTRES_AVIS: ReadonlyArray<{ cle: FiltreAvis; libelle: string }> = [
  { cle: "tous", libelle: "Tous" },
  { cle: "sans-reponse", libelle: "Sans réponse" },
  { cle: "cinq", libelle: "5 étoiles" },
  { cle: "bas", libelle: "≤ 3 étoiles" },
];

export interface AvisRecu extends AvisAffiche {
  ressource: { nom: string; slug: string };
}

/** Les avis comptés reçus par un créateur, filtrés comme la maquette les filtre. */
export async function avisRecus(vendeurId: string, filtre: FiltreAvis): Promise<{ avis: AvisRecu[]; total: number; sansReponse: number }> {
  const condition = {
    tous: Prisma.sql`TRUE`,
    "sans-reponse": Prisma.sql`NOT EXISTS (SELECT 1 FROM "ProductReviewResponse" rr WHERE rr."reviewId" = r."id")`,
    cinq: Prisma.sql`r."rating" = 5`,
    bas: Prisma.sql`r."rating" <= 3`,
  }[filtre];

  const [ids, [compte]] = await Promise.all([
    idsComptes(Prisma.sql`p."sellerId" = ${vendeurId} AND ${condition}`, 100),
    db.$queryRaw<Array<{ total: bigint | number; sans: bigint | number }>>`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "ProductReviewResponse" rr WHERE rr."reviewId" = r."id")) AS sans
      FROM "ProductReview" r
      JOIN "Product" p ON p."id" = r."productId"
      WHERE p."sellerId" = ${vendeurId} AND ${AVIS_COMPTE}`,
  ]);

  const lus = await lireDansLOrdre(ids);
  const produits = await db.product.findMany({
    where: { reviews: { some: { id: { in: [...ids] } } } },
    select: { id: true, name: true, slug: true, reviews: { where: { id: { in: [...ids] } }, select: { id: true } } },
  });
  const ressourceDe = new Map<string, { nom: string; slug: string }>();
  for (const p of produits) for (const r of p.reviews) ressourceDe.set(r.id, { nom: p.name, slug: p.slug });
  const bons = await bonsPublics([...new Set(lus.map((a) => a.authorId))]);

  return {
    avis: lus.map((a) => ({ ...versAffiche(a, bons), ressource: ressourceDe.get(a.id)! })),
    total: Number(compte?.total ?? 0),
    sansReponse: Number(compte?.sans ?? 0),
  };
}
