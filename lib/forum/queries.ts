import "server-only";

import { db } from "@/lib/db";

import {
  clauseAnnuaire,
  droitsSur,
  type Communaute,
  type Droits,
  type RoleForum,
  type Visibilite,
  type Visiteur,
} from "@/lib/forum/acces";

/**
 * Ce qu'on lit du forum.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * AUCUNE LECTURE DE CONTENU NE PREND UN IDENTIFIANT SEUL
 *
 * Toutes exigent un objet `Droits`, et le refusent s'il ne porte pas `lire`.
 * C'est le même dessin que la `Portee` des événements, et pour la même
 * raison : une garde qu'il faut **penser** à appeler finit par manquer sur le
 * neuvième écran.
 *
 * Ici, l'oubli ne compile pas — on ne peut pas demander les messages d'un
 * sujet sans avoir d'abord obtenu les droits, et les droits ne s'obtiennent
 * que par `contexteDe`, qui lit la communauté et l'appartenance.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE CONTEXTE SE CHARGE UNE FOIS
 *
 * `contexteDe` fait deux requêtes — la communauté, l'appartenance — et rend
 * les deux avec les droits calculés. Les écrans le passent ensuite de fonction
 * en fonction plutôt que de le recharger : recharger à chaque lecture
 * multiplierait les allers-retours par le nombre de blocs affichés.
 */

export interface Contexte {
  communaute: {
    id: string;
    slug: string;
    nom: string;
    description: string | null;
    visibilite: Visibilite;
    membres: number;
    createurId: string;
    monRole: RoleForum | null;
  };
  droits: Droits;
}

/**
 * La communauté, l'appartenance, et ce qu'on a le droit d'y faire.
 *
 * `null` veut dire deux choses à la fois — elle n'existe pas, ou elle ne se
 * montre pas à vous — et c'est volontaire : distinguer les deux apprendrait
 * l'existence d'un espace sur invitation à qui tape son adresse au hasard.
 */
export async function contexteDe(
  slug: string,
  visiteur: { id: string; role: Visiteur["role"] } | null,
): Promise<Contexte | null> {
  const c = await db.community.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      visibility: true,
      memberCount: true,
      creatorId: true,
      status: true,
      // L'appartenance de CE visiteur, et d'aucun autre. Charger la liste
      // entière pour y chercher une ligne ferait grandir la requête avec la
      // communauté.
      members: visiteur
        ? { where: { userId: visiteur.id }, select: { role: true }, take: 1 }
        : false,
    },
  });

  if (!c) return null;

  const monRole = (c.members?.[0]?.role ?? null) as RoleForum | null;

  const modele: Communaute = {
    id: c.id,
    visibilite: c.visibility as Visibilite,
    createurId: c.creatorId,
    active: c.status === "active",
  };

  const droits = droitsSur(
    modele,
    visiteur ? { id: visiteur.id, role: visiteur.role, appartenance: monRole } : null,
  );

  // Ne pas voir, c'est ne pas exister. L'écran répondra 404.
  if (!droits.voir) return null;

  return {
    communaute: {
      id: c.id,
      slug: c.slug,
      nom: c.name,
      description: c.description,
      visibilite: c.visibility as Visibilite,
      membres: c.memberCount,
      createurId: c.creatorId,
      monRole,
    },
    droits,
  };
}

// ════════════════════════════════════════════════════════════════ l'annuaire ══

export interface LigneAnnuaire {
  slug: string;
  nom: string;
  description: string | null;
  visibilite: Visibilite;
  membres: number;
  /** Vrai quand le visiteur en est déjà membre ou l'a créée. */
  chezMoi: boolean;
}

/**
 * Les communautés qu'on a le droit de voir.
 *
 * Triées par effectif décroissant : un annuaire sert à trouver où il se passe
 * quelque chose. Trier par date de création mettrait en tête les espaces
 * vides ouverts la semaine dernière.
 */
export async function listerCommunautes(
  visiteurId: string | null,
  limite = 40,
): Promise<LigneAnnuaire[]> {
  const lignes = await db.community.findMany({
    // Pas de transtypage : `ClauseAnnuaire` est décrite assez précisément
    // pour que Prisma l'accepte telle quelle. La première version passait par
    // `as never`, qui aurait laissé passer n'importe quelle faute de frappe
    // dans un nom de colonne — le pire des transtypages pour une clause qui
    // décide de ce qu'on a le droit de voir.
    where: clauseAnnuaire(visiteurId),
    orderBy: [{ memberCount: "desc" }, { name: "asc" }],
    take: Math.min(limite, 100),
    select: {
      slug: true,
      name: true,
      description: true,
      visibility: true,
      memberCount: true,
      creatorId: true,
      members: visiteurId
        ? { where: { userId: visiteurId }, select: { id: true }, take: 1 }
        : false,
    },
  });

  return lignes.map((c) => ({
    slug: c.slug,
    nom: c.name,
    description: c.description,
    visibilite: c.visibility as Visibilite,
    membres: c.memberCount,
    chezMoi: c.creatorId === visiteurId || (c.members?.length ?? 0) > 0,
  }));
}

// ═════════════════════════════════════════════════════════ dans la communauté ══

export interface LigneCategorie {
  id: string;
  nom: string;
  slug: string;
  sujets: number;
}

/** Les rubriques, dans l'ordre choisi par l'administrateur de l'espace. */
export async function categoriesDe(
  contexte: Contexte,
): Promise<LigneCategorie[]> {
  if (!contexte.droits.lire) return [];

  const lignes = await db.forumCategory.findMany({
    where: { communityId: contexte.communaute.id },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { topics: true } },
    },
  });

  return lignes.map((c) => ({
    id: c.id,
    nom: c.name,
    slug: c.slug,
    sujets: c._count.topics,
  }));
}

export interface LigneSujet {
  id: string;
  titre: string;
  auteur: string;
  auteurUsername: string | null;
  reponses: number;
  vues: number;
  epingle: boolean;
  verrouille: boolean;
  ouvertLe: Date;
}

/**
 * Les sujets d'une rubrique — épinglés d'abord, puis les plus récents.
 *
 * L'ordre de l'index `[categoryId, isPinned, createdAt]` suit exactement cet
 * ordre de tri : un index qui ne le suit pas ne sert pas, PostgreSQL retrie.
 *
 * `isPinned: "desc"` parce que `true` passe après `false` en ordre croissant,
 * et qu'un épinglé doit être en tête.
 */
export async function sujetsDe(
  contexte: Contexte,
  categorieId: string,
  limite = 50,
): Promise<LigneSujet[]> {
  if (!contexte.droits.lire) return [];

  const lignes = await db.forumTopic.findMany({
    // La catégorie est rattachée à la communauté dans le `WHERE`, pas
    // supposée : sans ça, l'identifiant d'une rubrique d'un AUTRE espace
    // rendrait ses sujets à qui le devine.
    where: {
      categoryId: categorieId,
      category: { communityId: contexte.communaute.id },
    },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    take: Math.min(limite, 100),
    select: {
      id: true,
      title: true,
      repliesCount: true,
      viewsCount: true,
      isPinned: true,
      isLocked: true,
      createdAt: true,
      author: {
        select: {
          email: true,
          profile: { select: { displayName: true, username: true } },
        },
      },
    },
  });

  return lignes.map((t) => ({
    id: t.id,
    titre: t.title,
    auteur: t.author.profile?.displayName ?? t.author.email,
    auteurUsername: t.author.profile?.username ?? null,
    reponses: t.repliesCount,
    vues: t.viewsCount,
    epingle: t.isPinned,
    verrouille: t.isLocked,
    ouvertLe: t.createdAt,
  }));
}

export interface MessageLu {
  id: string;
  corps: string;
  auteur: string;
  auteurId: string;
  auteurUsername: string | null;
  likes: number;
  signale: boolean;
  ecritLe: Date;
}

export interface SujetLu {
  id: string;
  titre: string;
  /**
   * Qui a ouvert le sujet.
   *
   * Pas déductible du premier message : la modération peut l'avoir retiré, et
   * le rang deviendrait alors un mensonge — le deuxième message porterait
   * « a ouvert le sujet ».
   */
  auteurId: string;
  categorieNom: string;
  epingle: boolean;
  verrouille: boolean;
  ouvertLe: Date;
  messages: MessageLu[];
}

/**
 * Un sujet et ses messages, du plus ancien au plus récent.
 *
 * C'est l'ordre d'une conversation, et il ne se discute pas : lire une
 * discussion à l'envers demande de remonter pour comprendre chaque réponse.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UN MESSAGE SIGNALÉ RESTE VISIBLE, ET MARQUÉ
 *
 * Le masquer ferait disparaître le contexte d'une conversation dont les
 * réponses citent souvent ce qu'on a signalé. L'écran l'affiche replié, avec
 * la mention — et c'est la modération qui décide de le retirer, pas le
 * signalement lui-même.
 */
export async function sujetAvecMessages(
  contexte: Contexte,
  sujetId: string,
  limite = 200,
): Promise<SujetLu | null> {
  if (!contexte.droits.lire) return null;

  const t = await db.forumTopic.findFirst({
    // Le rattachement à la communauté, encore : l'identifiant vient de l'URL.
    where: {
      id: sujetId,
      category: { communityId: contexte.communaute.id },
    },
    select: {
      id: true,
      title: true,
      authorId: true,
      isPinned: true,
      isLocked: true,
      createdAt: true,
      category: { select: { name: true } },
      posts: {
        orderBy: { createdAt: "asc" },
        take: Math.min(limite, 500),
        select: {
          id: true,
          body: true,
          authorId: true,
          likesCount: true,
          isFlagged: true,
          createdAt: true,
          author: {
            select: {
              email: true,
              profile: { select: { displayName: true, username: true } },
            },
          },
        },
      },
    },
  });

  if (!t) return null;

  return {
    id: t.id,
    titre: t.title,
    auteurId: t.authorId,
    categorieNom: t.category.name,
    epingle: t.isPinned,
    verrouille: t.isLocked,
    ouvertLe: t.createdAt,
    messages: t.posts.map((p) => ({
      id: p.id,
      corps: p.body,
      auteur: p.author.profile?.displayName ?? p.author.email,
      auteurId: p.authorId,
      auteurUsername: p.author.profile?.username ?? null,
      likes: p.likesCount,
      signale: p.isFlagged,
      ecritLe: p.createdAt,
    })),
  };
}

/**
 * Compte une lecture de sujet.
 *
 * Même dessin que le compteur d'articles : un incrément nu, sans lecture
 * préalable, et qui ne lève jamais. Il dit « combien de fois la page a été
 * servie », pas « combien de personnes ont lu » — ce projet ne pose pas
 * d'identifiant sur ses visiteurs.
 */
export async function compterUneVueDeSujet(sujetId: string): Promise<void> {
  await db.forumTopic
    .updateMany({ where: { id: sujetId }, data: { viewsCount: { increment: 1 } } })
    .catch(() => {});
}
