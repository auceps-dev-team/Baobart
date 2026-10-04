import "server-only";

import { db } from "@/lib/db";

/**
 * Les témoignages, côté base. Les règles sont dans `regles.ts`.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * PERSONNE NE PUBLIE LE SIEN
 *
 * Un administrateur est aussi un membre, et peut proposer un témoignage comme
 * les autres. Le publier lui-même ferait de lui le relecteur de son propre
 * texte — le défaut déjà corrigé sur les événements, où l'organisateur se
 * retrouvait nommé relecteur de sa fiche en l'envoyant.
 */

export async function monTemoignage(auteurId: string) {
  return db.testimonial.findUnique({ where: { authorId: auteurId } });
}

/**
 * Propose, ou corrige. Une correction repart en relecture : ce qui a été
 * publié n'est pas ce qui vient d'être écrit.
 */
export async function proposer(auteurId: string, t: { body: string; role: string | null }): Promise<void> {
  const maintenant = new Date();
  const enRelecture = {
    body: t.body,
    role: t.role,
    consentAt: maintenant,
    status: "PENDING" as const,
    refusedReason: null,
    moderatorId: null,
    moderatedAt: null,
    publishedAt: null,
  };
  await db.testimonial.upsert({
    where: { authorId: auteurId },
    create: { authorId: auteurId, ...enRelecture },
    update: enRelecture,
  });
}

/** Retirer le sien, publié ou non. Le retrait de l'accord ne se discute pas. */
export async function retirerLeMien(auteurId: string): Promise<void> {
  await db.testimonial.deleteMany({ where: { authorId: auteurId } });
}

export type Decision = "PUBLIER" | "REFUSER" | "RETIRER";

export type Issue =
  | { ok: true; auteurId: string }
  | { ok: false; motif: "INTROUVABLE" | "PROPRE_TEMOIGNAGE" | "DEJA_TRANCHE" };

/**
 * Publier, refuser (avec un motif, vérifié par l'appelant), ou retirer un
 * témoignage déjà publié — il redevient « refusé », motif à l'appui.
 */
export async function trancher(input: {
  id: string;
  decision: Decision;
  moderateurId: string;
  motif?: string;
}): Promise<Issue> {
  const t = await db.testimonial.findUnique({ where: { id: input.id }, select: { authorId: true, status: true } });
  if (!t) return { ok: false, motif: "INTROUVABLE" };
  if (t.authorId === input.moderateurId) return { ok: false, motif: "PROPRE_TEMOIGNAGE" };

  const attendu = input.decision === "RETIRER" ? "APPROVED" : "PENDING";
  const maintenant = new Date();

  // Conditionné sur l'état lu : deux relecteurs qui tranchent en même temps
  // ne s'écrasent pas, le second apprend que c'est déjà fait.
  const n = await db.testimonial.updateMany({
    where: { id: input.id, status: attendu },
    data:
      input.decision === "PUBLIER"
        ? { status: "APPROVED", publishedAt: maintenant, refusedReason: null, moderatorId: input.moderateurId, moderatedAt: maintenant }
        : { status: "REJECTED", publishedAt: null, refusedReason: input.motif?.trim() ?? null, moderatorId: input.moderateurId, moderatedAt: maintenant },
  });
  if (n.count === 0) return { ok: false, motif: "DEJA_TRANCHE" };
  return { ok: true, auteurId: t.authorId };
}

const AUTEUR = {
  select: {
    suspendedAt: true,
    profile: { select: { displayName: true, username: true, avatarUrl: true, speciality: true } },
  },
} as const;

/** La file de l'administration : à relire d'abord, puis le reste. */
export async function aModerer() {
  const lignes = await db.testimonial.findMany({
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
    include: { author: AUTEUR },
  });
  const rang = { PENDING: 0, APPROVED: 1, REJECTED: 2 } as const;
  return lignes.sort((a, b) => rang[a.status] - rang[b.status]);
}

export interface TemoignagePublic {
  id: string;
  texte: string;
  nom: string;
  presentation: string | null;
  avatarUrl: string | null;
  username: string | null;
}

/**
 * Ce que l'accueil montre : les publiés, les plus récents d'abord. Un auteur
 * suspendu n'y paraît plus — ce qu'il a dit de la plateforme ne vaut pas
 * mieux que ce qu'il y a fait.
 */
export async function temoignagesPublies(limite = 4): Promise<TemoignagePublic[]> {
  const lignes = await db.testimonial.findMany({
    where: { status: "APPROVED", author: { suspendedAt: null } },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: limite,
    include: { author: AUTEUR },
  });
  return lignes.map((t) => ({
    id: t.id,
    texte: t.body,
    nom: t.author.profile?.displayName ?? "Membre Baobart",
    presentation: t.role ?? t.author.profile?.speciality ?? null,
    avatarUrl: t.author.profile?.avatarUrl ?? null,
    username: t.author.profile?.username ?? null,
  }));
}
