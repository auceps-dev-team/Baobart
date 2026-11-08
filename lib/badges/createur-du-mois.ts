import "server-only";

import { Prisma } from "@prisma/client";

import { TETE_DU_MOIS, meriteDe, tetesDuMois } from "@/lib/badges/merites";
import { LIGNE_ABOUTIE } from "@/lib/badges/mesures";
import { urlDuSite } from "@/lib/config/site";
import { db } from "@/lib/db";
import { notifier } from "@/lib/notifications/aiguilleur";

/**
 * Le passage quotidien qui désigne les créateurs du mois.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI CE MÉRITE-LÀ EST RANGÉ (décision du 08/11/2026)
 *
 * Les autres mérites se calculent à l'affichage. Celui-ci s'annonce quand on le
 * gagne (« 🎉 », `SPEC_GAMIFICATION` §5) et porte sa date de fin (« sa valeur
 * vient de sa date », maquette des badges) : il faut donc se souvenir de quand
 * on l'a gagné. `UserBadge.validUntil` existe pour cela.
 *
 * Effet de bord voulu : le profil ne relit plus trente jours de ventes de toute
 * la plateforme à chaque visite. Il lit une ligne.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TROIS CAS, ET UN SEUL S'ANNONCE
 *
 *   - en tête, sans titre en cours : le titre est posé pour 30 jours, et
 *     annoncé ;
 *   - en tête, titre en cours : il est prolongé de 30 jours à partir
 *     d'aujourd'hui, sans rien dire — on ne félicite pas chaque matin ;
 *   - plus en tête : rien. Le titre s'éteint seul à sa date. « Aucune
 *     notification poussée, aucun courriel » pour une perte (maquette).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * REJOUÉ, IL NE CHANGE RIEN
 *
 * Le passage peut tourner deux fois le même jour (une relance à la main, un
 * ordonnanceur qui réessaie). La pose est conditionnelle — elle ne réussit que
 * sur un titre absent ou éteint —, et la clé de l'avis porte le jour du gain :
 * un second passage prolonge, il ne réannonce pas.
 */

const JOUR = 86_400_000;

/** Les créateurs en tête des 30 derniers jours, comptés en acheteurs différents. */
export async function classementDuMois(maintenant: Date): Promise<Set<string>> {
  const depuis = new Date(maintenant.getTime() - TETE_DU_MOIS.jours * JOUR);
  const lignes = await db.$queryRaw<Array<{ vendeur: string; acheteurs: bigint | number }>>`
    SELECT p."sellerId" AS vendeur, COUNT(DISTINCT o."buyerId") AS acheteurs
    FROM "OrderItem" oi
    JOIN "Product" p ON p."id" = oi."productId"
    JOIN "Order" o ON o."id" = oi."orderId"
    JOIN "User" u ON u."id" = p."sellerId"
    WHERE oi."state"::text = 'SUCCESSFUL'
      AND oi."createdAt" >= ${depuis}
      AND oi."createdAt" <= ${maintenant}
      AND u."suspendedAt" IS NULL
      AND ${LIGNE_ABOUTIE}
    GROUP BY p."sellerId"`;
  // On ne félicite pas un compte suspendu : il est sous enquête, et son
  // titre se lirait sur une vitrine fermée. Il ne compte pas non plus parmi
  // les actifs, sans quoi il occuperait une place de tête.
  const classement = lignes.map((l) => ({ vendeurId: l.vendeur, ventes: Number(l.acheteurs) }));
  return tetesDuMois(classement, classement.length);
}

export interface Bilan {
  /** Titres posés et annoncés ce jour. */
  nommes: number;
  /** Titres en cours, prolongés sans annonce. */
  prolonges: number;
}

function dateLisible(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export async function designerLesCreateursDuMois(maintenant: Date = new Date()): Promise<Bilan> {
  const tetes = await classementDuMois(maintenant);
  const bilan: Bilan = { nommes: 0, prolonges: 0 };
  if (tetes.size === 0) return bilan;

  const merite = meriteDe("TOP_CREATOR");
  const badge = await db.badge.upsert({
    where: { code: "TOP_CREATOR" },
    update: {},
    create: { code: "TOP_CREATOR", name: merite.nom, description: merite.critere },
    select: { id: true },
  });
  const jusquAu = new Date(maintenant.getTime() + TETE_DU_MOIS.jours * JOUR);
  const base = urlDuSite();

  for (const userId of tetes) {
    // Un titre en cours : prolongé, sans un mot.
    const prolonge = await db.userBadge.updateMany({
      where: { userId, badgeId: badge.id, validUntil: { gt: maintenant } },
      data: { validUntil: jusquAu },
    });
    if (prolonge.count > 0) {
      bilan.prolonges += 1;
      continue;
    }

    // Un titre absent ou éteint : posé de nouveau, et annoncé.
    const nomme = await poserLeTitre(userId, badge.id, maintenant, jusquAu);
    if (!nomme) continue;
    bilan.nommes += 1;

    const jour = maintenant.toISOString().slice(0, 10);
    await notifier({
      destinataireId: userId,
      evenement: "CREATEUR_DU_MOIS",
      cle: `createur-du-mois-${userId}-${jour}`,
      titre: "🎉 Tu es Créateur du mois",
      corps: `Sur les 30 derniers jours, tu fais partie des créateurs qui ont vendu au plus d'acheteurs différents. Le jeton s'affiche sur ta vitrine jusqu'au ${dateLisible(jusquAu)}.`,
      lien: "/dashboard/badges",
      // Sans adresse du site, le lien du courriel serait invalide et le rendu
      // échouerait : l'avis reste alors dans la cloche.
      ...(base
        ? { charge: { jusquAu: dateLisible(jusquAu), lien: `${base}/dashboard/badges` } }
        : { canaux: ["IN_APP" as const] }),
    });
  }

  return bilan;
}

/**
 * Pose le titre s'il est absent ou éteint. `false` si un autre passage l'a
 * posé entre-temps : c'est lui qui annonce.
 */
async function poserLeTitre(userId: string, badgeId: string, maintenant: Date, jusquAu: Date): Promise<boolean> {
  const ravive = await db.userBadge.updateMany({
    where: { userId, badgeId, OR: [{ validUntil: null }, { validUntil: { lte: maintenant } }] },
    data: { awardedAt: maintenant, validUntil: jusquAu },
  });
  if (ravive.count > 0) return true;
  try {
    await db.userBadge.create({ data: { userId, badgeId, awardedAt: maintenant, validUntil: jusquAu } });
    return true;
  } catch (cause) {
    if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002") return false;
    throw cause;
  }
}
