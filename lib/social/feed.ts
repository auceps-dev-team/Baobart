import "server-only";

import { db } from "@/lib/db";

/**
 * Quelles cartes de cette page le visiteur a-t-il déjà aimées ?
 *
 * Une seule requête pour toute la page, bornée aux ressources affichées : un
 * `like` par carte ferait vingt-cinq allers-retours pour dessiner un cœur.
 */
export async function aimesParmi(
  userId: string | null,
  produitIds: string[],
): Promise<string[]> {
  if (!userId || produitIds.length === 0) return [];

  const likes = await db.like.findMany({
    where: { userId, productId: { in: produitIds } },
    select: { productId: true },
  });

  return likes
    .map((l) => l.productId)
    .filter((id): id is string => id !== null);
}
