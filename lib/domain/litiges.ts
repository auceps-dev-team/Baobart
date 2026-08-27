import "server-only";

import { Prisma } from "@prisma/client";

import { crediterSolde } from "@/lib/domain/balances";
import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";

/**
 * Les paiements contestés.
 *
 * Un litige n'est pas un remboursement. Le remboursement est un geste du
 * vendeur ; le litige est l'acheteur qui va voir sa banque, et la banque qui
 * reprend l'argent — sans rien demander à personne. Les deux colonnes sont
 * séparées depuis toujours dans le schéma, et trois modules refusent déjà
 * l'accès quand un litige est ouvert. Il manquait le chemin d'écriture.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI LE VENDEUR EST DÉBITÉ DU BRUT
 *
 * L'opérateur a repris la totalité de ce que l'acheteur avait payé. La
 * plateforme n'a rien à rendre : on lui a déjà tout pris. Même logique que le
 * remboursement, pour la même raison — sauf qu'ici personne n'a choisi.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IDEMPOTENCE
 *
 * Un opérateur qui n'a pas vu notre accusé de réception réémet son événement,
 * parfois des jours plus tard. Enregistrer deux fois le même litige débiterait
 * le vendeur deux fois pour une seule reprise de fonds. La garde vit dans le
 * `WHERE` de l'écriture, pas dans une lecture préalable : deux événements
 * concurrents peuvent lire « pas encore de litige », un seul doit réussir la
 * transition.
 *
 * Deux événements **simultanés**, eux, se heurtent à la sérialisation avant
 * même d'arriver à ce `WHERE` : Postgres en refuse un avec un conflit. Perdre
 * cette course n'est pas une panne, c'est le résultat attendu — l'autre
 * transaction a fait le travail. On le traduit donc en refus ordinaire. Sans
 * cela, le webhook répondrait 500 et l'opérateur réessaierait en boucle.
 */

export type SuiteLitige =
  | { enregistre: true; debite: number }
  | { enregistre: false; motif: "DEJA_ENREGISTRE" | "LIGNE_INTROUVABLE" | "NON_ENCAISSEE" };

export async function enregistrerLitige(input: {
  orderItemId: string;
  /** Référence de l'événement chez l'opérateur, pour la supervision. */
  reference?: string;
  date?: Date;
}): Promise<SuiteLitige> {
  const date = input.date ?? new Date();

  try {
    return await db.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const ligne = await tx.orderItem.findUnique({
        where: { id: input.orderItemId },
        include: { order: true, product: { include: { seller: true } } },
      });

      if (!ligne) return { enregistre: false as const, motif: "LIGNE_INTROUVABLE" as const };

      // Une ligne jamais encaissée n'a pas d'argent à reprendre.
      if (ligne.state !== "SUCCESSFUL") {
        return { enregistre: false as const, motif: "NON_ENCAISSEE" as const };
      }

      const transition = await tx.orderItem.updateMany({
        where: { id: input.orderItemId, chargebackAt: null },
        data: { chargebackAt: date },
      });

      if (transition.count !== 1) {
        return { enregistre: false as const, motif: "DEJA_ENREGISTRE" as const };
      }

      const brut = ligne.price * ligne.quantity;

      const { mouvement } = await crediterSolde(tx, {
        userId: ligne.product.sellerId,
        type: "CHARGEBACK",
        issuedCurrency: ligne.order.currency,
        issuedGross: -brut,
        issuedNet: -brut,
        holdingCurrency: ligne.product.seller.defaultCurrency,
        orderItemId: input.orderItemId,
        date,
      });

      // Les versements s'arrêtent le temps que la contestation soit tranchée.
      // Payer un créateur dont l'argent vient d'être repris reviendrait à
      // payer deux fois — sans jamais pouvoir le récupérer.
      await tx.user.updateMany({
        where: { id: ligne.product.sellerId, payoutsPausedAt: null },
        data: {
          payoutsPausedAt: date,
          payoutsPausedReason: "Paiement contesté, contestation en cours.",
        },
      });

      journal.avertissement("litige enregistré", {
        orderItemId: input.orderItemId,
        vendeurId: ligne.product.sellerId,
        montant: brut,
        reference: input.reference ?? null,
        mouvementId: mouvement.id,
      });

      return { enregistre: true as const, debite: brut };
    },
    { isolationLevel: "Serializable", timeout: 15_000, maxWait: 10_000 },
    );
  } catch (cause) {
    if (conflitDeSerialisation(cause)) {
      return { enregistre: false, motif: "DEJA_ENREGISTRE" };
    }
    throw cause;
  }
}

/** Postgres a refusé une transaction concurrente : l'autre a gagné la course. */
function conflitDeSerialisation(cause: unknown): boolean {
  return (
    cause instanceof Prisma.PrismaClientKnownRequestError &&
    cause.code === "P2034"
  );
}

export type SuiteReversal =
  | { rendu: true; credite: number }
  | { rendu: false; motif: "PAS_DE_LITIGE" | "DEJA_TRANCHE" | "LIGNE_INTROUVABLE" };

/**
 * Contestation tranchée en faveur du vendeur : l'argent revient.
 *
 * Les versements ne sont **pas** repris automatiquement. Un litige gagné ne
 * dit rien du suivant, et la levée d'une suspension mérite un regard humain —
 * même principe que la machine à états du risque, qui refuse de sortir d'une
 * suspension sans qu'on le demande explicitement.
 */
export async function litigeGagne(input: {
  orderItemId: string;
  date?: Date;
}): Promise<SuiteReversal> {
  const date = input.date ?? new Date();

  try {
    return await db.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const ligne = await tx.orderItem.findUnique({
        where: { id: input.orderItemId },
        include: { order: true, product: { include: { seller: true } } },
      });

      if (!ligne) return { rendu: false as const, motif: "LIGNE_INTROUVABLE" as const };
      if (ligne.chargebackAt === null) {
        return { rendu: false as const, motif: "PAS_DE_LITIGE" as const };
      }

      const transition = await tx.orderItem.updateMany({
        where: {
          id: input.orderItemId,
          chargebackAt: { not: null },
          chargebackReversedAt: null,
        },
        data: { chargebackReversedAt: date },
      });

      if (transition.count !== 1) {
        return { rendu: false as const, motif: "DEJA_TRANCHE" as const };
      }

      const brut = ligne.price * ligne.quantity;

      const { mouvement } = await crediterSolde(tx, {
        userId: ligne.product.sellerId,
        type: "CHARGEBACK_REVERSED",
        issuedCurrency: ligne.order.currency,
        issuedGross: brut,
        issuedNet: brut,
        holdingCurrency: ligne.product.seller.defaultCurrency,
        orderItemId: input.orderItemId,
        date,
      });

      journal.info("litige tranché en faveur du vendeur", {
        orderItemId: input.orderItemId,
        vendeurId: ligne.product.sellerId,
        montant: brut,
        mouvementId: mouvement.id,
      });

      return { rendu: true as const, credite: brut };
    },
    { isolationLevel: "Serializable", timeout: 15_000, maxWait: 10_000 },
    );
  } catch (cause) {
    if (conflitDeSerialisation(cause)) {
      return { rendu: false, motif: "DEJA_TRANCHE" };
    }
    throw cause;
  }
}
