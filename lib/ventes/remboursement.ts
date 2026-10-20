import "server-only";

import { MARQUEUR_SIMULATION } from "@/lib/checkout/achat";
import { db } from "@/lib/db";
import { rembourserLigne } from "@/lib/domain/orders";
import { journal } from "@/lib/observabilite/journal";
import { piloteCourant } from "@/lib/payments/encaissement/pilotes";
import { piloteLimite } from "@/lib/securite/pilotes";

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

/** Registre en mémoire pour garantir l'exclusion mutuelle locale immédiate. */
const verrousLocaux = new Map<string, number>();

async function acquerirVerrou(cle: string, ttlMs: number): Promise<boolean> {
  const maintenant = Date.now();
  const expireA = verrousLocaux.get(cle);
  if (expireA && expireA > maintenant) {
    return false;
  }
  verrousLocaux.set(cle, maintenant + ttlMs);

  const pilote = piloteLimite();
  const compteur = await pilote.compter(cle, ttlMs);
  if (compteur !== null && compteur > 1) {
    verrousLocaux.delete(cle);
    return false;
  }
  return true;
}

async function libererVerrou(cle: string): Promise<void> {
  verrousLocaux.delete(cle);
  const pilote = piloteLimite();
  await pilote.effacer(cle);
}

export async function rembourserUneVente(input: {
  orderItemId: string;
  /** Absent : tout ce qui reste. */
  montant?: number;
  parId: string;
  motifInterne: string;
  raison?: string;
}): Promise<Remboursement> {
  const { orderItemId } = input;

  // ── 1. VERROU CONCURRENTIEL LOCAL & DISTRIBUÉ ───────────────────────────
  //
  // Un enregistrement en base n'existe qu'APRÈS la transaction. Deux requêtes
  // simultanées (ex: double-clic ou attaques concurrentes) passeraient toutes
  // deux le findFirst avant que l'opérateur ait répondu, entraînant un double
  // déboursement financier sur le compte marchand. Le verrou atomique bloque
  // immédiatement toute requête parallèle locale et distribuée.
  const cleVerrou = `verrou:remboursement:${orderItemId}`;
  const verrouAcquis = await acquerirVerrou(cleVerrou, FENETRE_DOUBLON_MS);
  if (!verrouAcquis) {
    return { ok: false, message: "Un remboursement est déjà en cours de traitement pour cette vente. Recharge la page." };
  }

  try {
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

    if (!ligne) {
      return { ok: false, message: "Vente introuvable." };
    }

    // Le drapeau que la machine à états du risque pose quand un solde plonge.
    if (ligne.product.seller.refundsDisabled) {
      return { ok: false, message: "Les remboursements sont suspendus sur ce compte vendeur. Le support doit intervenir." };
    }

    if (ligne.chargebackAt !== null) {
      return { ok: false, message: "Ce paiement est contesté auprès de la banque : l'argent a déjà été repris." };
    }

    const restant = ligne.price * ligne.quantity - ligne.refundedAmount;
    if (restant <= 0) {
      return { ok: false, message: "Cette vente est déjà remboursée en entier." };
    }

    const montant = input.montant ?? restant;
    if (!Number.isInteger(montant) || montant <= 0) {
      return { ok: false, message: "Indique un montant à rembourser." };
    }
    if (montant > restant) {
      return { ok: false, message: "Tu ne peux pas rembourser plus que le restant." };
    }

    // Protection contre le double clic : un remboursement identique à l'instant
    // est presque toujours un envoi accidentel, jamais une décision.
    const jumeau = await db.refund.findFirst({
      where: { orderItemId, amount: montant, createdAt: { gte: new Date(Date.now() - FENETRE_DOUBLON_MS) } },
      select: { id: true },
    });
    if (jumeau) {
      return { ok: false, message: "Ce remboursement vient d'être enregistré. Recharge la page." };
    }

    // ── 2. VERROU EN BASE DE DONNÉES AVANT L'APPEL OPÉRATEUR ───────────────
    //
    // On pose une intention de remboursement persistée en base (processorRef: "EN_COURS")
    // avant de toucher aux API financières externes. Ainsi, même en cas de
    // multi-instances distribuées, tout contrôle concurrent en base détectera
    // l'intention et refusera le double tir.
    const intention = await db.refund.create({
      data: {
        orderItemId,
        amount: montant,
        currency: ligne.order.currency,
        reason: input.raison,
        refundedById: input.parId,
        processorRef: "EN_COURS",
      },
      select: { id: true },
    });

    // ── 3. L'ARGENT SORT, AVEC VRAIE CLÉ D'IDEMPOTENCE ─────────────────────
    const cleIdempotence = `remboursement-${orderItemId}-${montant}`;
    const suiteOperateur = await rendreLArgent({
      fournisseur: ligne.order.provider,
      referenceOperateur: ligne.order.providerRef,
      montant,
      devise: ligne.order.currency,
      motifInterne: `${input.motifInterne} [idemp:${cleIdempotence}]`,
      idempotenceKey: cleIdempotence,
    });

    if (!suiteOperateur.ok) {
      // Nettoyage de l'intention en base en cas de refus ou d'échec opérateur
      await db.refund.delete({ where: { id: intention.id } }).catch(() => {});
      return { ok: false, message: suiteOperateur.message };
    }

    // ── 4. FINALISATION EN BASE ET AU GRAND LIVRE ───────────────────────────
    try {
      const { retenu } = await rembourserLigne({
        orderItemId,
        amount: montant,
        refundedById: input.parId,
        reason: input.raison,
        refundId: intention.id,
      });
      journal.info("remboursement", {
        orderItemId,
        montant,
        retenu,
        par: input.parId,
        motif: input.motifInterne,
        operateur: suiteOperateur.operateur,
      });
      return { ok: true, message: `Remboursement enregistré : ${montant} rendus.`, montant };
    } catch (cause) {
      if (cause instanceof RangeError) {
        await db.refund.delete({ where: { id: intention.id } }).catch(() => {});
        return { ok: false, message: "Le montant dépasse ce qui reste à rembourser." };
      }
      // L'argent est PARTI et les écritures n'ont pas suivi.
      journal.erreur("ARGENT REMBOURSÉ SANS ÉCRITURE", {
        orderItemId,
        montant,
        operateur: suiteOperateur.operateur,
        remede: "L'acheteur a été remboursé mais le vendeur n'est pas débité. Rapprocher le relevé de l'opérateur et passer l'écriture à la main.",
      });
      throw cause;
    }
  } finally {
    // Libération garantie du verrou pour toutes les branches de sortie
    await libererVerrou(cleVerrou);
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
  idempotenceKey?: string;
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
    idempotenceKey: input.idempotenceKey,
  });
  if (suite.ok) return { ok: true, operateur: pilote.nom };
  return {
    ok: false,
    message: suite.definitif ? `L'opérateur a refusé le remboursement : ${suite.message}` : "L'opérateur est injoignable. Réessaie dans quelques minutes.",
  };
}
