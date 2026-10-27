"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sessionCourante } from "@/lib/auth/session";
import { MESSAGES_DE_REFUS, lireMessage, type ChampMessage } from "@/lib/contact/createur";
import { ecrireAuCreateur, reglerLesMessages } from "@/lib/contact/createur-service";
import { CHAMP_LEURRE, CHAMP_OUVERTURE, evaluerUnGeste } from "@/lib/securite/antibot";
import { verifierLimiteAction } from "@/lib/securite/garde";

export type EtatMessage =
  | { ok: true }
  | { ok: false; message: string; champ?: ChampMessage; saisie: { sujet: string; corps: string } };

/**
 * Le bouton « Contact » d'une vitrine.
 *
 * L'ordre des gardes suit leur coût, comme pour le formulaire de l'équipe :
 * la session, le plafond par adresse (un compteur), l'anti-robot, la saisie,
 * et seulement ensuite la base. Rien de ce qui revient au navigateur ne porte
 * l'adresse du créateur — ni en cas de succès, ni dans un refus.
 */
export async function ecrireAuCreateurAction(
  username: string,
  _precedent: EtatMessage | null,
  donnees: FormData,
): Promise<EtatMessage> {
  const saisie = { sujet: String(donnees.get("sujet") ?? ""), corps: String(donnees.get("corps") ?? "") };

  const qui = await sessionCourante();
  if (!qui) return { ok: false, message: "Connecte-toi pour écrire à ce créateur.", saisie };

  const borne = await verifierLimiteAction("contact.createur");
  if (!borne.autorise) {
    return { ok: false, message: "Trop de messages depuis cette connexion : réessaie dans une heure.", saisie };
  }

  // `delaiRequis`, comme le formulaire de l'équipe : sans lui, un instant nu
  // écrit par un script passe pour celui que la page a signé.
  const geste = await evaluerUnGeste({
    action: "contact_createur",
    leurre: String(donnees.get(CHAMP_LEURRE) ?? ""),
    ouvertLe: String(donnees.get(CHAMP_OUVERTURE) ?? ""),
    delaiRequis: true,
  });
  if (!geste.laisserPasser) {
    return { ok: false, message: "Le message n'a pas pu partir. Recharge la page et réessaie.", saisie };
  }

  const lu = lireMessage(saisie);
  if (!lu.ok) return { ok: false, message: lu.message, champ: lu.champ, saisie };

  const issue = await ecrireAuCreateur({ expediteurId: qui.id, username, sujet: lu.sujet, corps: lu.corps });
  if (issue.ok) return { ok: true };

  const message =
    issue.refus === "INTROUVABLE"
      ? "Cette vitrine n'existe plus."
      : issue.refus === "INDISPONIBLE"
        ? "L'envoi est indisponible pour le moment. Réessaie plus tard."
        : MESSAGES_DE_REFUS[issue.refus];
  return { ok: false, message, saisie };
}

export type EtatReglage = { ok: boolean; message: string };

/**
 * L'interrupteur du profil : ouvrir ou fermer le bouton « Contact ».
 *
 * Le formulaire envoie l'état voulu (`ouvert=oui|non`), jamais « l'inverse
 * de l'état actuel » — un onglet resté ouvert depuis hier enverrait sinon le
 * contraire de ce que son bouton affiche.
 */
export async function reglerLesMessagesAction(
  _precedent: EtatReglage | null,
  donnees: FormData,
): Promise<EtatReglage> {
  const qui = await sessionCourante();
  if (!qui) redirect("/connexion?suite=/dashboard/profil");

  const ouvert = donnees.get("ouvert") === "oui";
  if (!(await reglerLesMessages(qui.id, ouvert))) {
    return { ok: false, message: "Enregistre d'abord ton profil public : le bouton vit sur ta vitrine." };
  }

  revalidatePath("/dashboard/profil");
  if (qui.username) revalidatePath(`/createurs/${qui.username}`);
  // Le panneau redit l'état lui-même ; ce message confirme seulement le geste.
  return { ok: true, message: "C'est enregistré." };
}
