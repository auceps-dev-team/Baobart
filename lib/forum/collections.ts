import "server-only";

import { db } from "@/lib/db";

import type { Droits } from "@/lib/forum/acces";
import type { Contexte } from "@/lib/forum/queries";

/**
 * Les collections partagées avec une communauté.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * C'EST LA MOITIÉ MANQUANTE DE LA MAQUETTE
 *
 * `Baobart Accueil.dc.html`, section `#collab` — « Vos espaces d'équipe » —
 * montre trois choses empilées : une **collection** (« Campagne Dakar 2026 —
 * 4 membres · 38 ressources · mise à jour il y a 2 h »), ses ressources en
 * grille, puis le **fil**.
 *
 * v1.55.0 n'avait livré que le fil. Une conversation sans ce qu'elle commente
 * n'est pas ce que la maquette promet : « Likes, collections partagées,
 * commentaires au bon endroit. Fini les captures d'écran par WhatsApp. » Ce
 * sont les captures d'écran qu'on remplace — donc les ressources.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * PARTAGER EST UN GESTE DE SON PROPRIÉTAIRE, ET DE LUI SEUL
 *
 * Un administrateur de communauté ne peut pas y attirer la collection de
 * quelqu'un d'autre. La raison n'est pas la politesse : une collection peut
 * être privée (`isPublic: false`), et l'attacher la rendrait lisible par tous
 * les membres. Le geste exposerait le rangement de quelqu'un sans qu'il le
 * sache.
 *
 * Il peut la **détacher** — c'est de la modération, et elle ne perd rien : la
 * collection redevient personnelle, exactement ce qu'elle était avant.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ATTACHER NE CHANGE PAS `isPublic`
 *
 * Une collection privée partagée avec une communauté reste invisible partout
 * ailleurs. `isPublic` répond à « le monde entier peut-il la voir ? » ;
 * `communityId` répond à « ces membres-là peuvent-ils la voir ? ». Fusionner
 * les deux ferait qu'un partage entre douze personnes ouvrirait la collection
 * à tout Internet.
 */

export type EchecCollection =
  | { motif: "INTERDIT" }
  | { motif: "INTROUVABLE" }
  | { motif: "DEJA_ATTACHEE" }
  | { motif: "AILLEURS" };

export type SuiteCollection = { ok: true } | ({ ok: false } & EchecCollection);

export const MESSAGES_ECHEC_COLLECTION: Record<EchecCollection["motif"], string> = {
  INTERDIT: "Tu n'as pas le droit de faire ça ici.",
  INTROUVABLE: "Cette collection n'existe plus.",
  DEJA_ATTACHEE: "Elle est déjà partagée ici.",
  AILLEURS: "Elle est déjà partagée avec une autre communauté. Détache-la d'abord.",
};

export interface RessourceDeCollection {
  id: string;
  titre: string;
  couverture: string | null;
}

export interface CollectionPartagee {
  id: string;
  titre: string;
  description: string | null;
  privee: boolean;
  proprietaireId: string;
  proprietaire: string;
  ressources: number;
  /** Les premières, pour la grille de la maquette. */
  apercu: RessourceDeCollection[];
  partageeLe: Date;
}

/** Combien de vignettes la grille montre. La maquette en dessine quatre. */
const APERCU = 8;

/**
 * Les collections partagées avec cette communauté.
 *
 * Elles suivent le droit de **lire** la communauté, pas `isPublic` : c'est
 * tout l'intérêt du partage. Une collection privée devient lisible par les
 * membres, et par eux seuls.
 */
export async function collectionsDe(
  contexte: Contexte,
): Promise<CollectionPartagee[]> {
  if (!contexte.droits.lire) return [];

  const lignes = await db.board.findMany({
    where: { communityId: contexte.communaute.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      description: true,
      isPublic: true,
      ownerId: true,
      createdAt: true,
      owner: {
        select: { email: true, profile: { select: { displayName: true } } },
      },
      _count: { select: { saves: true } },
      saves: {
        take: APERCU,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          workItem: { select: { title: true } },
          product: { select: { name: true, coverUrl: true } },
        },
      },
    },
  });

  return lignes.map((b) => ({
    id: b.id,
    titre: b.title,
    description: b.description,
    privee: !b.isPublic,
    proprietaireId: b.ownerId,
    proprietaire: b.owner.profile?.displayName ?? b.owner.email,
    ressources: b._count.saves,
    apercu: b.saves.map((s) => ({
      id: s.id,
      // Une sauvegarde pointe vers un `WorkItem` OU un `Product` — jamais les
      // deux, jamais aucun en pratique. Le repli nomme le cas plutôt que de
      // laisser une vignette sans étiquette.
      titre: s.workItem?.title ?? s.product?.name ?? "Ressource retirée",
      couverture: s.product?.coverUrl ?? null,
    })),
    partageeLe: b.createdAt,
  }));
}

/** Les collections qu'on peut proposer au partage : les siennes, libres. */
export async function mesCollectionsDetachees(
  userId: string,
): Promise<{ id: string; titre: string; ressources: number; privee: boolean }[]> {
  const lignes = await db.board.findMany({
    where: { ownerId: userId, communityId: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      isPublic: true,
      _count: { select: { saves: true } },
    },
  });

  return lignes.map((b) => ({
    id: b.id,
    titre: b.title,
    ressources: b._count.saves,
    privee: !b.isPublic,
  }));
}

/**
 * Partager une collection avec une communauté.
 *
 * Trois conditions, et chacune répond à un usage détourné :
 *
 *   — être membre (`droits.ecrire`), sinon un passant meublerait l'espace ;
 *   — en être le propriétaire, sinon on exposerait le rangement d'un autre ;
 *   — qu'elle ne soit pas déjà ailleurs, sinon elle disparaîtrait d'une
 *     communauté sans que personne n'y soit prévenu.
 */
export async function attacher(input: {
  boardId: string;
  communauteId: string;
  parId: string;
  droits: Droits;
}): Promise<SuiteCollection> {
  if (!input.droits.ecrire) return { ok: false, motif: "INTERDIT" };

  const board = await db.board.findUnique({
    where: { id: input.boardId },
    select: { id: true, ownerId: true, communityId: true },
  });

  if (!board) return { ok: false, motif: "INTROUVABLE" };
  if (board.ownerId !== input.parId) return { ok: false, motif: "INTERDIT" };
  if (board.communityId === input.communauteId) {
    return { ok: false, motif: "DEJA_ATTACHEE" };
  }
  if (board.communityId !== null) return { ok: false, motif: "AILLEURS" };

  // La valeur d'avant est dans le `WHERE` : deux onglets ouverts ne doivent
  // pas produire deux rattachements dont le second écrase le premier.
  const ecrit = await db.board.updateMany({
    where: { id: board.id, communityId: null },
    data: { communityId: input.communauteId },
  });

  if (ecrit.count !== 1) return { ok: false, motif: "AILLEURS" };

  return { ok: true };
}

/**
 * Détacher une collection.
 *
 * Son propriétaire la reprend quand il veut ; un modérateur de la communauté
 * la retire de chez lui. Aucun des deux ne perd rien — `communityId` repasse à
 * `null`, et la collection redevient ce qu'elle était.
 *
 * C'est pour ça que ce geste n'est pas consigné, contrairement au retrait d'un
 * message : rien n'est détruit, et tout est réversible par un clic.
 */
export async function detacher(input: {
  boardId: string;
  communauteId: string;
  parId: string;
  droits: Droits;
}): Promise<SuiteCollection> {
  const board = await db.board.findFirst({
    where: { id: input.boardId, communityId: input.communauteId },
    select: { id: true, ownerId: true },
  });

  if (!board) return { ok: false, motif: "INTROUVABLE" };

  const sienne = board.ownerId === input.parId;
  if (!sienne && !input.droits.moderer) return { ok: false, motif: "INTERDIT" };

  await db.board.updateMany({
    where: { id: board.id, communityId: input.communauteId },
    data: { communityId: null },
  });

  return { ok: true };
}
