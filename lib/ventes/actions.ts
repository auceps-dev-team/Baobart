"use server";

import { revalidatePath } from "next/cache";

import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { rendreAcces, retirerAcces } from "@/lib/domain/acces";
import { MARQUEUR_SIMULATION } from "@/lib/checkout/achat";
import { rembourserLigne } from "@/lib/domain/orders";
import { journal } from "@/lib/observabilite/journal";
import { piloteCourant } from "@/lib/payments/encaissement/pilotes";

/**
 * Ce qu'un vendeur peut faire sur une de ses ventes.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LA GARDE EST ICI, PAS DANS LE BOUTON
 *
 * Un module « use server » expose chacun de ses exports comme un point d'entrée
 * appelable depuis le navigateur. Cacher un bouton ne protège rien : la
 * fonction reste joignable par quiconque connaît son identifiant. Aucune de ces
 * fonctions ne prend d'identifiant de vendeur en paramètre — il est lu depuis
 * la session, sans quoi on offrirait de rembourser au nom d'autrui.
 */

export type EtatVente =
  | { ok: true; message: string }
  | { ok: false; message: string };

/** Deux clics sur « Rembourser » ne doivent pas rembourser deux fois. */
const FENETRE_DOUBLON_MS = 60_000;

/**
 * Un seul point d'entrée, aiguillé par la clé du bouton.
 *
 * Le panneau d'opérations est partagé par trois écrans : il appelle toujours la
 * même signature. C'est ici qu'on traduit « rembourser » ou « retirer » en
 * geste, après avoir vérifié qui parle.
 */
export async function agirSurLaVente(
  orderItemId: string,
  cle: string,
  precedent: EtatVente | null,
  donnees: FormData,
): Promise<EtatVente> {
  switch (cle) {
    case "rembourser":
      return rembourserVente(orderItemId, precedent, donnees);
    case "retirer":
      return basculerAcces(orderItemId, true, donnees);
    case "rendre":
      return basculerAcces(orderItemId, false, donnees);
    default:
      return { ok: false, message: "Geste inconnu." };
  }
}

async function basculerAcces(
  orderItemId: string,
  retirer: boolean,
  donnees: FormData,
): Promise<EtatVente> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) return { ok: false, message: "Connecte-toi pour continuer." };

  // Le motif n'est pas décoratif : retirer un accès déjà payé se justifie,
  // et l'acheteur peut le contester.
  const motif = String(donnees.get("motif") ?? "").trim();
  if (retirer && motif.length < 4) {
    return { ok: false, message: "Écris pourquoi tu retires l'accès." };
  }

  const suite = retirer
    ? await retirerAcces({ orderItemId, vendeurId: utilisateur.id, motif })
    : await rendreAcces({ orderItemId, vendeurId: utilisateur.id });

  revalidatePath("/dashboard/ventes");

  if (!suite.fait) {
    return {
      ok: false,
      message:
        suite.motif === "DEJA_DANS_CET_ETAT"
          ? "L'accès est déjà dans cet état."
          : "Vente introuvable.",
    };
  }

  return {
    ok: true,
    message: retirer ? "Accès retiré." : "Accès rendu.",
  };
}

async function rembourserVente(
  orderItemId: string,
  _precedent: EtatVente | null,
  donnees: FormData,
): Promise<EtatVente> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) return { ok: false, message: "Connecte-toi pour continuer." };

  const ligne = await db.orderItem.findUnique({
    where: { id: orderItemId },
    select: {
      price: true,
      quantity: true,
      refundedAmount: true,
      state: true,
      chargebackAt: true,
      order: { select: { provider: true, providerRef: true, currency: true } },
      product: { select: { sellerId: true, seller: { select: { refundsDisabled: true } } } },
    },
  });

  if (!ligne) return { ok: false, message: "Vente introuvable." };
  if (ligne.product.sellerId !== utilisateur.id) {
    // Même réponse que pour une vente inexistante : dire « pas à toi »
    // confirmerait qu'elle existe.
    return { ok: false, message: "Vente introuvable." };
  }

  // Le drapeau que la machine à états du risque pose quand un solde plonge.
  // Il était écrit au schéma et lu par personne ; il l'est maintenant.
  if (ligne.product.seller.refundsDisabled) {
    return {
      ok: false,
      message:
        "Les remboursements sont suspendus sur ton compte. Contacte le support.",
    };
  }

  if (ligne.chargebackAt !== null) {
    return {
      ok: false,
      message:
        "Ce paiement est contesté auprès de la banque : l'argent a déjà été repris.",
    };
  }

  const restant = ligne.price * ligne.quantity - ligne.refundedAmount;
  if (restant <= 0) {
    return { ok: false, message: "Cette vente est déjà remboursée en entier." };
  }

  const saisi = String(donnees.get("montant") ?? "").replace(/[^\d]/g, "");
  const montant = saisi.length > 0 ? Number(saisi) : restant;

  if (!Number.isInteger(montant) || montant <= 0) {
    return { ok: false, message: "Indique un montant à rembourser." };
  }
  if (montant > restant) {
    return {
      ok: false,
      message: `Tu ne peux pas rembourser plus que le restant.`,
    };
  }

  // Protection contre le double clic : un remboursement identique à l'instant
  // est presque toujours un envoi accidentel, jamais une décision.
  const jumeau = await db.refund.findFirst({
    where: {
      orderItemId,
      amount: montant,
      createdAt: { gte: new Date(Date.now() - FENETRE_DOUBLON_MS) },
    },
    select: { id: true },
  });
  if (jumeau) {
    return {
      ok: false,
      message: "Ce remboursement vient d'être enregistré. Recharge la page.",
    };
  }

  // ── L'ARGENT D'ABORD, LES ÉCRITURES ENSUITE ────────────────────────────────
  //
  // Écrire au grand livre débite le vendeur ; cela ne rend rien à l'acheteur.
  // Tant que l'opérateur n'a pas reçu l'ordre, l'argent est chez lui — et le
  // « remboursement » n'est qu'une écriture comptable. Invisible en simulation,
  // catastrophique en production : le créateur perd sa vente et l'acheteur
  // n'est pas remboursé.
  //
  // L'ordre choisi n'est pas le plus rassurant à lire, il est le moins coûteux
  // quand ça casse. L'appel réseau est ce qui échoue le plus souvent : le faire
  // en premier fait que l'échec courant ne laisse AUCUNE trace — rien n'a
  // bougé, on refuse proprement. L'échec rare — l'opérateur a rendu l'argent et
  // l'écriture ne passe pas — est bruyant et se rattrape à la main.
  const suiteOperateur = await rendreLArgent({
    fournisseur: ligne.order.provider,
    referenceOperateur: ligne.order.providerRef,
    montant,
    devise: ligne.order.currency,
  });

  if (!suiteOperateur.ok) {
    return { ok: false, message: suiteOperateur.message };
  }

  try {
    const { retenu } = await rembourserLigne({
      orderItemId,
      amount: montant,
      refundedById: utilisateur.id,
    });

    journal.info("remboursement par le vendeur", {
      orderItemId,
      montant,
      retenu,
      parVendeur: utilisateur.id,
      operateur: suiteOperateur.operateur,
    });

    revalidatePath("/dashboard/ventes");
    return {
      ok: true,
      message: `Remboursement enregistré. Ton solde est débité de ${montant}.`,
    };
  } catch (cause) {
    // RangeError : plafond dépassé par une écriture concurrente. Le message de
    // l'exception parle de montants bruts ; on n'en expose pas le détail.
    if (cause instanceof RangeError) {
      return { ok: false, message: "Le montant dépasse ce qui reste à rembourser." };
    }

    // L'argent est PARTI et les écritures n'ont pas suivi. Aucun code ne
    // répare cela seul : il faut qu'un humain rapproche le relevé de
    // l'opérateur et le grand livre.
    journal.erreur("ARGENT REMBOURSÉ SANS ÉCRITURE", {
      orderItemId,
      montant,
      operateur: suiteOperateur.operateur,
      remede:
        "L'acheteur a été remboursé mais le vendeur n'est pas débité. Rapprocher le relevé de l'opérateur et passer l'écriture à la main.",
    });
    throw cause;
  }
}

/**
 * Demande à l'opérateur de rendre l'argent, quand il y a un opérateur.
 *
 * Une vente en simulation n'a jamais rien encaissé : il n'y a rien à rendre, et
 * le remboursement se réduit aux écritures. On le dit plutôt que de le taire —
 * un « remboursé » silencieux sur une vente simulée ferait croire à un virement
 * qui n'a pas eu lieu.
 */
async function rendreLArgent(input: {
  fournisseur: string | null;
  referenceOperateur: string | null;
  montant: number;
  devise: string;
}): Promise<
  { ok: true; operateur: string } | { ok: false; message: string }
> {
  if (input.fournisseur === MARQUEUR_SIMULATION || input.fournisseur === null) {
    return { ok: true, operateur: "simulation" };
  }

  const pilote = piloteCourant();

  if (!pilote.rembourser) {
    // Mieux vaut refuser que débiter le vendeur sans rendre l'argent.
    return {
      ok: false,
      message:
        "L'opérateur de paiement ne permet pas le remboursement automatique. Contacte le support.",
    };
  }

  if (!input.referenceOperateur) {
    // Sans la référence de l'opérateur, on ne sait pas quelle transaction
    // rembourser. Le lui demander au hasard est exclu.
    return {
      ok: false,
      message:
        "Cette vente n'a pas de référence chez l'opérateur : le remboursement doit se faire à la main.",
    };
  }

  const suite = await pilote.rembourser({
    referenceOperateur: input.referenceOperateur,
    montant: input.montant,
    devise: input.devise,
    motifClient: "Remboursement Baobart",
    motifInterne: "Remboursement demandé par le vendeur",
  });

  if (suite.ok) return { ok: true, operateur: pilote.nom };

  return {
    ok: false,
    message: suite.definitif
      ? `L'opérateur a refusé le remboursement : ${suite.message}`
      : "L'opérateur est injoignable. Réessaie dans quelques minutes.",
  };
}
