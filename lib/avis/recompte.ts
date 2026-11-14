import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";

/**
 * Recompter les avis d'une ressource, et la note de son créateur.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * RECOMPTER, JAMAIS INCRÉMENTER
 *
 * Gumroad tient ses compteurs par étoile par `+ 1` / `- 1`
 * (`product_review_stat.rb`, lu le 09/11/2026), et son propre commentaire dit
 * que le total dérivé dépend de l'ordre dans lequel le SQL évalue ses `SET`.
 * Le 08/11, Baobart a payé un compteur que personne n'écrivait (les abonnés,
 * inventaire B8). On recompte donc tout, depuis les lignes, à chaque écriture :
 * le compteur rangé ne peut pas dériver de la vérité, il en est la photo.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * QUI DÉCLENCHE
 *
 * - écrire, modifier, retirer un avis (`lib/avis/service.ts`), dans la même
 *   transaction ;
 * - un changement sur une ligne d'achat qui fait entrer ou sortir un avis des
 *   comptes : encaissement, remboursement, litige ouvert ou gagné, accès retiré
 *   ou rendu (`recompterApresLigne`, APRÈS la transaction d'argent) ;
 * - un balayage nocturne (`/api/cron/avis`), filet de sécurité si l'un des
 *   précédents a échoué.
 */

/**
 * « L'avis compte », en SQL, sur un avis `r` et sa ressource `p`. Le pendant
 * exact de `aObtenu` (`lib/avis/regles.ts`) et de `resteAToi` : le test
 * d'intégration compare les deux sur des achats tirés au hasard.
 */
export const AVIS_COMPTE = Prisma.sql`(
  r."hiddenAt" IS NULL
  AND r."authorId" <> p."sellerId"
  AND EXISTS (
    SELECT 1
    FROM "OrderItem" oi
    JOIN "Order" o ON o."id" = oi."orderId"
    WHERE oi."productId" = r."productId"
      AND o."buyerId" = r."authorId"
      AND oi."state"::text IN ('SUCCESSFUL', 'NOT_CHARGED')
      AND NOT (
        oi."price" * oi."quantity" + oi."tipAmount" > 0
        AND oi."refundedAmount" >= oi."price" * oi."quantity" + oi."tipAmount"
      )
      AND (oi."chargebackAt" IS NULL OR oi."chargebackReversedAt" IS NOT NULL)
      AND oi."accessRevokedAt" IS NULL
  )
)`;

/** Ce que le recompte touche : `db`, ou le client d'une transaction. */
export type ClientAvis = Pick<Prisma.TransactionClient, "$queryRaw" | "product" | "profile">;

function moyenne(somme: number, total: number): number {
  return total === 0 ? 0 : Math.round((somme / total) * 100) / 100;
}

/** Recompte une ressource, puis la note de son créateur. */
export async function recompterAvis(produitId: string, client: ClientAvis = db): Promise<void> {
  const produit = await client.product.findUnique({ where: { id: produitId }, select: { sellerId: true } });
  if (!produit) return;

  const parNote = await client.$queryRaw<Array<{ note: number; n: bigint | number }>>`
    SELECT r."rating" AS note, COUNT(*) AS n
    FROM "ProductReview" r
    JOIN "Product" p ON p."id" = r."productId"
    WHERE r."productId" = ${produitId} AND ${AVIS_COMPTE}
    GROUP BY r."rating"`;

  const etoiles = [0, 0, 0, 0, 0];
  for (const l of parNote) etoiles[l.note - 1] = Number(l.n);
  const total = etoiles.reduce((s, n) => s + n, 0);
  const somme = etoiles.reduce((s, n, i) => s + n * (i + 1), 0);

  await client.product.update({
    where: { id: produitId },
    data: { ratingStars: etoiles, ratingCount: total, ratingAvg: moyenne(somme, total) },
  });

  // La note du créateur : tous les avis comptés de toutes ses ressources. La
  // vitrine l'affiche (« 4,9 sur 128 avis ») ; elle restait à zéro faute
  // d'écrivain (inventaire A3).
  const [createur] = await client.$queryRaw<Array<{ n: bigint | number; somme: bigint | number | null }>>`
    SELECT COUNT(*) AS n, SUM(r."rating") AS somme
    FROM "ProductReview" r
    JOIN "Product" p ON p."id" = r."productId"
    WHERE p."sellerId" = ${produit.sellerId} AND ${AVIS_COMPTE}`;
  const n = Number(createur?.n ?? 0);
  await client.profile.updateMany({
    where: { userId: produit.sellerId },
    data: { ratingCount: n, ratingAvg: moyenne(Number(createur?.somme ?? 0), n) },
  });
}

/**
 * Après un changement sur une ligne d'achat : si son acheteur a noté la
 * ressource, l'avis entre peut-être dans les comptes, ou en sort.
 *
 * Appelé APRÈS la transaction d'argent, jamais dedans, et il ne lève jamais :
 * un remboursement fait reste fait, même si le recompte échoue — le balayage
 * nocturne le rattrapera. Même règle que l'aiguilleur des notifications.
 */
export async function recompterApresLigne(orderItemId: string): Promise<void> {
  try {
    const ligne = await db.orderItem.findUnique({
      where: { id: orderItemId },
      select: { productId: true, order: { select: { buyerId: true } } },
    });
    if (!ligne) return;
    const avis = await db.productReview.findUnique({
      where: { authorId_productId: { authorId: ligne.order.buyerId, productId: ligne.productId } },
      select: { id: true },
    });
    if (!avis) return;
    await recompterAvis(ligne.productId);
  } catch (cause) {
    journal.erreur("recompte des avis en échec après un changement de ligne", {
      orderItemId,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
  }
}

/** Le balayage nocturne : toute ressource qui a un avis, ou qui en affichait. */
export async function recompterTousLesAvis(): Promise<number> {
  const produits = await db.product.findMany({
    where: { OR: [{ reviews: { some: {} } }, { ratingCount: { gt: 0 } }] },
    select: { id: true },
  });
  for (const p of produits) await recompterAvis(p.id);
  return produits.length;
}
