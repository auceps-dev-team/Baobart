"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { sessionCourante } from "@/lib/auth/session";

import { enregistrer } from "@/lib/notifications/preferences";
import { marquerLue, toutMarquerLu } from "@/lib/notifications/queries";

/**
 * Les gestes sur ses propres notifications.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * AUCUN POUVOIR EXIGÉ, MAIS UNE SESSION
 *
 * Ce ne sont pas des écrans d'administration : chacun règle les siens. Ce qui
 * protège n'est donc pas un pouvoir mais **l'identité** — l'identifiant de la
 * personne vient de la session, jamais du formulaire.
 *
 * Un module « use server » expose chacun de ses exports au navigateur. Toutes
 * les gardes sont ici, et les requêtes portent `userId` dans leur `WHERE` :
 * deviner l'identifiant d'une notification ne suffit pas à la toucher.
 */

export type EtatGeste = { ok: boolean; message?: string };

export async function marquerNotificationLue(
  notificationId: string,
): Promise<EtatGeste> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) notFound();

  await marquerLue(utilisateur.id, notificationId);
  revalidatePath("/dashboard/notifications");

  // Toujours `ok` : marquer lue une notification déjà lue n'est pas une
  // erreur, et afficher un message pour ça ferait douter d'un geste anodin.
  return { ok: true };
}

export async function toutMarquerLuAction(): Promise<EtatGeste> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) notFound();

  const combien = await toutMarquerLu(utilisateur.id);
  revalidatePath("/dashboard/notifications");

  return {
    ok: true,
    message:
      combien === 0
        ? "Tout était déjà lu."
        : `${combien} notification${combien > 1 ? "s" : ""} marquée${combien > 1 ? "s" : ""} lue${combien > 1 ? "s" : ""}.`,
  };
}

/**
 * Changer un réglage.
 *
 * Les couples impératifs sont refusés **ici aussi**, pas seulement grisés à
 * l'écran : un formulaire posté à la main enverrait n'importe quel couple.
 * `enregistrer` rend `false`, et l'on répond sans drame — l'écran n'offrait
 * pas de le changer.
 */
export async function reglerNotification(
  evenement: string,
  canal: string,
  actif: boolean,
): Promise<EtatGeste> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) notFound();

  const pose = await enregistrer({
    utilisateurId: utilisateur.id,
    evenement,
    canal,
    actif,
  });

  revalidatePath("/dashboard/notifications/reglages");

  return pose
    ? { ok: true }
    : {
        ok: false,
        message:
          "Ce réglage ne se change pas : on ne peut pas se couper des avis qui engagent de l'argent ou une décision.",
      };
}
