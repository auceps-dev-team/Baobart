import "server-only";

import type { EtatContenu } from "@/lib/cms/cycle";
import { db } from "@/lib/db";

/**
 * Ce qu'on lit du blog.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX LECTURES QUI NE SE MÉLANGENT PAS
 *
 * L'administration voit tout — brouillons compris — parce que c'est l'écran
 * depuis lequel on travaille. Le public ne voit que `PUBLIE`, et la clause qui
 * le dit vit à un seul endroit.
 *
 * Écrire `state === "PUBLIE"` à la main dans une requête est exactement ce
 * qui, un jour, laissera fuir un brouillon. C'est la même leçon que pour les
 * événements et les offres d'emploi.
 */

export interface LigneAdmin {
  id: string;
  titre: string;
  slug: string;
  etat: EtatContenu;
  categorie: string | null;
  aLaUne: boolean;
  vues: number;
  publieLe: Date | null;
  /** Renseignée sur un brouillon qui paraîtra tout seul. */
  parutionPrevue: Date | null;
  modifieLe: Date;
  auteur: string;
}

export interface ArticleAEditer {
  id: string;
  titre: string;
  slug: string;
  corps: string;
  extrait: string | null;
  categorieId: string | null;
  couvertureUrl: string | null;
  seoTitre: string | null;
  seoDescription: string | null;
  urlCanonique: string | null;
  aLaUne: boolean;
  etat: EtatContenu;
  raisonRefus: string | null;
  publieLe: Date | null;
  parutionPrevue: Date | null;
  vues: number;
}

/** Tous les articles, du plus récemment touché au plus ancien. */
export async function listerPourAdministration(
  limite = 100,
): Promise<LigneAdmin[]> {
  const lignes = await db.blogPost.findMany({
    // `updatedAt` et non `createdAt` : l'écran sert à reprendre ce qu'on
    // travaille. Un brouillon écrit il y a six mois et corrigé ce matin doit
    // remonter.
    orderBy: { updatedAt: "desc" },
    take: Math.min(limite, 300),
    select: {
      id: true,
      title: true,
      slug: true,
      state: true,
      isFeatured: true,
      viewsCount: true,
      publishedAt: true,
      scheduledAt: true,
      updatedAt: true,
      category: { select: { name: true } },
      author: {
        select: { email: true, profile: { select: { displayName: true } } },
      },
    },
  });

  return lignes.map((a) => ({
    id: a.id,
    titre: a.title,
    slug: a.slug,
    etat: a.state,
    categorie: a.category?.name ?? null,
    aLaUne: a.isFeatured,
    vues: a.viewsCount,
    publieLe: a.publishedAt,
    parutionPrevue: a.scheduledAt,
    modifieLe: a.updatedAt,
    auteur: a.author.profile?.displayName ?? a.author.email,
  }));
}

/** Un article, pour l'écran d'édition. `null` s'il n'existe plus. */
export async function articleAEditer(
  id: string,
): Promise<ArticleAEditer | null> {
  const a = await db.blogPost.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      body: true,
      excerpt: true,
      categoryId: true,
      coverUrl: true,
      seoTitle: true,
      seoDescription: true,
      canonicalUrl: true,
      isFeatured: true,
      state: true,
      refusedReason: true,
      publishedAt: true,
      scheduledAt: true,
      viewsCount: true,
    },
  });

  if (!a) return null;

  return {
    id: a.id,
    titre: a.title,
    slug: a.slug,
    corps: a.body,
    extrait: a.excerpt,
    categorieId: a.categoryId,
    couvertureUrl: a.coverUrl,
    seoTitre: a.seoTitle,
    seoDescription: a.seoDescription,
    urlCanonique: a.canonicalUrl,
    aLaUne: a.isFeatured,
    etat: a.state,
    raisonRefus: a.refusedReason,
    publieLe: a.publishedAt,
    parutionPrevue: a.scheduledAt,
    vues: a.viewsCount,
  };
}

// ══════════════════════════════════════════════════════════ lecture publique ══

/**
 * La seule clause de visibilité publique, et elle vit ici.
 *
 * Une seule condition — l'état. Contrairement aux offres d'emploi, un article
 * n'expire pas : on vient lire ce qui a été écrit, même vieux d'un an.
 */
const CLAUSE_PUBLIQUE = { state: "PUBLIE" } as const;

const SELECTION_PUBLIQUE = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  body: true,
  coverUrl: true,
  seoTitle: true,
  seoDescription: true,
  canonicalUrl: true,
  isFeatured: true,
  publishedAt: true,
  viewsCount: true,
  category: { select: { name: true, slug: true } },
  author: {
    select: {
      email: true,
      profile: { select: { displayName: true, username: true } },
    },
  },
} as const;

export interface ArticlePublic {
  id: string;
  titre: string;
  slug: string;
  extrait: string;
  corps: string;
  couvertureUrl: string | null;
  seoTitre: string | null;
  seoDescription: string | null;
  urlCanonique: string | null;
  aLaUne: boolean;
  publieLe: Date | null;
  vues: number;
  categorie: { nom: string; slug: string } | null;
  auteur: string;
  auteurUsername: string | null;
}

type LignePublique = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  coverUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  isFeatured: boolean;
  publishedAt: Date | null;
  viewsCount: number;
  category: { name: string; slug: string } | null;
  author: {
    email: string;
    profile: { displayName: string; username: string | null } | null;
  };
};

function versPublic(a: LignePublique): ArticlePublic {
  return {
    id: a.id,
    titre: a.title,
    slug: a.slug,
    // `excerpt` ne devrait jamais être nul — la validation le déduit du corps
    // quand l'auteur n'en écrit pas. La colonne reste facultative pour
    // pouvoir changer cette déduction sans migrer, d'où ce repli.
    extrait: a.excerpt ?? "",
    corps: a.body,
    couvertureUrl: a.coverUrl,
    seoTitre: a.seoTitle,
    seoDescription: a.seoDescription,
    urlCanonique: a.canonicalUrl,
    aLaUne: a.isFeatured,
    publieLe: a.publishedAt,
    vues: a.viewsCount,
    categorie: a.category ? { nom: a.category.name, slug: a.category.slug } : null,
    auteur: a.author.profile?.displayName ?? a.author.email,
    auteurUsername: a.author.profile?.username ?? null,
  };
}

/**
 * Les articles publiés, du plus récent au plus ancien.
 *
 * Trié par `publishedAt`, jamais par `updatedAt` : corriger une faute dans un
 * article de mars ne doit pas le remettre en tête comme s'il était neuf.
 */
export async function listerPublics(input: {
  categorie?: string;
  limite?: number;
} = {}): Promise<ArticlePublic[]> {
  const lignes = await db.blogPost.findMany({
    where: {
      ...CLAUSE_PUBLIQUE,
      ...(input.categorie ? { category: { slug: input.categorie } } : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: Math.min(input.limite ?? 30, 100),
    select: SELECTION_PUBLIQUE,
  });

  return lignes.map(versPublic);
}

/**
 * Celui qu'on met en tête de page.
 *
 * Le plus récent parmi ceux marqués « à la une ». Quand aucun ne l'est, on
 * prend le plus récent tout court : un bandeau vide vaut moins qu'un bandeau
 * qui annonce le dernier article.
 */
export async function articleALaUne(): Promise<ArticlePublic | null> {
  const a =
    (await db.blogPost.findFirst({
      where: { ...CLAUSE_PUBLIQUE, isFeatured: true },
      orderBy: { publishedAt: "desc" },
      select: SELECTION_PUBLIQUE,
    })) ??
    (await db.blogPost.findFirst({
      where: CLAUSE_PUBLIQUE,
      orderBy: { publishedAt: "desc" },
      select: SELECTION_PUBLIQUE,
    }));

  return a ? versPublic(a) : null;
}

/** Un article par son adresse, s'il est public. `null` autrement. */
export async function articlePublic(slug: string): Promise<ArticlePublic | null> {
  const a = await db.blogPost.findFirst({
    where: { slug, ...CLAUSE_PUBLIQUE },
    select: SELECTION_PUBLIQUE,
  });

  return a ? versPublic(a) : null;
}

/**
 * Les rubriques qui ont au moins un article publié.
 *
 * Une rubrique vide dans un filtre promet une page vide. On ne les montre donc
 * pas — et l'on ne les supprime pas non plus : elle se remplira.
 */
export async function categoriesPubliques(): Promise<
  { nom: string; slug: string; combien: number }[]
> {
  const lignes = await db.blogCategory.findMany({
    orderBy: { name: "asc" },
    select: {
      name: true,
      slug: true,
      _count: { select: { posts: { where: CLAUSE_PUBLIQUE } } },
    },
  });

  return lignes
    .filter((c) => c._count.posts > 0)
    .map((c) => ({ nom: c.name, slug: c.slug, combien: c._count.posts }));
}

/** Toutes les rubriques, pour le formulaire d'édition. */
export async function toutesLesCategories(): Promise<
  { id: string; nom: string }[]
> {
  const lignes = await db.blogCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return lignes.map((c) => ({ id: c.id, nom: c.name }));
}
