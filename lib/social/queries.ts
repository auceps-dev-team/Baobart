import "server-only";

import { estOfferte, libelleDuPrix } from "@/lib/commerce/montant";
import { pageDemandee } from "@/lib/dashboard/pagination";
import { db } from "@/lib/db";
import { presenterAbonne, type AbonneVu } from "@/lib/social/regles";

/** Ce que la fiche doit savoir de la relation entre le visiteur et l'objet. */
export interface EtatSocial {
  jaime: boolean;
  likes: number;
  suit: boolean;
  abonnes: number;
  /**
   * Nombre total de commentaires, réponses comprises.
   *
   * Compter les seules racines afficherait « Commentaires (1) » au-dessus de
   * deux bulles — le genre d'écart qu'on remarque immédiatement.
   */
  commentaires: number;
  /** Vrai quand le visiteur regarde sa propre ressource. */
  chezSoi: boolean;
  /** Rangée dans au moins une collection du visiteur. */
  epingle: boolean;
}

export async function etatSocial(input: {
  produitId: string;
  createurId: string;
  userId: string | null;
}): Promise<EtatSocial> {
  const [produit, createur] = await Promise.all([
    db.product.findUnique({
      where: { id: input.produitId },
      select: { likesCount: true, commentsCount: true },
    }),
    db.user.findUnique({
      where: { id: input.createurId },
      select: { followersCount: true },
    }),
  ]);

  const base = {
    likes: produit?.likesCount ?? 0,
    commentaires: produit?.commentsCount ?? 0,
    abonnes: createur?.followersCount ?? 0,
    chezSoi: input.userId === input.createurId,
  };

  // Sans visiteur connecté, rien de personnel à établir : on évite deux
  // requêtes que la réponse rendrait inutiles.
  if (!input.userId) return { ...base, jaime: false, suit: false, epingle: false };

  const [like, suivi, rangee] = await Promise.all([
    db.like.findUnique({
      where: {
        userId_productId: { userId: input.userId, productId: input.produitId },
      },
      select: { id: true },
    }),
    db.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: input.userId,
          followingId: input.createurId,
        },
      },
      select: { id: true },
    }),
    db.save.findFirst({ where: { productId: input.produitId, board: { ownerId: input.userId } }, select: { id: true } }),
  ]);

  return { ...base, jaime: like !== null, suit: suivi !== null, epingle: rangee !== null };
}

export interface CommentaireRendu {
  id: string;
  auteur: string;
  auteurId: string;
  publieLe: Date;
  corps: string;
  retire: boolean;
  /**
   * Marqué par la détection automatique.
   *
   * Montré au seul créateur : dire publiquement « ce commentaire est signalé »
   * accuserait son auteur sur la foi d'une liste de mots.
   */
  signale: boolean;
  /** Le visiteur peut-il le retirer ? Calculé ici, pas dans le composant. */
  retirable: boolean;
  reponses: CommentaireRendu[];
}

/**
 * Le fil d'une ressource, en deux niveaux.
 *
 * Un commentaire retiré reste dans le fil avec sa mention : effacer la ligne
 * emporterait par cascade les réponses qui s'y accrochent, et laisserait un
 * trou inexplicable au milieu d'une discussion.
 */
export async function commentairesDe(
  produitId: string,
  visiteurId: string | null,
  proprietaireId: string,
): Promise<CommentaireRendu[]> {
  const lignes = await db.comment.findMany({
    where: { productId: produitId },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      id: true,
      authorId: true,
      parentId: true,
      body: true,
      deletedAt: true,
      isFlagged: true,
      createdAt: true,
      author: {
        select: { profile: { select: { displayName: true, username: true } } },
      },
    },
  });

  const rendre = (l: (typeof lignes)[number]): CommentaireRendu => ({
    id: l.id,
    auteur:
      l.author.profile?.displayName ??
      l.author.profile?.username ??
      "Membre Baobart",
    auteurId: l.authorId,
    publieLe: l.createdAt,
    corps: l.body,
    retire: l.deletedAt !== null,
    signale: l.isFlagged && visiteurId === proprietaireId,
    retirable:
      l.deletedAt === null &&
      visiteurId !== null &&
      (visiteurId === l.authorId || visiteurId === proprietaireId),
    reponses: [],
  });

  const parId = new Map<string, CommentaireRendu>();
  const racines: CommentaireRendu[] = [];

  for (const l of lignes) {
    parId.set(l.id, rendre(l));
  }

  for (const l of lignes) {
    const rendu = parId.get(l.id)!;
    if (l.parentId && parId.has(l.parentId)) {
      parId.get(l.parentId)!.reponses.push(rendu);
    } else {
      racines.push(rendu);
    }
  }

  // Une racine retirée sans réponse n'apprend rien : on la laisse tomber.
  // Retirée mais répondue, elle reste — sinon la réponse pendrait dans le vide.
  return racines.filter((r) => !r.retire || r.reponses.length > 0);
}

export interface ElementSuivi {
  produitId: string;
  slug: string;
  titre: string;
  auteur: string;
  prix: number;
  /** Prix fixe à zéro (`estOfferte`). Un prix libre ne l'est jamais. */
  offerte: boolean;
  prixAffiche: string;
  coverUrl: string | null;
  aimeLe: Date;
}

/** Les ressources aimées — écran « Éléments suivis » du tableau de bord. */
export async function elementsAimes(userId: string): Promise<ElementSuivi[]> {
  const likes = await db.like.findMany({
    where: { userId, productId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      createdAt: true,
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          price: true,
          pricingMode: true,
          minPrice: true,
          currency: true,
          coverUrl: true,
          status: true,
          seller: {
            select: { profile: { select: { displayName: true, username: true } } },
          },
        },
      },
    },
  });

  return likes
    .filter((l) => l.product !== null && l.product.status === "PUBLISHED")
    .map((l) => ({
      produitId: l.product!.id,
      slug: l.product!.slug,
      titre: l.product!.name,
      auteur:
        l.product!.seller.profile?.displayName ??
        l.product!.seller.profile?.username ??
        "Créateur Baobart",
      prix: l.product!.price,
      offerte: estOfferte(l.product!),
      prixAffiche: libelleDuPrix(l.product!),
      coverUrl: l.product!.coverUrl,
      aimeLe: l.createdAt,
    }));
}

export interface CreateurSuivi {
  userId: string;
  nom: string;
  username: string | null;
  ville: string | null;
  abonnes: number;
  ressourcesPubliees: number;
  suiviLe: Date;
}

/** Les créateurs suivis — écran « Abonnements » du tableau de bord. */
export async function createursSuivis(userId: string): Promise<CreateurSuivi[]> {
  const suivis = await db.follow.findMany({
    where: { followerId: userId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      createdAt: true,
      following: {
        select: {
          id: true,
          followersCount: true,
          profile: {
            select: { displayName: true, username: true, city: true },
          },
          _count: { select: { products: { where: { status: "PUBLISHED" } } } },
        },
      },
    },
  });

  return suivis.map((s) => ({
    userId: s.following.id,
    nom:
      s.following.profile?.displayName ??
      s.following.profile?.username ??
      "Créateur Baobart",
    username: s.following.profile?.username ?? null,
    ville: s.following.profile?.city ?? null,
    abonnes: s.following.followersCount,
    ressourcesPubliees: s.following._count.products,
    suiviLe: s.createdAt,
  }));
}

export interface PageDAbonnes {
  /** Toutes les lignes `Follow` vers ce créateur : le même nombre que `followersCount`. */
  total: number;
  page: number;
  pages: number;
  abonnes: AbonneVu[];
}

/**
 * Ceux qui suivent un créateur, une page à la fois — écran « Abonnés » (lot 5a,
 * maquette `c_abonnes`). Les plus récents d'abord.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * PAGINÉ EN BASE, PAS EN MÉMOIRE
 *
 * `createursSuivis`, plus haut, lit 200 lignes puis la page les découpe. Ça
 * tient pour ceux qu'on suit ; pas pour ceux qui nous suivent : un créateur à
 * 1 240 abonnés (le chiffre de la maquette) n'en aurait vu que 200, et la
 * barre de pagination lui aurait dit « page 50 sur 50 » sans rien signaler.
 * Ici : le total d'abord, la page ramenée dans ses bornes (`pageDemandee`),
 * puis `skip`/`take` sur un ordre total — la date, puis l'identifiant, pour
 * que deux suivis de la même milliseconde ne changent pas de page d'une
 * lecture à l'autre.
 *
 * L'index `Follow(followingId)` suffit aux volumes attendus : la maquette dessine
 * 1 240 abonnés, et la base de développement n'a aucune ligne `Follow` (mesuré
 * le 21/11). Un index `(followingId, createdAt)` servirait la page sans tri, le
 * jour où une liste compterait des dizaines de milliers d'abonnés.
 *
 * Ce qu'on montre de chacun est décidé par `presenterAbonne` (lib/social/regles.ts).
 */
export async function abonnesDe(createurId: string, brutPage: string | undefined, parPage: number): Promise<PageDAbonnes> {
  if (!Number.isInteger(parPage) || parPage < 1) throw new Error(`abonnesDe : taille de page invalide (${parPage})`);

  const total = await db.follow.count({ where: { followingId: createurId } });
  const pages = Math.max(1, Math.ceil(total / parPage));
  const page = pageDemandee(brutPage, pages);

  const lignes = await db.follow.findMany({
    where: { followingId: createurId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * parPage,
    take: parPage,
    select: {
      createdAt: true,
      follower: {
        select: {
          id: true,
          suspendedAt: true,
          profile: {
            select: { displayName: true, username: true, speciality: true, city: true, avatarUrl: true, acceptsMessages: true },
          },
          _count: { select: { products: { where: { status: "PUBLISHED" } } } },
        },
      },
    },
  });

  return {
    total,
    page,
    pages,
    abonnes: lignes.map((l) =>
      presenterAbonne({
        userId: l.follower.id,
        suitDepuis: l.createdAt,
        suspendu: l.follower.suspendedAt !== null,
        ressourcesPubliees: l.follower._count.products,
        profil: l.follower.profile,
      }),
    ),
  };
}
