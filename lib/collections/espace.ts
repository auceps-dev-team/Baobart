import "server-only";

import { db } from "@/lib/db";
import { ilYA } from "@/lib/social/regles";

/**
 * Ce que la section « Vos espaces d'équipe » de l'accueil montre.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TOUT Y ÉTAIT INVENTÉ, ET RIEN N'Y ÉTAIT CLIQUABLE
 *
 * Signalé le 04/10 : « Collection · Campagne Dakar 2026 — 4 membres · 38
 * ressources », les messages d'« Awa » et de « Kofi », « Inspiration wax 18 »,
 * des boutons « Inviter » et « Suivre » qui n'étaient que des étiquettes. Seuls
 * les créatifs à suivre venaient de la base — et c'étaient des comptes de test.
 *
 * Chaque bloc vient désormais de ce que le visiteur a vraiment :
 *   — son espace le plus actif, ses collections partagées et ses derniers
 *     messages ;
 *   — ses collections ;
 *   — des créateurs qui publient, qu'il ne suit pas encore.
 */

export interface Espace {
  nom: string;
  slug: string;
  membres: number;
  collections: number;
  ressources: number;
  apercu: string[];
  messages: { auteur: string; texte: string; quand: string }[];
}

/**
 * L'espace où il s'est passé quelque chose le plus récemment, parmi ceux dont
 * le visiteur est membre. `null` s'il n'est membre d'aucun.
 */
export async function espaceDuVisiteur(userId: string, maintenant = new Date()): Promise<Espace | null> {
  const adhesions = await db.communityMembership.findMany({
    where: { userId, community: { status: "active" } },
    select: { communityId: true, joinedAt: true },
  });
  if (adhesions.length === 0) return null;

  const derniers = await db.communityChatMessage.groupBy({
    by: ["communityId"],
    where: { communityId: { in: adhesions.map((a) => a.communityId) }, isFlagged: false },
    _max: { createdAt: true },
  });
  const activite = new Map(derniers.map((d) => [d.communityId, d._max.createdAt?.getTime() ?? 0]));
  const choisie = [...adhesions].sort(
    (a, b) =>
      Math.max(activite.get(b.communityId) ?? 0, b.joinedAt.getTime()) -
      Math.max(activite.get(a.communityId) ?? 0, a.joinedAt.getTime()),
  )[0]!;

  const c = await db.community.findUniqueOrThrow({
    where: { id: choisie.communityId },
    select: {
      name: true,
      slug: true,
      memberCount: true,
      collections: {
        select: {
          _count: { select: { saves: true } },
          saves: {
            where: { product: { status: "PUBLISHED", coverUrl: { not: null } } },
            orderBy: { createdAt: "desc" },
            take: 4,
            select: { product: { select: { coverUrl: true } } },
          },
        },
      },
      chatMessages: {
        where: { isFlagged: false },
        orderBy: { createdAt: "desc" },
        take: 2,
        select: { body: true, createdAt: true, author: { select: { profile: { select: { displayName: true } } } } },
      },
    },
  });

  return {
    nom: c.name,
    slug: c.slug,
    membres: c.memberCount,
    collections: c.collections.length,
    ressources: c.collections.reduce((n, b) => n + b._count.saves, 0),
    apercu: c.collections.flatMap((b) => b.saves.map((s) => s.product?.coverUrl)).filter((u): u is string => Boolean(u)).slice(0, 4),
    messages: c.chatMessages.map((m) => ({
      auteur: m.author.profile?.displayName ?? "Membre",
      texte: m.body.length > 140 ? `${m.body.slice(0, 139)}…` : m.body,
      quand: ilYA(m.createdAt, maintenant),
    })),
  };
}

export interface CreateurASuivre {
  id: string;
  username: string;
  nom: string;
  lieu: string | null;
  avatarUrl: string | null;
}

/**
 * Des créateurs qui publient, que le visiteur ne suit pas encore — jamais
 * lui-même. La règle de l'annuaire (`lib/createurs/queries.ts`) : on n'y
 * entre qu'en ayant publié, ce qui écarte acheteurs et comptes de test.
 */
export async function createursASuivre(visiteurId: string | null, limite = 3): Promise<CreateurASuivre[]> {
  const suivis = visiteurId
    ? (await db.follow.findMany({ where: { followerId: visiteurId }, select: { followingId: true } })).map((f) => f.followingId)
    : [];
  const exclus = visiteurId ? [visiteurId, ...suivis] : [];

  const profils = await db.profile.findMany({
    where: {
      userId: { notIn: exclus },
      user: { suspendedAt: null, products: { some: { status: "PUBLISHED" } } },
    },
    orderBy: [{ followerCount: "desc" }, { displayName: "asc" }],
    take: limite,
    select: { userId: true, username: true, displayName: true, city: true, avatarUrl: true },
  });
  return profils.map((p) => ({ id: p.userId, username: p.username, nom: p.displayName, lieu: p.city, avatarUrl: p.avatarUrl }));
}
