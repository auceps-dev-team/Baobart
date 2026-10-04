"use server";

import { revalidatePath } from "next/cache";

import { consigner } from "@/lib/admin/audit";
import { exigerUnDesPouvoirs } from "@/lib/auth/acces-administration";
import { sessionCourante } from "@/lib/auth/session";
import { validerMessage, type ChampContact, type Genre } from "@/lib/contact/regles";
import { enregistrerMessage, marquerTraite } from "@/lib/contact/service";
import { CHAMP_LEURRE, CHAMP_OUVERTURE, evaluerUnGeste } from "@/lib/securite/antibot";
import { verifierLimiteAction } from "@/lib/securite/garde";

export type EtatEnvoi =
  | { ok: true }
  | { ok: false; message: string; champ?: ChampContact; saisie: Record<string, string> };

/**
 * Envoie un message depuis Contact ou Sponsoriser.
 *
 * Même garde que l'inscription : le plafond par adresse d'abord (il ne coûte
 * qu'un compteur), l'anti-robot ensuite. Le refus d'un robot ne dit pas
 * pourquoi — c'est la règle de `lib/securite/antibot.ts`.
 */
export async function envoyerMessage(genre: Genre, _precedent: EtatEnvoi | null, donnees: FormData): Promise<EtatEnvoi> {
  const saisie = {
    nom: String(donnees.get("nom") ?? ""),
    email: String(donnees.get("email") ?? ""),
    sujet: String(donnees.get("sujet") ?? ""),
    corps: String(donnees.get("corps") ?? ""),
    budget: String(donnees.get("budget") ?? ""),
  };

  const borne = await verifierLimiteAction("contact.envoi");
  if (!borne.autorise) {
    return { ok: false, message: "Tu as déjà envoyé plusieurs messages : réessaie dans une heure.", saisie };
  }

  const verdict = await evaluerUnGeste({
    action: "contact",
    leurre: String(donnees.get(CHAMP_LEURRE) ?? ""),
    ouvertLe: String(donnees.get(CHAMP_OUVERTURE) ?? ""),
  });
  if (!verdict.laisserPasser) {
    return { ok: false, message: "Le message n'a pas pu partir. Recharge la page et réessaie.", saisie };
  }

  const v = validerMessage({ genre, ...saisie });
  if (!v.ok) return { ok: false, message: v.message, champ: v.champ, saisie };

  const qui = await sessionCourante();
  await enregistrerMessage(v.message, qui?.id ?? null);
  revalidatePath("/dashboard/messages-recus");
  return { ok: true };
}

export type EtatTraitement = { ok: boolean; message?: string };

const MESSAGES = {
  INTROUVABLE: "Ce message n'existe plus.",
  INTERDIT: "Ce message n'est pas de ton ressort.",
  DEJA_TRAITE: "Quelqu'un l'a déjà marqué traité.",
} as const;

export async function traiterMessage(id: string): Promise<EtatTraitement> {
  const qui = await exigerUnDesPouvoirs("traiter_les_litiges", "promouvoir_du_contenu");
  const issue = await marquerTraite({ id, parId: qui.id, role: qui.role });
  if (!issue.ok) return { ok: false, message: MESSAGES[issue.motif] };

  await consigner({ acteurId: qui.id, action: "contact.traiter", ressource: `contactMessage:${id}` });
  revalidatePath("/dashboard/messages-recus");
  return { ok: true };
}
