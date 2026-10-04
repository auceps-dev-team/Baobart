import "server-only";

import { db } from "@/lib/db";
import { peutModifier, peutVoir, type CollectionDroits, type Visiteur } from "@/lib/collections/regles";

/**
 * Les collections, côté base. Les droits sont dans `regles.ts`.
 *
 * Une collection est un `Board` ; ce qu'on y range, des `Save` vers des
 * ressources publiées.
 */

async function visiteur(userId: string): Promise<Visiteur> {
  const adhesions = await db.communityMembership.findMany({ where: { userId }, select: { communityId: true } });
  return { id: userId, communautes: new Set(adhesions.map((a) => a.communityId)) };
}

const droitsDe = (b: { ownerId: string; communityId: string | null; isPublic: boolean }): CollectionDroits => ({
  proprietaireId: b.ownerId,
  communauteId: b.communityId,
  publique: b.isPublic,
});

export interface ResumeCollection {
  id: string;
  titre: string;
  description: string | null;
  publique: boolean;
  communaute: { nom: string; slug: string } | null;
  ressources: number;
  /** Jusqu'à quatre couvertures, pour la vignette. */
  apercu: string[];
}

/** Les collections d'un membre, les plus récentes d'abord. */
export async function mesCollections(userId: string, limite = 50): Promise<ResumeCollection[]> {
  const lignes = await db.board.findMany({
    where: { ownerId: userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limite,
    select: {
      id: true,
      title: true,
      description: true,
      isPublic: true,
      community: { select: { name: true, slug: true } },
      _count: { select: { saves: true } },
      saves: {
        where: { product: { coverUrl: { not: null } } },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: { product: { select: { coverUrl: true } } },
      },
    },
  });
  return lignes.map((b) => ({
    id: b.id,
    titre: b.title,
    description: b.description,
    publique: b.isPublic,
    communaute: b.community ? { nom: b.community.name, slug: b.community.slug } : null,
    ressources: b._count.saves,
    apercu: b.saves.map((s) => s.product?.coverUrl).filter((u): u is string => Boolean(u)),
  }));
}

export async function creer(userId: string, c: { title: string; description: string | null; isPublic: boolean }): Promise<string> {
  const cree = await db.board.create({ data: { ownerId: userId, ...c }, select: { id: true } });
  return cree.id;
}

/** Les collections du membre, et si la ressource y est déjà — pour le choix « Épingler ». */
export async function collectionsPourEpingler(userId: string, produitId: string) {
  const lignes = await db.board.findMany({
    where: { ownerId: userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 50,
    select: {
      id: true,
      title: true,
      community: { select: { name: true } },
      saves: { where: { productId: produitId }, select: { id: true } },
    },
  });
  return lignes.map((b) => ({ id: b.id, titre: b.title, partageeAvec: b.community?.name ?? null, contient: b.saves.length > 0 }));
}

export type IssueEpingle = { ok: true; epinglee: boolean } | { ok: false; motif: "INTROUVABLE" | "INTERDIT" | "RESSOURCE" };

/**
 * Range la ressource dans la collection, ou l'en retire. Seule une ressource
 * publiée se range : une collection partagée la montrerait à des membres qui
 * ne peuvent pas l'ouvrir.
 */
export async function epingler(userId: string, boardId: string, produitId: string, ranger: boolean): Promise<IssueEpingle> {
  const b = await db.board.findUnique({ where: { id: boardId }, select: { ownerId: true, communityId: true, isPublic: true } });
  if (!b) return { ok: false, motif: "INTROUVABLE" };
  if (!peutModifier(droitsDe(b), { id: userId, communautes: new Set() })) return { ok: false, motif: "INTERDIT" };

  if (!ranger) {
    await db.save.deleteMany({ where: { boardId, productId: produitId } });
    return { ok: true, epinglee: false };
  }

  const publiee = await db.product.count({ where: { id: produitId, status: "PUBLISHED" } });
  if (publiee === 0) return { ok: false, motif: "RESSOURCE" };

  // L'unicité (boardId, productId) rend le double clic inoffensif.
  await db.save.upsert({
    where: { boardId_productId: { boardId, productId: produitId } },
    create: { boardId, productId: produitId },
    update: {},
  });
  return { ok: true, epinglee: true };
}

/** Parmi ces ressources, celles que le membre a rangées dans au moins une de ses collections. */
export async function epinglesParmi(userId: string | null, produitIds: readonly string[]): Promise<string[]> {
  if (!userId || produitIds.length === 0) return [];
  const lignes = await db.save.findMany({
    where: { board: { ownerId: userId }, productId: { in: [...produitIds] } },
    select: { productId: true },
    distinct: ["productId"],
  });
  return lignes.map((l) => l.productId).filter((id): id is string => id !== null);
}

/** Une collection et ce qu'elle contient, si le visiteur a le droit de la voir. `null` sinon. */
export async function collectionAVoir(userId: string, boardId: string) {
  const b = await db.board.findUnique({
    where: { id: boardId },
    select: {
      id: true,
      title: true,
      description: true,
      isPublic: true,
      ownerId: true,
      communityId: true,
      createdAt: true,
      community: { select: { name: true, slug: true } },
      owner: { select: { profile: { select: { displayName: true, username: true } } } },
      saves: {
        where: { product: { status: "PUBLISHED" } },
        orderBy: { createdAt: "desc" },
        select: { product: { select: { id: true, slug: true, name: true, coverUrl: true } } },
      },
    },
  });
  if (!b) return null;
  const v = await visiteur(userId);
  if (!peutVoir(droitsDe(b), v)) return null;

  return {
    id: b.id,
    titre: b.title,
    description: b.description,
    publique: b.isPublic,
    communaute: b.community ? { nom: b.community.name, slug: b.community.slug } : null,
    proprietaire: b.owner.profile?.displayName ?? "Membre",
    proprietaireUsername: b.owner.profile?.username ?? null,
    modifiable: peutModifier(droitsDe(b), v),
    ressources: b.saves.map((s) => s.product).filter((p): p is NonNullable<typeof p> => p !== null),
  };
}

export async function modifier(userId: string, boardId: string, c: { title: string; description: string | null; isPublic: boolean }): Promise<boolean> {
  const n = await db.board.updateMany({ where: { id: boardId, ownerId: userId }, data: c });
  return n.count > 0;
}

/** Supprime la collection et ce qu'elle range. Les ressources, elles, ne bougent pas. */
export async function supprimer(userId: string, boardId: string): Promise<boolean> {
  const n = await db.board.deleteMany({ where: { id: boardId, ownerId: userId } });
  return n.count > 0;
}
