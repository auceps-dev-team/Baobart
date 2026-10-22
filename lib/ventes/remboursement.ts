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
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE RÉSERVATION EN BASE, AVANT L'APPEL À L'OPÉRATEUR (VULN-02, 18/10)
 *
 * Le grand livre se protégeait déjà : `rembourserLigne` plafonne le cumul par
 * un UPDATE conditionnel, deux écritures ne dépassent jamais l'encaissé. Ce qui
 * ne se protégeait pas, c'est l'opérateur. Deux demandes simultanées passaient
 * le contrôle « jumeau » avant toute écriture, et chacune lui demandait de
 * rendre l'argent ; la seconde écriture échouait ensuite, en silence.
 *
 * Le 18/10, un verrou en mémoire, doublé d'un compteur Redis, et une ligne
 * `Refund` « EN_COURS ». Il ne tenait entre instances qu'avec Redis, et la
 * ligne restait orpheline si l'appel levait. Remplacé le 22/10 par
 * `OrderItem.refundLockedUntil`, pris par un UPDATE conditionnel : PostgreSQL ne
 * l'accorde qu'à une requête, avec ou sans Redis, et il expire seul.
 *
 * La prise vérifie aussi que `refundedAmount` n'a pas bougé depuis la lecture :
 * un remboursement achevé entre les deux ferait raisonner sur un restant faux.
 */

export type Remboursement = { ok: true; message: string; montant: number } | { ok: false; message: string };

/** Deux clics sur « Rembourser » ne doivent pas rembourser deux fois. */
const FENETRE_DOUBLON_MS = 60_000;

/**
 * Durée de la réservation. Bien au-delà du délai d'un appel à l'opérateur
 * (`DELAI_REMBOURSEMENT_MS` chez Paystack) : un appel ne survit jamais à sa
 * réservation.
 */
export const RESERVATION_MS = 5 * 60_000;

/**
 * Quand l'issue est INCERTAINE — réseau coupé, délai dépassé, erreur 5xx —,
 * l'opérateur a peut-être rendu l'argent. Libérer la ligne laisserait relancer
 * et rembourser deux fois. On la garde un jour, le temps qu'une personne
 * regarde le relevé de l'opérateur. Paystack ne documente pas d'en-tête
 * d'idempotence (cherché le 22/10, rien trouvé) : c'est notre seule garde.
 */
export const RESERVATION_INCERTAINE_MS = 24 * 60 * 60_000;

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

  // Protection contre le double clic APRÈS coup : un remboursement identique
  // qui vient d'aboutir est presque toujours un envoi accidentel.
  const jumeau = await db.refund.findFirst({
    where: { orderItemId, amount: montant, createdAt: { gte: new Date(Date.now() - FENETRE_DOUBLON_MS) } },
    select: { id: true },
  });
  if (jumeau) return { ok: false, message: "Ce remboursement vient d'être enregistré. Recharge la page." };

  // ── LA RÉSERVATION ────────────────────────────────────────────────────────
  const maintenant = new Date();
  const jusqua = new Date(maintenant.getTime() + RESERVATION_MS);
  const prise = await db.orderItem.updateMany({
    where: {
      id: orderItemId,
      refundedAmount: ligne.refundedAmount,
      OR: [{ refundLockedUntil: null }, { refundLockedUntil: { lt: maintenant } }],
    },
    data: { refundLockedUntil: jusqua },
  });
  if (prise.count !== 1) {
    return { ok: false, message: "Un remboursement est déjà en cours pour cette vente. Recharge la page dans un instant." };
  }

  // Libère NOTRE réservation, et elle seule : si elle a expiré et qu'un autre
  // l'a reprise, la date ne correspond plus et rien n'est touché.
  const liberer = (garderJusqua: Date | null) =>
    db.orderItem
      .updateMany({ where: { id: orderItemId, refundLockedUntil: jusqua }, data: { refundLockedUntil: garderJusqua } })
      .catch((cause) => journal.erreur("réservation de remboursement non libérée", { orderItemId, cause }));

  // ── L'ARGENT D'ABORD, LES ÉCRITURES ENSUITE ──────────────────────────────
  //
  // Écrire au grand livre débite le vendeur ; cela ne rend rien à l'acheteur.
  // L'appel réseau est ce qui échoue le plus souvent : le faire en premier
  // fait que l'échec courant ne laisse AUCUNE trace. L'échec rare — l'opérateur
  // a rendu l'argent et l'écriture ne passe pas — est bruyant et se rattrape à
  // la main.
  //
  // La référence part dans la note marchande : c'est par elle que le support
  // rapproche une ligne du relevé de l'opérateur.
  const reference = `remb-${orderItemId}-${ligne.refundedAmount}-${montant}`;
  let suiteOperateur: Awaited<ReturnType<typeof rendreLArgent>>;
  try {
    suiteOperateur = await rendreLArgent({
      fournisseur: ligne.order.provider,
      referenceOperateur: ligne.order.providerRef,
      montant,
      devise: ligne.order.currency,
      motifInterne: `${input.motifInterne} [${reference}]`,
    });
  } catch (cause) {
    // Un pilote qui lève a peut-être envoyé la demande : même traitement
    // qu'une issue incertaine.
    suiteOperateur = { ok: false, incertain: true, message: cause instanceof Error ? cause.message : String(cause) };
  }

  if (!suiteOperateur.ok) {
    if (suiteOperateur.incertain) {
      await liberer(new Date(maintenant.getTime() + RESERVATION_INCERTAINE_MS));
      journal.erreur("REMBOURSEMENT INCERTAIN", {
        orderItemId,
        montant,
        reference,
        cause: suiteOperateur.message,
        remede:
          "L'opérateur a peut-être rendu l'argent. Chercher la référence dans son relevé avant toute relance ; la vente reste réservée 24 h.",
      });
      return {
        ok: false,
        message: "L'opérateur n'a pas répondu clairement. Pour ne pas rembourser deux fois, cette vente est en attente : le support vérifie auprès de lui.",
      };
    }
    await liberer(null);
    return { ok: false, message: suiteOperateur.message };
  }

  try {
    const { retenu } = await rembourserLigne({
      orderItemId,
      amount: montant,
      refundedById: input.parId,
      reason: input.raison,
      processorRef: suiteOperateur.referenceOperateur,
    });
    journal.info("remboursement", { orderItemId, montant, retenu, par: input.parId, motif: input.motifInterne, operateur: suiteOperateur.operateur });
    return { ok: true, message: `Remboursement enregistré : ${montant} rendus.`, montant };
  } catch (cause) {
    // L'argent est PARTI et les écritures n'ont pas suivi. Toute erreur ici,
    // `RangeError` comprise : jusqu'au 22/10, celle-ci répondait « le montant
    // dépasse le restant » sans rien journaliser — un remboursement payé deux
    // fois finissait exactement là, en silence.
    journal.erreur("ARGENT REMBOURSÉ SANS ÉCRITURE", {
      orderItemId,
      montant,
      reference,
      operateur: suiteOperateur.operateur,
      cause: cause instanceof Error ? cause.message : String(cause),
      remede: "L'acheteur a été remboursé mais le vendeur n'est pas débité. Rapprocher le relevé de l'opérateur et passer l'écriture à la main.",
    });
    if (cause instanceof RangeError) {
      return { ok: false, message: "L'opérateur a rendu l'argent, mais l'écriture n'a pas pu suivre. Le support est prévenu." };
    }
    throw cause;
  } finally {
    await liberer(null);
  }
}

type SuiteOperateur =
  | { ok: true; operateur: string; referenceOperateur: string | null }
  | { ok: false; message: string; incertain: boolean };

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
}): Promise<SuiteOperateur> {
  if (input.fournisseur === MARQUEUR_SIMULATION || input.fournisseur === null) {
    return { ok: true, operateur: "simulation", referenceOperateur: null };
  }

  const pilote = piloteCourant();
  if (!pilote.rembourser) {
    return { ok: false, incertain: false, message: "L'opérateur de paiement ne permet pas le remboursement automatique. Contacte le support." };
  }
  if (!input.referenceOperateur) {
    return { ok: false, incertain: false, message: "Cette vente n'a pas de référence chez l'opérateur : le remboursement doit se faire à la main." };
  }

  const suite = await pilote.rembourser({
    referenceOperateur: input.referenceOperateur,
    montant: input.montant,
    devise: input.devise,
    motifClient: "Remboursement Baobart",
    motifInterne: input.motifInterne,
  });
  if (suite.ok) return { ok: true, operateur: pilote.nom, referenceOperateur: suite.referenceOperateur };
  // `definitif` : l'opérateur a répondu non (4xx). Sinon, rien ne dit qu'il
  // n'a pas exécuté la demande avant de tomber.
  return suite.definitif
    ? { ok: false, incertain: false, message: `L'opérateur a refusé le remboursement : ${suite.message}` }
    : { ok: false, incertain: true, message: suite.message };
}
