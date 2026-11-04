import "server-only";

import type { KycStatus } from "@prisma/client";

import { estCodeStatut, STATUTS, type CodeStatut } from "@/lib/badges/statuts";
import { db } from "@/lib/db";

/**
 * Les comptes tels que l'écran des statuts les montre : ce qu'ils portent, et
 * la provenance de chaque statut — qui l'a accordé, quand, pourquoi. La
 * maquette veut « la fiche admin : tout, avec la provenance » ; la provenance
 * est la trace d'audit (`statut.accorder`), on ne la recopie pas ailleurs.
 */

export const FILTRES_STATUTS = ["Tous", "Avec un statut"] as const;
export type FiltreStatuts = (typeof FILTRES_STATUTS)[number];

export function filtreStatutsValide(brut: string | undefined): FiltreStatuts {
  return (FILTRES_STATUTS as readonly string[]).includes(brut ?? "") ? (brut as FiltreStatuts) : "Tous";
}

const PAGE = 40;

export interface CompteStatuts {
  id: string;
  nom: string;
  email: string;
  produits: number;
  kyc: KycStatus;
  statuts: CodeStatut[];
  /** La dernière décision sur un statut de ce compte, s'il y en a une. */
  derniere: { action: "statut.accorder" | "statut.retirer"; statut: string; motif: string; auteur: string; le: Date } | null;
}

export async function comptesPourStatuts(input: { filtre: FiltreStatuts; q: string }): Promise<{
  comptes: CompteStatuts[];
  detenteurs: Record<CodeStatut, number>;
}> {
  const q = input.q.trim().slice(0, 80);
  const codes = STATUTS.map((s) => s.code);

  const comptes = await db.user.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" as const } },
              { profile: { displayName: { contains: q, mode: "insensitive" as const } } },
              { profile: { username: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
      ...(input.filtre === "Avec un statut" ? { badges: { some: { badge: { code: { in: codes } } } } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: PAGE,
    select: {
      id: true,
      email: true,
      kycStatus: true,
      profile: { select: { displayName: true } },
      _count: { select: { products: true } },
      badges: { select: { badge: { select: { code: true } } } },
    },
  });

  // Une seule requête pour toutes les traces des comptes affichés.
  const traces = comptes.length
    ? await db.auditLog.findMany({
        where: {
          action: { in: ["statut.accorder", "statut.retirer"] },
          resource: { in: comptes.map((c) => `user:${c.id}`) },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { action: true, resource: true, details: true, actorId: true, createdAt: true },
      })
    : [];
  const auteurs = await db.user.findMany({
    where: { id: { in: [...new Set(traces.map((t) => t.actorId))] } },
    select: { id: true, email: true, profile: { select: { displayName: true } } },
  });
  const nomDe = new Map(auteurs.map((a) => [a.id, a.profile?.displayName ?? a.email]));
  const premiere = new Map<string, (typeof traces)[number]>();
  for (const t of traces) if (!premiere.has(t.resource)) premiere.set(t.resource, t);

  const groupes = await db.userBadge.groupBy({
    by: ["badgeId"],
    _count: { _all: true },
  });
  const badges = await db.badge.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const detenteurs = Object.fromEntries(codes.map((c) => [c, 0])) as Record<CodeStatut, number>;
  for (const b of badges) {
    if (estCodeStatut(b.code)) detenteurs[b.code] = groupes.find((g) => g.badgeId === b.id)?._count._all ?? 0;
  }

  return {
    detenteurs,
    comptes: comptes.map((c) => {
      const t = premiere.get(`user:${c.id}`);
      const d = (t?.details ?? {}) as { statut?: string; motif?: string };
      return {
        id: c.id,
        nom: c.profile?.displayName ?? c.email,
        email: c.email,
        produits: c._count.products,
        kyc: c.kycStatus,
        statuts: c.badges.map((b) => b.badge.code).filter(estCodeStatut),
        derniere: t
          ? {
              action: t.action as "statut.accorder" | "statut.retirer",
              statut: d.statut ?? "",
              motif: d.motif ?? "",
              auteur: nomDe.get(t.actorId) ?? "compte supprimé",
              le: t.createdAt,
            }
          : null,
      };
    }),
  };
}
