/**
 * Autorisation et enregistrement d'un téléchargement.
 *
 * Câble `delivery.ts` (le décideur) sur la base : retrouve le titre d'accès de
 * la personne — un achat, ou un abonnement avec son quota — décide, puis
 * enregistre la consommation et décompte le quota s'il y a lieu.
 *
 * Le décompte du quota et l'enregistrement de l'événement se font dans la même
 * transaction : un téléchargement compté sans être servi, ou servi sans être
 * compté, fausse la facture du créateur autant que la promesse faite à
 * l'acheteur.
 */

import type { ConsumptionType } from "@prisma/client";

import { db } from "@/lib/db";
import {
  decideAcces,
  dureeUrlSignee,
  periodeQuota,
  plateformeDepuisUserAgent,
  type DecisionAcces,
} from "@/lib/domain/delivery";

export interface TelechargementInput {
  userId: string;
  productFileId: string;
  eventType?: ConsumptionType;
  userAgent?: string | null;
  ipAddress?: string | null;
  now?: Date;
}

export interface TelechargementResultat {
  decision: DecisionAcces;
  /** Durée de validité de l'URL signée à générer, en secondes. */
  dureeUrlSecondes: number | null;
  fichier: { id: string; filename: string; sizeBytes: number } | null;
}

/**
 * Décide si cette personne peut télécharger ce fichier, et enregistre la
 * consommation si oui.
 */
export async function autoriserTelechargement(
  input: TelechargementInput,
): Promise<TelechargementResultat> {
  const {
    userId,
    productFileId,
    eventType = "DOWNLOAD",
    userAgent = null,
    ipAddress = null,
    now = new Date(),
  } = input;

  return db.$transaction(async (tx) => {
    const fichier = await tx.productFile.findUniqueOrThrow({
      where: { id: productFileId },
      include: { product: true },
    });

    // Un aperçu n'est pas une livraison. Il est déjà public : le servir ici
    // gonflerait le compteur de téléchargements et, pour un abonné,
    // consommerait un quota pour une vignette.
    if (fichier.role !== "SOURCE") {
      return {
        decision: { autorise: false, raison: "COMMANDE_NON_PAYEE" } as const,
        dureeUrlSecondes: null,
        fichier: null,
      };
    }

    // 1. Une ressource offerte se retire sans commande — voir `SourceAcces`.
    if (fichier.product.price === 0) {
      const decision = decideAcces({
        source: "GRATUIT",
        achatAbouti: true,
        now,
      });

      await tx.consumptionEvent.create({
        data: {
          userId,
          productId: fichier.productId,
          productFileId,
          eventType,
          platform: plateformeDepuisUserAgent(userAgent),
          ipAddress,
          consumedAt: now,
        },
      });

      await tx.product.update({
        where: { id: fichier.productId },
        data: { downloadsCount: { increment: 1 } },
      });

      return {
        decision,
        dureeUrlSecondes: dureeUrlSignee(fichier.sizeBytes),
        fichier: {
          id: fichier.id,
          filename: fichier.filename,
          sizeBytes: fichier.sizeBytes,
        },
      };
    }

    // 2. Un achat à l'unité prime : il donne un droit permanent, hors quota.
    const achat = await tx.orderItem.findFirst({
      where: {
        productId: fichier.productId,
        state: { in: ["SUCCESSFUL", "NOT_CHARGED"] },
        order: { buyerId: userId },
      },
      orderBy: { createdAt: "desc" },
    });

    const dejaTelecharge = await tx.consumptionEvent.findFirst({
      where: { userId, productFileId },
      select: { id: true },
    });

    let decision: DecisionAcces;
    let quotaId: string | null = null;

    if (achat) {
      const totalPaye = achat.price * achat.quantity;
      decision = decideAcces({
        source: "ACHAT",
        achatAbouti: true,
        rembourseIntegralement:
          totalPaye > 0 && achat.refundedAmount >= totalPaye,
        // Une contestation tranchée en faveur du vendeur rend l'accès : c'est
        // la date de renversement qui la referme, pas sa disparition.
        litigeEnCours:
          achat.chargebackAt !== null && achat.chargebackReversedAt === null,
        accesRetire: achat.accessRevokedAt !== null,
        dejaTelecharge: dejaTelecharge !== null,
        now,
      });
    } else {
      // 3. Sinon, un abonnement actif et son quota du mois.
      const abonnement = await tx.subscription.findFirst({
        where: { userId, status: "ACTIVE" },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
      });

      if (!abonnement) {
        return {
          decision: { autorise: false, raison: "COMMANDE_NON_PAYEE" } as const,
          dureeUrlSecondes: null,
          fichier: null,
        };
      }

      const periode = periodeQuota(now);
      const limite = abonnement.plan.downloadsPerMonth;

      let quota =
        limite === null
          ? null
          : await tx.downloadQuota.findUnique({
              where: {
                subscriptionId_period: {
                  subscriptionId: abonnement.id,
                  period: periode,
                },
              },
            });

      if (limite !== null && quota === null) {
        quota = await tx.downloadQuota.create({
          data: { subscriptionId: abonnement.id, period: periode, limit: limite },
        });
      }
      quotaId = quota?.id ?? null;

      decision = decideAcces({
        source: "ABONNEMENT",
        achatAbouti: true,
        abonnementActif: abonnement.cycleEnd.getTime() > now.getTime(),
        dejaTelecharge: dejaTelecharge !== null,
        quota: quota ? { utilises: quota.used, limite: quota.limit } : null,
        now,
      });
    }

    if (!decision.autorise) {
      return { decision, dureeUrlSecondes: null, fichier: null };
    }

    await tx.consumptionEvent.create({
      data: {
        userId,
        productId: fichier.productId,
        productFileId,
        orderItemId: achat?.id ?? null,
        eventType,
        platform: plateformeDepuisUserAgent(userAgent),
        ipAddress,
        consumedAt: now,
      },
    });

    if (decision.consommeQuota && quotaId) {
      await tx.downloadQuota.update({
        where: { id: quotaId },
        data: { used: { increment: 1 } },
      });
    }

    // Compteur dénormalisé : c'est lui qu'affiche la maquette (« 2 340 dl »),
    // jamais un COUNT() sur la table d'événements (PLAN §8.2).
    await tx.product.update({
      where: { id: fichier.productId },
      data: { downloadsCount: { increment: 1 } },
    });

    return {
      decision,
      dureeUrlSecondes: dureeUrlSignee(fichier.sizeBytes),
      fichier: {
        id: fichier.id,
        filename: fichier.filename,
        sizeBytes: fichier.sizeBytes,
      },
    };
  });
}
