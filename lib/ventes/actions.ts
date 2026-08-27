"use server";

import { revalidatePath } from "next/cache";

import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { rendreAcces, retirerAcces } from "@/lib/domain/acces";
import { rembourserLigne } from "@/lib/domain/orders";
import { journal } from "@/lib/observabilite/journal";

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

export async function rembourserVente(
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
    throw cause;
  }
}

export async function basculerAccesVente(
  orderItemId: string,
  retirer: boolean,
): Promise<void> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) return;

  if (retirer) {
    await retirerAcces({ orderItemId, vendeurId: utilisateur.id });
  } else {
    await rendreAcces({ orderItemId, vendeurId: utilisateur.id });
  }

  revalidatePath("/dashboard/ventes");
}
