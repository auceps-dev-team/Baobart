"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { sessionCourante } from "@/lib/auth/session";
import { urlDuSite } from "@/lib/config/site";
import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";
import { piloteCourant, sceau } from "@/lib/payments/encaissement/pilotes";
import { referenceDe } from "@/lib/abonnements/renouvellement";

/**
 * Déclencher à la main le rappel que l'opérateur enverrait.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI PASSER PAR HTTP PLUTÔT QUE D'APPELER `recevoir()`
 *
 * Appeler la réception directement serait plus simple — et sauterait
 * exactement ce qu'on veut éprouver : la signature, la lecture du corps brut,
 * les codes de retour. Le bac à sable frappe donc vraiment la route publique,
 * avec un corps signé, comme le ferait Orange Money. Ce qui marche ici marche
 * en production, et ce qui casse ici aurait cassé là-bas.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QUI EMPÊCHE CETTE PORTE DE S'OUVRIR EN PRODUCTION
 *
 * Un module « use server » expose chacun de ses exports au navigateur. Celui-ci
 * crédite de l'argent : il ne suffit pas de cacher le bouton.
 *
 *   — le pilote actif doit être le bac à sable, ce qui exige
 *     `PAYMENTS_SANDBOX_SECRET` posé ; en production il ne l'est pas ;
 *   — l'appelant doit être connecté ET propriétaire de la commande visée.
 *
 * La seconde garde n'est pas de trop : le jour où quelqu'un laisse traîner un
 * secret de bac à sable sur un serveur réel, elle limite la casse à ses
 * propres commandes.
 */

export type ResultatBac =
  | { ok: true; effet: string }
  | { ok: false; message: string };

export async function declencherRappel(
  orderId: string,
  issue: "REUSSI" | "ECHOUE",
): Promise<ResultatBac> {
  const pilote = piloteCourant();
  if (pilote.nom !== "bac-a-sable") {
    return { ok: false, message: "Le bac à sable n'est pas actif." };
  }

  const utilisateur = await sessionCourante();
  if (!utilisateur) return { ok: false, message: "Connecte-toi pour continuer." };

  const commande = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, buyerId: true, total: true, currency: true },
  });

  // Même réponse que pour une commande inexistante : dire « pas à toi »
  // confirmerait qu'elle existe.
  if (!commande || commande.buyerId !== utilisateur.id) {
    return { ok: false, message: "Commande introuvable." };
  }

  return frapper({
    reference: commande.id,
    montant: commande.total,
    devise: commande.currency,
    issue,
    revalider: `/achat/${orderId}`,
  });
}

/**
 * Le même geste, pour un renouvellement d'abonnement.
 *
 * Les gardes sont identiques — pilote bac à sable, session, propriété — et
 * pour la même raison : cette porte crédite du temps d'abonnement, et cacher un
 * bouton ne ferme rien.
 */
export async function declencherRappelAbonnement(
  paiementId: string,
  issue: "REUSSI" | "ECHOUE",
): Promise<ResultatBac> {
  const pilote = piloteCourant();
  if (pilote.nom !== "bac-a-sable") {
    return { ok: false, message: "Le bac à sable n'est pas actif." };
  }

  const utilisateur = await sessionCourante();
  if (!utilisateur) return { ok: false, message: "Connecte-toi pour continuer." };

  const paiement = await db.subscriptionPayment.findUnique({
    where: { id: paiementId },
    select: {
      id: true,
      amount: true,
      currency: true,
      subscription: { select: { id: true, userId: true } },
    },
  });

  if (!paiement || paiement.subscription.userId !== utilisateur.id) {
    return { ok: false, message: "Paiement introuvable." };
  }

  return frapper({
    // La référence préfixée, celle-là même qu'on enverrait à l'opérateur :
    // c'est elle que la réception aiguille vers les abonnements.
    reference: referenceDe(paiement.id),
    montant: paiement.amount,
    devise: paiement.currency,
    issue,
    revalider: `/abonnement/${paiement.subscription.id}/paiement/${paiement.id}`,
  });
}

/**
 * Frapper la vraie route de rappel, avec un corps signé.
 *
 * C'est le cœur du bac à sable, et il ne connaît pas son sujet : une commande
 * et un abonnement ne diffèrent ici que par leur référence. Écrire deux fois
 * cette fonction garantissait qu'un jour l'une des deux oublierait la signature
 * — et que le bac à sable cesserait d'éprouver ce qu'il est censé éprouver.
 */
async function frapper(input: {
  reference: string;
  montant: number;
  devise: string;
  issue: "REUSSI" | "ECHOUE";
  revalider: string;
}): Promise<ResultatBac> {
  const base = urlDuSite();
  if (!base) return { ok: false, message: "APP_URL n'est pas configurée." };

  const corps = JSON.stringify({
    // Un identifiant neuf à chaque déclenchement : c'est ce qui permet
    // d'éprouver le rejeu en renvoyant deux fois le MÊME corps depuis un test,
    // et le doublon d'état en en envoyant deux différents.
    event: randomUUID(),
    reference: input.reference,
    operatorRef: `sandbox-${input.reference}`,
    status: input.issue,
    amount: input.montant,
    currency: input.devise,
  });

  const secret = (process.env.PAYMENTS_SANDBOX_SECRET ?? "").trim();

  const reponse = await fetch(`${base}/api/paiements/bac-a-sable/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-baobart-signature": sceau(secret, corps),
    },
    body: corps,
  });

  const lu = (await reponse.json().catch(() => null)) as {
    effet?: string;
  } | null;

  journal.avertissement("rappel de paiement déclenché en bac à sable", {
    reference: input.reference,
    issue: input.issue,
    code: reponse.status,
  });

  revalidatePath(input.revalider);

  if (!reponse.ok) {
    return { ok: false, message: `L'appel a été refusé (${reponse.status}).` };
  }

  return { ok: true, effet: lu?.effet ?? "inconnu" };
}
