"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { sessionCourante } from "@/lib/auth/session";
import { urlDuSite } from "@/lib/config/site";
import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";
import { piloteCourant, sceau } from "@/lib/payments/encaissement/pilotes";

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

  const base = urlDuSite();
  if (!base) return { ok: false, message: "APP_URL n'est pas configurée." };

  const corps = JSON.stringify({
    // Un identifiant neuf à chaque déclenchement : c'est ce qui permet
    // d'éprouver le rejeu en renvoyant deux fois le MÊME corps depuis un test,
    // et le doublon d'état en en envoyant deux différents.
    event: randomUUID(),
    reference: commande.id,
    operatorRef: `sandbox-${commande.id}`,
    status: issue,
    amount: commande.total,
    currency: commande.currency,
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
    orderId,
    issue,
    code: reponse.status,
  });

  revalidatePath(`/achat/${orderId}`);

  if (!reponse.ok) {
    return { ok: false, message: `L'appel a été refusé (${reponse.status}).` };
  }

  return { ok: true, effet: lu?.effet ?? "inconnu" };
}
