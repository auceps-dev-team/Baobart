import "server-only";

import { consigner, ressource } from "@/lib/admin/audit";
import { annoncerLaDecision } from "@/lib/cms/annonce";
import { appliquer, type Geste } from "@/lib/cms/cycle";
import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";

import { valider, type Refus, type Saisie } from "@/lib/blog/validation";

/**
 * Écrire un article — créer, corriger, publier, refuser, archiver.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA RELECTURE EST OFFERTE, PAS IMPOSÉE
 *
 * §4.3 voulait qu'un second administrateur valide chaque article. §18.1 dit
 * que l'auteur d'un article porte déjà le droit de publier — lui faire
 * traverser une file l'obligerait à s'auto-approuver, c'est-à-dire à faire
 * semblant.
 *
 * Les deux se rejoignent sans qu'on tranche : `BROUILLON → SOUMIS` existe et
 * l'écran l'offre, `BROUILLON → PUBLIE` aussi. Qui veut un second regard le
 * demande ; qui écrit la brève du vendredi ne s'invente pas un relecteur.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE SLUG NE CHANGE PLUS APRÈS LA PREMIÈRE PUBLICATION
 *
 * Même règle que les ressources, et pour la même raison : un lien partagé ne
 * doit pas mourir parce que quelqu'un a corrigé une faute dans un titre.
 *
 * Avant la publication, il suit le titre — personne n'a encore l'adresse.
 * C'est `publishedAt` qui tranche, pas l'état.
 *
 * ⚠️ La première version justifiait ça par « un article archivé a laissé des
 * liens derrière lui, et son adresse doit continuer de répondre ». **C'était
 * faux**, et le code disait déjà le contraire : `CLAUSE_PUBLIQUE` ne sert que
 * les `PUBLIE`, donc un article archivé rend 404. Le commentaire affirmait un
 * comportement que personne n'avait écrit — et aucun test ne l'a relevé, parce
 * qu'aucun ne demandait ce que rend un archivé.
 *
 * La vraie raison de figer le slug est l'inverse : archiver est **réversible**.
 * Si l'adresse dérivait pendant l'archivage, republier ferait revenir l'article
 * ailleurs, et tous les liens partagés pendant qu'il était en ligne
 * tomberaient définitivement. Le figer garantit qu'il revient là où il était.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'AUTEUR N'EST PAS UN PARAMÈTRE LIBRE
 *
 * Comme partout ailleurs : il est lu de la session par l'action qui appelle ce
 * module. Le recevoir ici suffirait à publier au nom de quelqu'un d'autre — et
 * c'est ce nom qui apparaîtrait à l'audit.
 */

export type Echec =
  | { motif: "REFUS"; refus: Refus }
  | { motif: "INTROUVABLE" }
  | { motif: "TRANSITION_INTERDITE" }
  /** Refuser demande de dire pourquoi. */
  | { motif: "MOTIF_REQUIS" };

export type Suite<T = object> = ({ ok: true } & T) | ({ ok: false } & Echec);

const MOTIF_MIN = 8;

export const MESSAGES_ECHEC: Record<Echec["motif"], string> = {
  REFUS: "",
  INTROUVABLE: "Cet article n'existe plus.",
  TRANSITION_INTERDITE:
    "Quelqu'un vient de changer l'état de cet article. Rafraîchis la page.",
  MOTIF_REQUIS:
    "Écris pourquoi tu refuses : c'est la seule chose qu'on pourra montrer à son auteur.",
};

/** Crée un article, en brouillon. */
export async function creer(input: {
  auteurId: string;
  saisie: Saisie;
}): Promise<Suite<{ articleId: string }>> {
  const verdict = valider(input.saisie);
  if (!verdict.ok) return { ok: false, motif: "REFUS", refus: verdict.refus };

  const a = verdict.article;

  const cree = await db.blogPost.create({
    data: {
      authorId: input.auteurId,
      title: a.titre,
      slug: await slugDisponible(a.slug),
      excerpt: a.extrait,
      body: a.corps,
      coverUrl: a.couvertureUrl,
      categoryId: a.categorieId,
      seoTitle: a.seoTitre,
      seoDescription: a.seoDescription,
      canonicalUrl: a.urlCanonique,
      isFeatured: a.aLaUne,
      scheduledAt: a.parutionPrevue,
      state: "BROUILLON",
    },
    select: { id: true },
  });

  journal.info("article créé", { article: cree.id });

  return { ok: true, articleId: cree.id };
}

/**
 * Corrige un article, quel que soit son état.
 *
 * On ne verrouille pas l'édition d'un article publié : une faute se corrige
 * surtout quand le texte est en ligne.
 */
export async function modifier(input: {
  articleId: string;
  saisie: Saisie;
}): Promise<Suite> {
  const verdict = valider(input.saisie);
  if (!verdict.ok) return { ok: false, motif: "REFUS", refus: verdict.refus };

  const a = verdict.article;

  const avant = await db.blogPost.findUnique({
    where: { id: input.articleId },
    select: { slug: true, publishedAt: true },
  });

  if (!avant) return { ok: false, motif: "INTROUVABLE" };

  // Publié une fois : l'adresse est figée, des gens l'ont peut-être partagée.
  // Jamais publié : elle suit le titre, personne ne l'a encore.
  const slug =
    avant.publishedAt !== null
      ? avant.slug
      : a.slug === avant.slug
        ? avant.slug
        : await slugDisponible(a.slug);

  const ecrit = await db.blogPost.updateMany({
    where: { id: input.articleId },
    data: {
      title: a.titre,
      slug,
      excerpt: a.extrait,
      body: a.corps,
      coverUrl: a.couvertureUrl,
      categoryId: a.categorieId,
      seoTitle: a.seoTitre,
      seoDescription: a.seoDescription,
      canonicalUrl: a.urlCanonique,
      isFeatured: a.aLaUne,
      scheduledAt: a.parutionPrevue,
    },
  });

  if (ecrit.count !== 1) return { ok: false, motif: "INTROUVABLE" };

  return { ok: true };
}

/**
 * Publie, soumet, refuse, archive, ou remet en brouillon.
 *
 * La condition d'état vit dans le `WHERE` : deux personnes peuvent avoir
 * ouvert la même fiche, et seule la première doit trancher.
 */
export async function trancher(input: {
  articleId: string;
  geste: Geste;
  acteurId: string;
  motif?: string;
}): Promise<Suite<{ vers: string }>> {
  const article = await db.blogPost.findUnique({
    where: { id: input.articleId },
    select: { id: true, state: true, title: true, slug: true, authorId: true, publishedAt: true },
  });

  if (!article) return { ok: false, motif: "INTROUVABLE" };

  const transition = appliquer(article.state, input.geste);
  if (!transition.ok) return { ok: false, motif: "TRANSITION_INTERDITE" };

  const motif = (input.motif ?? "").trim();
  if (input.geste === "refuser" && motif.length < MOTIF_MIN) {
    return { ok: false, motif: "MOTIF_REQUIS" };
  }

  const ecrit = await db.blogPost.updateMany({
    where: { id: article.id, state: article.state },
    data: {
      state: transition.vers,
      refusedReason: input.geste === "refuser" ? motif : null,
      // Une parution prévue n'a plus de sens dès qu'on tranche à la main :
      // publier la réalise, retirer l'annule. La laisser ferait republier
      // l'article tout seul le lendemain, dans le dos de qui l'a retiré.
      scheduledAt: null,
      // ────────────────────────────────────────────────────────────────────
      // `publishedAt` SE POSE UNE FOIS, ET NE BOUGE PLUS
      //
      // C'est la date de PARUTION, pas celle de la dernière mise en ligne. Un
      // article archivé puis republié garde la sienne : le republier ne le
      // rend pas neuf, et le remonter en tête de liste tromperait le lecteur.
      //
      // C'est aussi elle qui fige le slug — voir l'en-tête.
      ...(transition.vers === "PUBLIE" && article.publishedAt === null
        ? { publishedAt: new Date() }
        : {}),
      // La trace de relecture ne se pose que sur un verdict. `soumettre` et
      // `reprendre` sont les gestes de l'auteur sur son propre texte.
      ...(input.geste === "publier" || input.geste === "refuser"
        ? { moderatedAt: new Date(), moderatorId: input.acteurId }
        : {}),
    },
  });

  if (ecrit.count !== 1) return { ok: false, motif: "TRANSITION_INTERDITE" };

  await consigner({
    acteurId: input.acteurId,
    action:
      input.geste === "publier"
        ? "contenu.publier"
        : input.geste === "refuser"
          ? "contenu.refuser"
          : "contenu.retirer",
    ressource: ressource("article", article.id),
    details: {
      de: article.state,
      vers: transition.vers,
      titre: article.title,
      ...(motif ? { motif } : {}),
    },
  });

  await annoncerLaDecision({
    auteurId: article.authorId,
    acteurId: input.acteurId,
    geste: input.geste,
    nature: "article",
    id: article.id,
    titre: article.title,
    motif,
    lien: input.geste === "publier" ? `/blog/${article.slug}` : `/dashboard/blog/${article.id}`,
  });

  journal.info("article tranché", {
    article: article.id,
    de: article.state,
    vers: transition.vers,
  });

  return { ok: true, vers: transition.vers };
}

/**
 * Compte une lecture.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UN INCRÉMENT NU, SANS LECTURE PRÉALABLE
 *
 * `{ increment: 1 }` laisse PostgreSQL faire l'addition. Lire puis écrire
 * perdrait des vues dès que deux lecteurs arrivent en même temps — et c'est
 * précisément quand un article marche que le compteur compterait mal.
 *
 * Aucune déduplication : ce compteur dit « combien de fois la page a été
 * servie », pas « combien de personnes l'ont lue ». Les distinguer demanderait
 * de poser un identifiant sur chaque visiteur, ce que ce projet ne fait pas.
 * Le nom `viewsCount` le dit déjà ; l'écran ne doit pas promettre autre chose.
 */
export async function compterUneLecture(articleId: string): Promise<void> {
  try {
    await db.blogPost.updateMany({
      where: { id: articleId },
      data: { viewsCount: { increment: 1 } },
    });
  } catch (cause) {
    // Un compteur qui rate ne doit pas faire échouer l'affichage de l'article.
    journal.erreur("vue d'article non comptée", {
      article: articleId,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
  }
}

/**
 * Publier ce dont l'heure est venue.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * SEULEMENT DES BROUILLONS, ET SEULEMENT CEUX DONT L'HEURE EST PASSÉE
 *
 * §4.3 demandait la publication planifiée. La colonne n'existait pas en
 * v1.53.0, et c'était délibéré : une colonne que rien ne lit est une promesse
 * qu'on croit tenue. Elle arrive avec le passage qui la lit.
 *
 * Trois conditions, et chacune évite un dégât précis :
 *
 *   — `state: BROUILLON` : une date oubliée sur un article qu'on a archivé
 *     entre-temps ne doit pas le remettre en ligne dans le dos de qui l'a
 *     retiré ;
 *   — `scheduledAt` non nul et passé : c'est la planification elle-même ;
 *   — la même condition dans le `WHERE` de l'écriture, article par article :
 *     deux passages qui se croisent ne doivent publier qu'une fois.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA DATE S'EFFACE À LA PUBLICATION
 *
 * Sinon elle resterait affichée sur un article déjà en ligne, et laisserait
 * croire qu'une seconde parution est prévue. Ce qui est fait ne s'annonce plus.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL PEUT RATER SON TOUR
 *
 * Un passage sauté publie le lendemain, avec un jour de retard et rien de
 * cassé. C'est pour ça que la condition est « l'heure est passée » et non
 * « l'heure est celle-ci » : chercher l'égalité ferait perdre définitivement
 * tout article dont l'heure est tombée pendant une panne.
 */
export interface PassageBlog {
  vus: number;
  publies: number;
}

export async function publierLesArticlesDus(
  maintenant: Date = new Date(),
): Promise<PassageBlog> {
  const dus = await db.blogPost.findMany({
    where: {
      state: "BROUILLON",
      scheduledAt: { not: null, lte: maintenant },
    },
    orderBy: { scheduledAt: "asc" },
    // Borné : un passage qui publierait dix mille articles d'un coup tiendrait
    // la connexion trop longtemps. Le reste part au passage suivant.
    take: 50,
    select: { id: true, title: true, authorId: true, publishedAt: true },
  });

  let publies = 0;

  for (const article of dus) {
    // La condition est répétée dans le `WHERE` : entre la lecture et
    // l'écriture, quelqu'un a pu publier ou archiver l'article à la main.
    const ecrit = await db.blogPost.updateMany({
      where: {
        id: article.id,
        state: "BROUILLON",
        scheduledAt: { not: null, lte: maintenant },
      },
      data: {
        state: "PUBLIE",
        scheduledAt: null,
        ...(article.publishedAt === null ? { publishedAt: maintenant } : {}),
      },
    });

    if (ecrit.count !== 1) continue;

    publies += 1;

    // Consigné après l'acte, et seulement s'il a eu lieu. L'acteur est
    // l'auteur : c'est lui qui a décidé de la date, le passage ne fait
    // qu'exécuter ce qu'il avait demandé.
    await consigner({
      acteurId: article.authorId,
      action: "contenu.publier",
      ressource: ressource("article", article.id),
      details: { titre: article.title, parPlanification: true },
    });
  }

  journal.info("passage du blog", { vus: dus.length, publies });

  return { vus: dus.length, publies };
}

/** Slug unique : on suffixe tant que le précédent est pris. */
async function slugDisponible(base: string): Promise<string> {
  const racine = base.length > 0 ? base : "article";

  for (let i = 0; i < 50; i += 1) {
    const candidat = i === 0 ? racine : `${racine}-${i + 1}`;
    const pris = await db.blogPost.findUnique({
      where: { slug: candidat },
      select: { id: true },
    });
    if (!pris) return candidat;
  }

  // Après cinquante homonymes, on tranche par l'horloge plutôt que de boucler.
  return `${racine}-${Date.now()}`;
}
