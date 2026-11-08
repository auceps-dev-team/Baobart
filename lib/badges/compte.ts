import "server-only";

import { lesPlusProches, meritesObtenus, type Merite, type Proche } from "@/lib/badges/merites";
import { mesuresDe } from "@/lib/badges/mesures";
import { ecussonsDuCompte, type Ecusson } from "@/lib/badges/statuts";
import { db } from "@/lib/db";
import { lireQualifications } from "@/lib/services/qualifications";

export interface BadgesDuCompte {
  /** Ce que Baobart garantit : jamais tronqué. */
  ecussons: Ecusson[];
  /** Ce que l'activité constate, du plus rare au plus courant. */
  merites: Merite[];
  /** Les trois plus proches — l'espace privé seulement. */
  proches: Proche[];
  /** La fin du titre « Créateur du mois », quand il court : la maquette l'affiche. */
  createurDuMoisJusquAu: Date | null;
}

/**
 * Les deux familles d'un compte, lues ensemble.
 *
 * Les statuts viennent de `UserBadge` (posés au lot 1, `lib/badges/attribution.ts`)
 * et, pour « Identité vérifiée », de `User.kycStatus` : il ne se pose pas à la
 * main. Les mérites se recalculent (`lib/badges/mesures.ts`).
 */
export async function badgesDuCompte(userId: string, maintenant: Date = new Date()): Promise<BadgesDuCompte | null> {
  const [compte, qualifications, mesures] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true, badges: { select: { badge: { select: { code: true } } } } },
    }),
    lireQualifications(userId, maintenant),
    mesuresDe(userId, maintenant),
  ]);
  if (!compte || !mesures) return null;

  return {
    ecussons: ecussonsDuCompte({
      statuts: compte.badges.map((b) => b.badge.code),
      identiteVerifiee: compte.kycStatus === "VERIFIED",
      abonnementOuvert: qualifications.abonnementOuvert,
    }),
    merites: meritesObtenus(mesures),
    proches: lesPlusProches(mesures),
    createurDuMoisJusquAu:
      mesures.createurDuMoisJusquAu && mesures.createurDuMoisJusquAu > maintenant ? mesures.createurDuMoisJusquAu : null,
  };
}
