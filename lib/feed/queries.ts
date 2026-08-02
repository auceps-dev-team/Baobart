/**
 * Lecture du feed.
 *
 * Pagination **par curseur** sur `(createdAt, id)` — jamais d'OFFSET
 * (PLAN §8.2-2). L'index composite existe déjà sur `Product`. C'est ce qui
 * permet au feed masonry de rester rapide quelle que soit la profondeur.
 */

import type { Currency, ProductFamily, ProductType } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * La barre de filtres, dans l'ordre exact des maquettes
 * (« Baobart Accueil.dc.html », constante `FILTERS`).
 */
export const FILTRES = [
  "Tous",
  "Illustration",
  "Photo",
  "Mockup",
  "Font",
  "Icône",
  "Logo",
  "Pack",
  "Art",
  "Audio",
  "Vidéo",
] as const;

export type Filtre = (typeof FILTRES)[number];

/** Libellé affiché → valeur stockée. « Tous » ne filtre rien. */
const FAMILLE_PAR_LIBELLE: Record<Filtre, ProductFamily | null> = {
  Tous: null,
  Illustration: "ILLUSTRATION",
  Photo: "PHOTO",
  Mockup: "MOCKUP",
  Font: "FONT",
  Icône: "ICONE",
  Logo: "LOGO",
  Pack: "PACK",
  Art: "ART",
  Audio: "AUDIO",
  Vidéo: "VIDEO",
};

export function familleDepuisLibelle(filtre: Filtre): ProductFamily | null {
  return FAMILLE_PAR_LIBELLE[filtre] ?? null;
}

function clauseFamille(filtre: Filtre) {
  const famille = familleDepuisLibelle(filtre);
  return famille ? { family: famille } : {};
}

export interface CarteRessource {
  id: string;
  slug: string;
  title: string;
  author: string;
  authorUsername: string | null;
  type: ProductType;
  price: number;
  currency: Currency;
  coverUrl: string | null;
  /** Hauteur du visuel dans la mosaïque — variée pour éviter l'effet damier. */
  visualHeight: number;
  isStaffPicked: boolean;
  createdAt: Date;
}

export interface PageFeed {
  items: CarteRessource[];
  /** Curseur opaque à renvoyer pour la page suivante. `null` = fin du feed. */
  nextCursor: string | null;
}

const TAILLE_PAGE = 24;

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
}

export async function listerFeed(
  input: ListerFeedInput = {},
): Promise<PageFeed> {
  const { cursor = null, limit = TAILLE_PAGE, filtre = "Tous" } = input;

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

  const lignes = await db.product.findMany({
    where: {
      status: "PUBLISHED",
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
      price: true,
      currency: true,
      coverUrl: true,
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
      price: p.price,
      currency: p.currency,
      coverUrl: p.coverUrl,
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
export async function listerAlaUne(limit = 2): Promise<CarteRessource[]> {
  const lignes = await db.product.findMany({
    where: { status: "PUBLISHED", isStaffPicked: true },
    orderBy: [{ staffPickedAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      slug: true,
      name: true,
      type: true,
      price: true,
      currency: true,
      coverUrl: true,
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
    price: p.price,
    currency: p.currency,
    coverUrl: p.coverUrl,
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
