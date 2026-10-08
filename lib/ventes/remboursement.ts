import "server-only";

import { MARQUEUR_SIMULATION } from "@/lib/checkout/achat";
import { db } from "@/lib/db";
import { rembourserLigne } from "@/lib/domain/orders";
import { journal } from "@/lib/observabilite/journal";
import { piloteCourant } from "@/lib/payments/encaissement/pilotes";

/**
 * Rembourser une vente : l'opérateur d'abord, le grand livre ensuite.
 *
 * Extrait le 08/10 de `lib/ventes/actions.ts`, à l'identique : le créateur qui
 * rembourse depuis Ventes, et la demande de remboursement acceptée — par lui
 * ou par le support —, passent par le même chemin. Deux chemins finiraient
 * par diverger, et c'est sur l'argent qu'ils divergeraient.
 *
 * Ne vérifie PAS qui rembourse : c'est à l'appelant (le vendeur de la ligne,
 * ou le support sur une demande restée sans réponse).
 */

export type Remboursement = { ok: true; message: string; montant: number } | { ok: false; message: string };

/** Deux clics sur « Rembourser » ne doivent pas rembourser deux fois. */
const FENETRE_DOUBLON_MS = 60_000;

export async function rembourserUneVente(input: {
  orderItemId: string;
  /** Absent : tout ce qui reste. */
  montant?: number;
  parId: string;
  motifInterne: string;
  raison?: string;
}): Promise<Remboursement> {
  const { orderItemId } = input;
  const ligne = await db.orderItem.findUnique({
    where: { id: orderItemId },
    select: {
      price: true,
      quantity: true,
      refundedAmount: true,
      state: true,
      chargebackAt: true,
      order: { select: { provider: true, providerRef: true, currency: true } },
      product: { select: { seller: { select: { refundsDisabled: true } } } },
    },
  });

  if (!ligne) return { ok: false, message: "Vente introuvable." };

  // Le drapeau que la machine à états du risque pose quand un solde plonge.
  if (ligne.product.seller.refundsDisabled) {
    return { ok: false, message: "Les remboursements sont suspendus sur ce compte vendeur. Le support doit intervenir." };
  }

  if (ligne.chargebackAt !== null) {
    return { ok: false, message: "Ce paiement est contesté auprès de la banque : l'argent a déjà été repris." };
  }

  const restant = ligne.price * ligne.quantity - ligne.refundedAmount;
  if (restant <= 0) return { ok: false, message: "Cette vente est déjà remboursée en entier." };

  const montant = input.montant ?? restant;
  if (!Number.isInteger(montant) || montant <= 0) return { ok: false, message: "Indique un montant à rembourser." };
  if (montant > restant) return { ok: false, message: "Tu ne peux pas rembourser plus que le restant." };

  // Protection contre le double clic : un remboursement identique à l'instant
  // est presque toujours un envoi accidentel, jamais une décision.
  const jumeau = await db.refund.findFirst({
    where: { orderItemId, amount: montant, createdAt: { gte: new Date(Date.now() - FENETRE_DOUBLON_MS) } },
    select: { id: true },
  });
  if (jumeau) return { ok: false, message: "Ce remboursement vient d'être enregistré. Recharge la page." };

  // ── L'ARGENT D'ABORD, LES ÉCRITURES ENSUITE ──────────────────────────────
  //
  // Écrire au grand livre débite le vendeur ; cela ne rend rien à l'acheteur.
  // L'appel réseau est ce qui échoue le plus souvent : le faire en premier
  // fait que l'échec courant ne laisse AUCUNE trace. L'échec rare — l'opérateur
  // a rendu l'argent et l'écriture ne passe pas — est bruyant et se rattrape à
  // la main.
  const suiteOperateur = await rendreLArgent({
    fournisseur: ligne.order.provider,
    referenceOperateur: ligne.order.providerRef,
    montant,
    devise: ligne.order.currency,
    motifInterne: input.motifInterne,
  });
  if (!suiteOperateur.ok) return { ok: false, message: suiteOperateur.message };

  try {
    const { retenu } = await rembourserLigne({ orderItemId, amount: montant, refundedById: input.parId, reason: input.raison });
    journal.info("remboursement", { orderItemId, montant, retenu, par: input.parId, motif: input.motifInterne, operateur: suiteOperateur.operateur });
    return { ok: true, message: `Remboursement enregistré : ${montant} rendus.`, montant };
  } catch (cause) {
    if (cause instanceof RangeError) return { ok: false, message: "Le montant dépasse ce qui reste à rembourser." };
    // L'argent est PARTI et les écritures n'ont pas suivi.
    journal.erreur("ARGENT REMBOURSÉ SANS ÉCRITURE", {
      orderItemId,
      montant,
      operateur: suiteOperateur.operateur,
      remede: "L'acheteur a été remboursé mais le vendeur n'est pas débité. Rapprocher le relevé de l'opérateur et passer l'écriture à la main.",
    });
    throw cause;
  }
}

/**
 * Demande à l'opérateur de rendre l'argent, quand il y a un opérateur. Une
 * vente simulée n'a rien encaissé : il n'y a rien à rendre.
 */
async function rendreLArgent(input: {
  fournisseur: string | null;
  referenceOperateur: string | null;
  montant: number;
  devise: string;
  motifInterne: string;
}): Promise<{ ok: true; operateur: string } | { ok: false; message: string }> {
  if (input.fournisseur === MARQUEUR_SIMULATION || input.fournisseur === null) {
    return { ok: true, operateur: "simulation" };
  }

  const pilote = piloteCourant();
  if (!pilote.rembourser) {
    return { ok: false, message: "L'opérateur de paiement ne permet pas le remboursement automatique. Contacte le support." };
  }
  if (!input.referenceOperateur) {
    return { ok: false, message: "Cette vente n'a pas de référence chez l'opérateur : le remboursement doit se faire à la main." };
  }

  const suite = await pilote.rembourser({
    referenceOperateur: input.referenceOperateur,
    montant: input.montant,
    devise: input.devise,
    motifClient: "Remboursement Baobart",
    motifInterne: input.motifInterne,
  });
  if (suite.ok) return { ok: true, operateur: pilote.nom };
  return {
    ok: false,
    message: suite.definitif ? `L'opérateur a refusé le remboursement : ${suite.message}` : "L'opérateur est injoignable. Réessaie dans quelques minutes.",
  };
}
