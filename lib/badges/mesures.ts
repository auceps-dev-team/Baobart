import "server-only";

import { Prisma } from "@prisma/client";

import { ABONNE_COMPTE_APRES_JOURS, cyclesPayesDAffilee, type Mesures } from "@/lib/badges/merites";
import { db } from "@/lib/db";
import { JOURS_DE_CADENCE, REGLAGES_PAR_DEFAUT, type Cadence } from "@/lib/ndank/cycle";
import { lireQualifications } from "@/lib/services/qualifications";

/**
 * Ce que la base dit d'un compte, pour trancher ses mérites
 * (`lib/badges/merites.ts`).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE VENTE ABOUTIE
 *
 * C'est le mot de la maquette, et `SPEC_GAMIFICATION` §6 en donne la règle :
 * « ventes annulées/remboursées ne comptent pas ». Une ligne compte quand :
 *   - elle est encaissée (`SUCCESSFUL`). Une ressource gratuite (`NOT_CHARGED`)
 *     n'est pas une vente : sinon une ressource offerte et cent comptes
 *     jetables donneraient « Cent ventes » ;
 *   - l'acheteur n'est pas le vendeur ;
 *   - elle n'est pas remboursée en entier — pourboire compris, comme
 *     `encaisseDe` (`lib/domain/encaisse.ts`). Un remboursement partiel laisse
 *     une vente : l'acheteur a gardé quelque chose ;
 *   - elle n'est pas sous litige ouvert ou perdu. Un litige gagné
 *     (`chargebackReversedAt`) la rend : le vendeur a prouvé la livraison.
 *
 * Puis on compte les ACHETEURS différents, pas les lignes (décision du
 * 08/11/2026, voir `Mesures`).
 *
 * Les tableaux de bord comptent autrement (`SUCCESSFUL` et `NOT_CHARGED`,
 * remboursées comprises, une ligne par vente) : ils mesurent l'activité, pas
 * un mérite. Les deux chiffres peuvent donc différer sur un même écran — c'est
 * voulu, et le critère publié le dit.
 *
 * La règle vit en SQL, une seule fois (`LIGNE_ABOUTIE`), parce qu'un créateur
 * à mille ventes ne doit pas faire remonter mille lignes à chaque affichage de
 * son profil. `estUneVenteAboutie` l'écrit en TypeScript, et le test
 * d'intégration vérifie que les deux disent la même chose sur des lignes
 * tirées au hasard.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE DERNIER LITIGE
 *
 * « Sans litige » : 50 acheteurs servis sans un seul litige, « un litige remet
 * à zéro ». On compte les acheteurs des ventes abouties conclues APRÈS la date
 * du dernier litige ouvert ou perdu (`chargebackAt`). Un litige gagné ne remet
 * rien à zéro.
 */

/** La règle, en SQL, sur une ligne `oi` jointe à sa commande `o` et à sa ressource `p`. */
export const LIGNE_ABOUTIE = Prisma.sql`(
  oi."state"::text = 'SUCCESSFUL'
  AND o."buyerId" <> p."sellerId"
  AND oi."refundedAmount" < oi."price" * oi."quantity" + oi."tipAmount"
  AND (oi."chargebackAt" IS NULL OR oi."chargebackReversedAt" IS NOT NULL)
)`;

/** La même règle, en TypeScript : la référence du test qui compare les deux. */
export function estUneVenteAboutie(ligne: {
  state: string;
  acheteurId: string;
  vendeurId: string;
  refundedAmount: number;
  price: number;
  quantity: number;
  tipAmount: number;
  chargebackAt: Date | null;
  chargebackReversedAt: Date | null;
}): boolean {
  return (
    ligne.state === "SUCCESSFUL" &&
    ligne.acheteurId !== ligne.vendeurId &&
    ligne.refundedAmount < ligne.price * ligne.quantity + ligne.tipAmount &&
    (ligne.chargebackAt === null || ligne.chargebackReversedAt !== null)
  );
}

interface LigneAcheteurs {
  acheteurs: bigint | number;
  depuis_litige: bigint | number;
}

async function acheteursDe(vendeurId: string): Promise<{ acheteurs: number; depuisLitige: number }> {
  const [ligne] = await db.$queryRaw<LigneAcheteurs[]>`
    WITH lignes AS (
      SELECT
        o."buyerId" AS acheteur,
        oi."createdAt",
        oi."chargebackAt",
        oi."chargebackReversedAt",
        ${LIGNE_ABOUTIE} AS aboutie
      FROM "OrderItem" oi
      JOIN "Product" p ON p."id" = oi."productId"
      JOIN "Order" o ON o."id" = oi."orderId"
      WHERE p."sellerId" = ${vendeurId}
    ),
    dernier AS (
      SELECT MAX("chargebackAt") AS le
      FROM lignes
      WHERE "chargebackAt" IS NOT NULL AND "chargebackReversedAt" IS NULL
    )
    SELECT
      COUNT(DISTINCT l.acheteur) FILTER (WHERE l.aboutie) AS acheteurs,
      COUNT(DISTINCT l.acheteur) FILTER (WHERE l.aboutie AND (d.le IS NULL OR l."createdAt" > d.le)) AS depuis_litige
    FROM lignes l CROSS JOIN dernier d`;
  return { acheteurs: Number(ligne?.acheteurs ?? 0), depuisLitige: Number(ligne?.depuis_litige ?? 0) };
}

export async function mesuresDe(userId: string, maintenant: Date = new Date()): Promise<Mesures | null> {
  const compte = await db.user.findUnique({
    where: { id: userId },
    select: {
      createdAt: true,
      badges: {
        where: { badge: { code: { in: ["VIP_CREATOR", "TOP_CREATOR"] } } },
        select: { validUntil: true, badge: { select: { code: true } } },
      },
    },
  });
  if (!compte) return null;

  const inscritAvant = new Date(maintenant.getTime() - ABONNE_COMPTE_APRES_JOURS * 86_400_000);

  const [avant, ressourcesPubliees, acheteurs, abonnes, paiements, qualifications] = await Promise.all([
    // Le rang d'inscription. Un compte effacé est anonymisé, pas supprimé
    // (`lib/rgpd/effacement.ts`) : il garde sa place, et les rangs ne
    // glissent pas. L'identifiant départage deux inscriptions à la même
    // milliseconde.
    db.user.count({
      where: {
        OR: [
          { createdAt: { lt: compte.createdAt } },
          { createdAt: compte.createdAt, id: { lt: userId } },
        ],
      },
    }),
    db.product.count({ where: { sellerId: userId, status: "PUBLISHED" } }),
    acheteursDe(userId),
    // Les lignes `Follow`, pas `Profile.followerCount` : ce compteur
    // dénormalisé dérive (inventaire du 04/11, B8). Et seulement les abonnés
    // qui comptent : ni suspendus, ni effacés, ni ouverts dans la semaine.
    db.follow.count({
      where: {
        followingId: userId,
        follower: { suspendedAt: null, anonymizedAt: null, createdAt: { lte: inscritAvant } },
      },
    }),
    db.subscriptionPayment.findMany({
      where: { status: "PAID", amount: { gt: 0 }, cycleEnd: { not: null }, paidAt: { not: null }, subscription: { userId } },
      select: { cycleEnd: true, paidAt: true, subscriptionId: true, subscription: { select: { cadence: true } } },
    }),
    lireQualifications(userId, maintenant),
  ]);

  const titre = compte.badges.find((b) => b.badge.code === "TOP_CREATOR");

  return {
    maintenant,
    inscritLe: compte.createdAt,
    rangDInscription: avant + 1,
    ressourcesPubliees,
    acheteurs: acheteurs.acheteurs,
    acheteursDepuisLeDernierLitige: acheteurs.depuisLitige,
    abonnes,
    // Pas d'abonnement ouvert, pas de série en cours : quoi que disent les
    // paiements passés. Voir `Mesures.abonnementOuvert`.
    cyclesPayesDAffilee: !qualifications.abonnementOuvert ? 0 : cyclesPayesDAffilee(
      paiements.map((p) => ({
        abonnementId: p.subscriptionId,
        echeance: p.cycleEnd!,
        payeLe: p.paidAt!,
        joursDuCycle: JOURS_DE_CADENCE[p.subscription.cadence as Cadence],
      })),
      maintenant,
      REGLAGES_PAR_DEFAUT.graceJours,
    ),
    abonnementOuvert: qualifications.abonnementOuvert,
    createurDuMoisJusquAu: titre?.validUntil ?? null,
    vip: compte.badges.some((b) => b.badge.code === "VIP_CREATOR"),
  };
}
