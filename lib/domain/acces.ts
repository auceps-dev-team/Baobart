import "server-only";

import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";

/**
 * Retirer, ou rendre, l'accès à une ressource achetée.
 *
 * Séparé du remboursement, et volontairement : on peut retirer l'accès sans
 * rendre l'argent — revente en masse, partage du fichier — et rendre l'argent
 * sans retirer l'accès, par geste commercial. Confondre les deux obligerait à
 * choisir entre punir et rembourser.
 *
 * Aucun mouvement au grand livre : personne n'a payé, personne n'a été payé.
 * C'est la seule sanction de cette liste qui ne touche pas à l'argent.
 */

export type SuiteAcces =
  | { fait: true }
  | { fait: false; motif: "INTROUVABLE" | "PAS_LE_VENDEUR" | "DEJA_DANS_CET_ETAT" };

type Acces =
  | { ok: true }
  | { ok: false; motif: "INTROUVABLE" | "PAS_LE_VENDEUR" };

async function verifierLeVendeur(
  orderItemId: string,
  vendeurId: string,
): Promise<Acces> {
  const ligne = await db.orderItem.findUnique({
    where: { id: orderItemId },
    select: { product: { select: { sellerId: true } } },
  });

  if (!ligne) return { ok: false, motif: "INTROUVABLE" };

  // Seul le vendeur de la ressource décide de son accès. La garde est ici, pas
  // dans l'écran : un module « use server » est joignable sans passer par lui.
  if (ligne.product.sellerId !== vendeurId) {
    return { ok: false, motif: "PAS_LE_VENDEUR" };
  }

  return { ok: true };
}

export async function retirerAcces(input: {
  orderItemId: string;
  vendeurId: string;
  motif?: string;
  date?: Date;
}): Promise<SuiteAcces> {
  const droit = await verifierLeVendeur(input.orderItemId, input.vendeurId);
  if (!droit.ok) return { fait: false, motif: droit.motif };

  const date = input.date ?? new Date();

  // La condition vit dans le WHERE : deux clics ne posent pas deux dates
  // différentes, et la seconde ne réécrit pas la première.
  const { count } = await db.orderItem.updateMany({
    where: { id: input.orderItemId, accessRevokedAt: null },
    data: { accessRevokedAt: date },
  });

  if (count !== 1) return { fait: false, motif: "DEJA_DANS_CET_ETAT" };

  journal.avertissement("accès retiré à un acheteur", {
    orderItemId: input.orderItemId,
    parVendeur: input.vendeurId,
    motif: input.motif ?? null,
  });

  return { fait: true };
}

/** Rendre l'accès retiré à tort. */
export async function rendreAcces(input: {
  orderItemId: string;
  vendeurId: string;
}): Promise<SuiteAcces> {
  const droit = await verifierLeVendeur(input.orderItemId, input.vendeurId);
  if (!droit.ok) return { fait: false, motif: droit.motif };

  const { count } = await db.orderItem.updateMany({
    where: { id: input.orderItemId, accessRevokedAt: { not: null } },
    data: { accessRevokedAt: null },
  });

  if (count !== 1) return { fait: false, motif: "DEJA_DANS_CET_ETAT" };

  journal.info("accès rendu à un acheteur", {
    orderItemId: input.orderItemId,
    parVendeur: input.vendeurId,
  });

  return { fait: true };
}
