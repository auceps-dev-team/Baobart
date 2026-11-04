import "server-only";

import { Prisma } from "@prisma/client";

import { statutDe, type CodeStatut } from "@/lib/badges/statuts";
import { db } from "@/lib/db";
import { opposeDe, verdictPour } from "@/lib/services/badges";

/**
 * Poser et retirer un statut. Qui a le droit, et la trace : l'appelant
 * (`lib/badges/actions.ts`). Ce module tranche ce qui est cohérent.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA LIGNE `Badge` SE CRÉE ICI SI ELLE MANQUE
 *
 * Les badges étaient posés par `prisma/seed.ts`. Une base de production où le
 * seed n'a pas tourné n'aurait aucune ligne `Badge`, et le premier statut
 * accordé échouerait sur une clé étrangère. On l'assure donc au moment de
 * poser, par son code, avec le nom et la phrase du catalogue.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * FREELANCE ET AGENCE, EN UNE TRANSACTION
 *
 * Retirer l'autre puis poser celui-ci : entre les deux, le compte n'est jamais
 * l'un ET l'autre, ni — si l'écriture échoue — ni l'un ni l'autre.
 */

export type Pose =
  | { ok: true; retire: CodeStatut | null }
  | { ok: false; motif: "DEJA_POSE" | "INTROUVABLE" };

export async function accorderStatut(input: { userId: string; code: CodeStatut }): Promise<Pose> {
  const statut = statutDe(input.code);
  try {
    return await db.$transaction(async (tx) => {
      const compte = await tx.user.findUnique({
        where: { id: input.userId },
        select: { badges: { select: { badge: { select: { code: true } } } } },
      });
      if (!compte) return { ok: false as const, motif: "INTROUVABLE" as const };

      const actuels = compte.badges.map((b) => b.badge.code);
      let retire: CodeStatut | null = null;

      if (input.code === "FREELANCE" || input.code === "AGENCE") {
        const verdict = verdictPour({ aPoser: input.code, badgesActuels: actuels });
        if (!verdict.ok) return { ok: false as const, motif: "DEJA_POSE" as const };
        if (verdict.retirerAvant) {
          await tx.userBadge.deleteMany({
            where: { userId: input.userId, badge: { code: opposeDe(input.code) } },
          });
          retire = verdict.retirerAvant;
        }
      } else if (actuels.includes(input.code)) {
        return { ok: false as const, motif: "DEJA_POSE" as const };
      }

      const badge = await tx.badge.upsert({
        where: { code: input.code },
        update: {},
        create: { code: input.code, name: statut.nom, description: statut.comment },
        select: { id: true },
      });
      await tx.userBadge.create({ data: { userId: input.userId, badgeId: badge.id } });
      return { ok: true as const, retire };
    });
  } catch (cause) {
    // Deux administrateurs sur le même compte au même instant : l'unicité
    // (userId, badgeId) arrête le second. Ce n'est pas une panne.
    if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002") {
      return { ok: false, motif: "DEJA_POSE" };
    }
    throw cause;
  }
}

export type Retrait = { ok: true } | { ok: false; motif: "PAS_POSE" };

export async function retirerStatut(input: { userId: string; code: CodeStatut }): Promise<Retrait> {
  const { count } = await db.userBadge.deleteMany({
    where: { userId: input.userId, badge: { code: input.code } },
  });
  return count > 0 ? { ok: true } : { ok: false, motif: "PAS_POSE" };
}
