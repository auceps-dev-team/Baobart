import type { PrismaClient } from "@prisma/client";

/**
 * Pose le statut « Créateur vérifié » sur des comptes de démonstration ou de
 * test, pour les scripts qui écrivent `Profile.isVerified: true`.
 *
 * `UserBadge` est la vérité, `isVerified` son reflet (`lib/badges/attribution.ts`,
 * migration `20261105090000_createur_verifie_reflet`). Un script qui ne pose
 * que le reflet fait diverger les deux : la fiche produit affiche « ✓ », le
 * profil public et l'écran des statuts disent « non vérifié ».
 *
 * Hors de `lib/` : `lib/badges/attribution.ts` importe `server-only`, qui
 * refuse de se charger dans un script lancé par `tsx`.
 */
export async function poserCreateurVerifie(db: PrismaClient, userIds: readonly string[]): Promise<void> {
  if (userIds.length === 0) return;
  const badge = await db.badge.upsert({
    where: { code: "VERIFIED_CREATOR" },
    update: {},
    create: {
      code: "VERIFIED_CREATOR",
      name: "Créateur vérifié",
      description: "Vérification manuelle par l'administration : pièce d'identité et cohérence du portfolio.",
    },
    select: { id: true },
  });
  await db.userBadge.createMany({
    data: userIds.map((userId) => ({ userId, badgeId: badge.id })),
    skipDuplicates: true,
  });
}
