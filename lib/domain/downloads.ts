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

import type { ConsumptionType } from "@/lib/domain/delivery";

import { estOfferte } from "@/lib/commerce/montant";
import { accesJusquA } from "@/lib/ndank/cycle";
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

  return db.$transaction(async (tx: import("@prisma/client").Prisma.TransactionClient) => {
    const fichier = await tx.productFile.findUniqueOrThrow({
      where: { id: productFileId },
      include: { product: true },
    });

    // Un fichier retiré n'est plus servi, y compris à qui l'a acheté. La ligne
    // survit pour que rien ne soit détruit — pas pour continuer à livrer.
    // C'est aussi ce que fait `alive_product_files` chez Gumroad.
    //
    // Un aperçu n'est pas une livraison non plus : il est déjà public, et le
    // servir ici gonflerait le compteur de téléchargements tout en consommant
    // un quota d'abonné pour une vignette.
    if (fichier.deletedAt !== null || fichier.role !== "SOURCE") {
      return {
        decision: { autorise: false, raison: "COMMANDE_NON_PAYEE" } as const,
        dureeUrlSecondes: null,
        fichier: null,
      };
    }

    // Une ressource sous retrait juridique n'est plus servie non plus, et pour
    // la même raison que le fichier supprimé ci-dessus : « retirer » ne peut
    // pas vouloir dire « invisible sur la vitrine, toujours livrable ».
    //
    // Ce contrôle manquait, et il n'aurait rien cassé de le laisser manquer :
    // la fiche 404, le fil ne la montre plus, et seul quelqu'un qui possède
    // déjà l'identifiant du fichier pouvait encore le tirer. C'est-à-dire tous
    // ceux qui l'ont acheté — précisément les gens à qui le contenu litigieux
    // continuait d'être distribué.
    //
    // Ce qui n'est pas repris : ce qui a déjà été téléchargé. Aucun retrait ne
    // peut l'atteindre, et prétendre le contraire serait faux.
    if (fichier.product.status === "SUSPENDED") {
      return {
        decision: { autorise: false, raison: "RETRAIT_JURIDIQUE" } as const,
        dureeUrlSecondes: null,
        fichier: null,
      };
    }

    // 1. Une ressource offerte se retire sans commande — voir `SourceAcces`.
    if (estOfferte(fichier.product)) {
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
    let quotaLimite: number | null = null;

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
      quotaLimite = quota?.limit ?? null;

      decision = decideAcces({
        source: "ABONNEMENT",
        achatAbouti: true,
        // Grâce comprise : c'est ce que la page du forfait promet (P8.7).
        abonnementActif: accesJusquA(abonnement.cycleEnd).getTime() > now.getTime(),
        dejaTelecharge: dejaTelecharge !== null,
        quota: quota ? { utilises: quota.used, limite: quota.limit } : null,
        now,
      });
    }

    if (!decision.autorise) {
      return { decision, dureeUrlSecondes: null, fichier: null };
    }

    if (decision.consommeQuota && quotaId) {
      // Le quota est protégé par l'écriture, pas seulement par la lecture qui a
      // produit la décision. Deux téléchargements concurrents ne peuvent donc
      // pas franchir la limite mensuelle en lisant le même compteur `used`.
      const debitQuota = await tx.downloadQuota.updateMany({
        where: { id: quotaId, used: { lt: quotaLimite ?? 0 } },
        data: { used: { increment: 1 } },
      });

      if (debitQuota.count !== 1) {
        return {
          decision: { autorise: false, raison: "QUOTA_EPUISE" } as const,
          dureeUrlSecondes: null,
          fichier: null,
        };
      }
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
  }, { isolationLevel: "Serializable" });
}
