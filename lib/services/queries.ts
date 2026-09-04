import "server-only";

import { db } from "@/lib/db";

/**
 * Ce que le public voit du CMS Services.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE SEULE CLAUSE DE VISIBILITÉ, ET ELLE VIT ICI
 *
 * Voir un service ne demande rien : ni compte, ni abonnement. Publier en
 * demande trois (§18.3) — mais côté lecture, la seule règle est l'état
 * `PUBLIE`. C'est aussi ce qui garantit qu'un abonnement suspendu ne casse pas
 * les fiches déjà publiées : la lecture ne consulte pas l'abonnement du
 * créateur.
 */

export interface CategorieChoix {
  id: string;
  slug: string;
  name: string;
}

export interface OffreEnListe {
  id: string;
  titre: string;
  extrait: string;
  categorie: CategorieChoix;
  prixDeDepart: number;
  devise: string;
  delaiJours: number;
  publieeLe: Date;
  miseEnAvant: boolean;
  ratingAvg: number;
  ratingCount: number;
  createur: string;
  createurUsername: string | null;
}

export interface OffreComplete extends OffreEnListe {
  description: string;
  createurEmail: string;
  createurId: string;
}

/**
 * Les catégories actives, dans l'ordre choisi par l'administration.
 *
 * Publier les inactives serait offrir à un créateur de déposer dans une
 * catégorie retirée — et à un lecteur de filtrer sur une case vide.
 */
export async function categoriesPourChoix(): Promise<CategorieChoix[]> {
  const lignes = await db.serviceCategory.findMany({
    where: { isActive: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, name: true },
  });
  return lignes;
}

/**
 * Une catégorie par son slug, si elle est active.
 *
 * `null` autrement : passer par le slug d'une catégorie retirée doit rendre
 * la même chose qu'un slug inconnu.
 */
export async function categorieParSlug(
  slug: string,
): Promise<CategorieChoix | null> {
  return db.serviceCategory.findFirst({
    where: { slug, isActive: true },
    select: { id: true, slug: true, name: true },
  });
}

/**
 * Les services visibles, éventuellement filtrés par catégorie.
 *
 * ─────────────────────────────────────────────────────────────────
 * LES MISES EN AVANT D'ABORD, PUIS LES PLUS RÉCENTES
 *
 * Comme Jobs. Une place payante passe devant, mais à égalité c'est la
 * fraîcheur qui décide — un annuaire où l'argent seul ordonne cesse d'être
 * consulté.
 */
export async function listerOffres(input: {
  categoryId?: string;
  limite?: number;
} = {}): Promise<OffreEnListe[]> {
  const lignes = await db.serviceOffer.findMany({
    where: {
      state: "PUBLIE",
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    take: Math.min(input.limite ?? 40, 100),
    select: {
      id: true,
      title: true,
      description: true,
      startingPrice: true,
      currency: true,
      deliveryDays: true,
      isFeatured: true,
      ratingAvg: true,
      ratingCount: true,
      createdAt: true,
      category: { select: { id: true, slug: true, name: true } },
      creator: {
        select: {
          profile: { select: { displayName: true, username: true } },
          email: true,
        },
      },
    },
  });

  return lignes.map((o) => ({
    id: o.id,
    titre: o.title,
    extrait: o.description.slice(0, 200),
    categorie: o.category,
    prixDeDepart: o.startingPrice,
    devise: o.currency,
    delaiJours: o.deliveryDays,
    publieeLe: o.createdAt,
    miseEnAvant: o.isFeatured,
    ratingAvg: Number(o.ratingAvg),
    ratingCount: o.ratingCount,
    createur: o.creator.profile?.displayName ?? o.creator.email,
    createurUsername: o.creator.profile?.username ?? null,
  }));
}

/** Une fiche, si elle est publique. Rend `null` autrement. */
export async function offrePublique(id: string): Promise<OffreComplete | null> {
  const o = await db.serviceOffer.findFirst({
    where: { id, state: "PUBLIE" },
    select: {
      id: true,
      title: true,
      description: true,
      startingPrice: true,
      currency: true,
      deliveryDays: true,
      isFeatured: true,
      ratingAvg: true,
      ratingCount: true,
      createdAt: true,
      creatorId: true,
      category: { select: { id: true, slug: true, name: true } },
      creator: {
        select: {
          email: true,
          profile: { select: { displayName: true, username: true } },
        },
      },
    },
  });

  if (!o) return null;

  return {
    id: o.id,
    titre: o.title,
    extrait: o.description.slice(0, 200),
    description: o.description,
    categorie: o.category,
    prixDeDepart: o.startingPrice,
    devise: o.currency,
    delaiJours: o.deliveryDays,
    publieeLe: o.createdAt,
    miseEnAvant: o.isFeatured,
    ratingAvg: Number(o.ratingAvg),
    ratingCount: o.ratingCount,
    createur: o.creator.profile?.displayName ?? o.creator.email,
    createurUsername: o.creator.profile?.username ?? null,
    createurEmail: o.creator.email,
    createurId: o.creatorId,
  };
}
