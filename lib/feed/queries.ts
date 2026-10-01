import "server-only";

import type {
  Currency,
  ProductFamily,
  ProductType,
} from "@/lib/domain/prisma-types";

import { estOfferte, libelleDuPrix } from "@/lib/commerce/montant";
import { db } from "@/lib/db";
import {
  FAMILLE_PAR_LIBELLE,
  LIBELLE_PAR_FAMILLE,
  type Filtre,
} from "@/lib/feed/types";

export {
  FILTRES,
  type CarteRessource,
  type Filtre,
  type PageFeed,
} from "@/lib/feed/types";

export function familleDepuisLibelle(filtre: Filtre): ProductFamily | null {
  return FAMILLE_PAR_LIBELLE[filtre] ?? null;
}

function clauseFamille(filtre: Filtre) {
  const famille = familleDepuisLibelle(filtre);
  return famille ? { family: famille } : {};
}

const TAILLE_PAGE = 24;

type ProduitFeed = {
  id: string;
  slug: string;
  name: string;
  type: ProductType;
  family: ProductFamily | null;
  price: number;
  pricingMode: "FIXED" | "LIBRE";
  minPrice: number | null;
  currency: Currency;
  coverUrl: string | null;
  /** L'extrait public, quand il existe. Sert d'aperçu de repli sur la carte. */
  previewUrl: string | null;
  previewKind: string | null;
  downloadsCount: number;
  salesCount: number;
  isStaffPicked: boolean;
  createdAt: Date;
  seller: { profile: { displayName: string; username: string | null } | null };
};

type SuggestionProduit = {
  slug: string;
  name: string;
  family: ProductFamily | null;
};

/**
 * Hauteurs de visuel de la mosaïque.
 *
 * Les maquettes font varier la hauteur d'une carte à l'autre : c'est ce qui
 * donne au feed son rythme. On la dérive de l'identifiant plutôt que de la
 * tirer au hasard, pour qu'une carte garde la même hauteur d'un rendu à
 * l'autre — sinon le feed sauterait à chaque rechargement.
 */
const HAUTEURS = [190, 230, 260, 300, 340];

function hauteurPour(id: string): number {
  let somme = 0;
  for (let i = 0; i < id.length; i += 1) somme += id.charCodeAt(i);
  return HAUTEURS[somme % HAUTEURS.length] as number;
}

/**
 * L'extrait, quand les deux colonnes sont cohérentes.
 *
 * `previewUrl` et `previewKind` sont écrites ensemble, mais rien dans le
 * schéma ne l'impose : une URL sans nature ne se saurait pas jouer, et une
 * nature sans URL n'a rien à jouer. On rend `null` plutôt que de deviner.
 */
function extraitDe(
  url: string | null,
  nature: string | null,
): { url: string; nature: "audio" | "video" } | null {
  if (!url || (nature !== "audio" && nature !== "video")) return null;
  return { url, nature };
}

function encoderCurseur(item: { createdAt: Date; id: string }): string {
  return Buffer.from(`${item.createdAt.toISOString()}|${item.id}`).toString(
    "base64url",
  );
}

function decoderCurseur(
  cursor: string,
): { createdAt: Date; id: string } | null {
  try {
    const [iso, id] = Buffer.from(cursor, "base64url").toString().split("|");
    if (!iso || !id) return null;
    const createdAt = new Date(iso);
    return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id };
  } catch {
    return null;
  }
}

export interface ListerFeedInput {
  cursor?: string | null;
  limit?: number;
  filtre?: Filtre;
  /**
   * Ne garder que les ressources d'un créateur.
   *
   * Le profil public s'en sert. Écrire une seconde requête pour lui aurait
   * dupliqué le curseur composite et la forme de sortie — deux endroits où se
   * tromper, et la pagination du profil aurait fini par boucler quand celle de
   * l'explorateur ne bouclait plus.
   */
  auteurId?: string;
}

export async function listerFeed(
  input: ListerFeedInput = {},
): Promise<import("@/lib/feed/types").PageFeed> {
  const { cursor = null, limit = TAILLE_PAGE, filtre = "Tous", auteurId } = input;

  const position = cursor ? decoderCurseur(cursor) : null;

  // Curseur composite : on prend ce qui est strictement plus ancien, et à
  // égalité de date on départage par identifiant. Sans ce départage, deux
  // produits créés dans la même milliseconde feraient boucler la pagination.
  const apres = position
    ? {
        OR: [
          { createdAt: { lt: position.createdAt } },
          {
            createdAt: position.createdAt,
            id: { lt: position.id },
          },
        ],
      }
    : {};

  const lignes: ProduitFeed[] = await db.product.findMany({
    where: {
      status: "PUBLISHED",
      ...(auteurId ? { sellerId: auteurId } : {}),
      ...clauseFamille(filtre),
      ...apres,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    // Un de plus que demandé : sa seule présence dit qu'il reste une page,
    // sans avoir à compter le total.
    take: limit + 1,
    select: {
      id: true,
      slug: true,
      name: true,
      type: true,
      family: true,
      price: true,
      pricingMode: true,
      minPrice: true,
      currency: true,
      coverUrl: true,
      previewUrl: true,
      previewKind: true,
      downloadsCount: true,
      salesCount: true,
      isStaffPicked: true,
      createdAt: true,
      seller: {
        select: { profile: { select: { displayName: true, username: true } } },
      },
    },
  });

  const aUneSuite = lignes.length > limit;
  const page = aUneSuite ? lignes.slice(0, limit) : lignes;

  return {
    items: page.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.name,
      author: p.seller.profile?.displayName ?? "Créateur Baobart",
      authorUsername: p.seller.profile?.username ?? null,
      type: p.type,
      famille: p.family ? LIBELLE_PAR_FAMILLE[p.family] : null,
      price: p.price,
      currency: p.currency,
      prixAffiche: libelleDuPrix(p),
      offerte: estOfferte(p),
      coverUrl: p.coverUrl,

      extrait: extraitDe(p.previewUrl, p.previewKind),
      downloadsCount: p.downloadsCount,
      salesCount: p.salesCount,
      visualHeight: hauteurPour(p.id),
      isStaffPicked: p.isStaffPicked,
      createdAt: p.createdAt,
    })),
    nextCursor: aUneSuite ? encoderCurseur(page[page.length - 1]!) : null,
  };
}

/**
 * Les deux cartes mises en avant, au-dessus de la mosaïque.
 * Ce sont les produits de la sélection éditoriale (§3.10-A) — la porte
 * d'entrée qui ne dépend pas d'avoir déjà vendu.
 */
export async function listerAlaUne(
  limit = 2,
): Promise<import("@/lib/feed/types").CarteRessource[]> {
  const lignes: ProduitFeed[] = await db.product.findMany({
    where: { status: "PUBLISHED", isStaffPicked: true },
    orderBy: [{ staffPickedAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      slug: true,
      name: true,
      type: true,
      family: true,
      price: true,
      pricingMode: true,
      minPrice: true,
      currency: true,
      coverUrl: true,
      previewUrl: true,
      previewKind: true,
      downloadsCount: true,
      salesCount: true,
      isStaffPicked: true,
      createdAt: true,
      seller: {
        select: { profile: { select: { displayName: true, username: true } } },
      },
    },
  });

  return lignes.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.name,
    author: p.seller.profile?.displayName ?? "Créateur Baobart",
    authorUsername: p.seller.profile?.username ?? null,
    type: p.type,
    famille: p.family ? LIBELLE_PAR_FAMILLE[p.family] : null,
    price: p.price,
    currency: p.currency,
    prixAffiche: libelleDuPrix(p),
    offerte: estOfferte(p),
    coverUrl: p.coverUrl,

    extrait: extraitDe(p.previewUrl, p.previewKind),
    downloadsCount: p.downloadsCount,
    salesCount: p.salesCount,
    visualHeight: 280,
    isStaffPicked: p.isStaffPicked,
    createdAt: p.createdAt,
  }));
}

/** Compteur affiché à droite du sélecteur de cartes. */
export async function compterRessources(filtre: Filtre = "Tous") {
  return db.product.count({
    where: { status: "PUBLISHED", ...clauseFamille(filtre) },
  });
}

/**
 * Suggestions du champ de recherche.
 *
 * La maquette filtrait un tableau en dur ; ici on interroge la base. Recherche
 * insensible à la casse sur le titre, limitée à cinq résultats — le nombre
 * qu'affiche le panneau de la maquette.
 */
export async function rechercher(q: string) {
  const terme = q.trim();
  if (terme.length === 0) return [];

  const lignes: SuggestionProduit[] = await db.product.findMany({
    where: {
      status: "PUBLISHED",
      name: { contains: terme, mode: "insensitive" },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 5,
    select: { slug: true, name: true, family: true },
  });

  return lignes.map((p) => ({
    slug: p.slug,
    title: p.name,
    famille: p.family ? LIBELLE_PAR_FAMILLE[p.family] : null,
  }));
}

/** Compte réel de ressources publiées par famille — pour la grille « Gratuit, tout de suite ». */
export async function compterParFamille() {
  const groupes = await db.product.groupBy({
    by: ["family"],
    where: { status: "PUBLISHED", family: { not: null } },
    _count: { _all: true },
  });

  return groupes
    .filter((g) => g.family !== null)
    .map((g) => ({
      famille: LIBELLE_PAR_FAMILLE[g.family as ProductFamily],
      total: g._count._all,
    }))
    .sort((a, b) => b.total - a.total);
}

/** Créateurs à suivre, pour le bloc « Créatifs à suivre » des espaces d'équipe. */
export async function listerCreateurs(limit = 3) {
  const profils: Array<{ username: string; displayName: string; city: string | null }> = await db.profile.findMany({
    orderBy: [{ workCount: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: { username: true, displayName: true, city: true },
  });

  return profils.map((p) => ({
    username: p.username,
    nom: p.displayName,
    lieu: p.city,
  }));
}

/**
 * Chiffres de preuve sociale du hero.
 *
 * Comptés en base plutôt qu'écrits en dur : la maquette annonçait
 * « 170+ ressources · 12 400 créatifs · 4.9 », des nombres qu'on n'a pas encore.
 * Afficher une note de satisfaction sans le moindre avis serait un mensonge —
 * elle vaut donc `null` tant que personne n'a noté, et le bloc la masque.
 */
export async function compterCommunaute() {
  const [ressources, createurs, notes] = await Promise.all([
    db.product.count({ where: { status: "PUBLISHED" } }),
    db.profile.count(),
    db.profile.aggregate({
      where: { ratingCount: { gt: 0 } },
      _avg: { ratingAvg: true },
      _count: { _all: true },
    }),
  ]);

  return {
    ressources,
    createurs,
    note:
      notes._count._all > 0 && notes._avg.ratingAvg
        ? Number(notes._avg.ratingAvg)
        : null,
  };
}
