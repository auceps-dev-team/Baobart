"use server";

import { confirmer, desinscrire, inscrire } from "@/lib/infolettre/service";
import { CHAMP_LEURRE, evaluerUnGeste } from "@/lib/securite/antibot";
import { verifierLimiteAction } from "@/lib/securite/garde";

export type EtatInscription = { ok: true; message: string } | { ok: false; message: string };

/**
 * Le champ « Reste au courant » du pied de page.
 *
 * Le leurre seul, sans délai minimum : le champ est dans le pied de page, et
 * quelqu'un qui le remplit en arrivant n'est pas un robot. Le plafond par
 * adresse fait le reste.
 */
export async function sInscrireALaLettre(_precedent: EtatInscription | null, donnees: FormData): Promise<EtatInscription> {
  const borne = await verifierLimiteAction("infolettre.inscription");
  if (!borne.autorise) return { ok: false, message: "Trop d'essais depuis cette connexion — réessaie dans une heure." };

  const verdict = await evaluerUnGeste({ action: "infolettre", leurre: String(donnees.get(CHAMP_LEURRE) ?? "") });
  if (!verdict.laisserPasser) return { ok: false, message: "L'inscription n'a pas pu partir. Recharge la page et réessaie." };

  const r = await inscrire(String(donnees.get("email") ?? ""));
  if (!r.fait) {
    return {
      ok: false,
      message: r.motif === "adresse_invalide" ? "Cette adresse ne semble pas valide." : "L'inscription est indisponible pour le moment.",
    };
  }
  // La même phrase, que l'adresse soit nouvelle, en attente ou déjà inscrite.
  return { ok: true, message: "Regarde ta boîte : un lien de confirmation vient de partir, s'il le fallait." };
}

export type EtatLien = { fait: false } | { fait: true; ok: boolean; message: string };

export async function confirmerInscription(jeton: string): Promise<EtatLien> {
  const r = await confirmer(jeton);
  if (r.ok) return { fait: true, ok: true, message: "C'est confirmé : tu recevras la lettre de Baobart." };
  return {
    fait: true,
    ok: false,
    message:
      r.motif === "EXPIRE"
        ? "Ce lien a expiré. Inscris-toi de nouveau depuis le pied de page : un nouveau lien partira."
        : r.motif === "DESINSCRITE"
          ? "Cette adresse s'est désinscrite depuis : ce lien ne la réinscrit pas."
          : "Ce lien ne correspond à aucune inscription.",
  };
}

export async function confirmerDesinscription(jeton: string): Promise<EtatLien> {
  const r = await desinscrire(jeton);
  return r.ok
    ? { fait: true, ok: true, message: "C'est fait : cette adresse ne recevra plus la lettre de Baobart." }
    : { fait: true, ok: false, message: "Ce lien ne correspond à aucune inscription." };
}
