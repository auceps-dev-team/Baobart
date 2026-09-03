"use server";

import { revalidatePath } from "next/cache";

import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import type { Geste } from "@/lib/cms/cycle";
import { MESSAGES, marquerVerifiee, trancher } from "@/lib/jobs/moderation";

/**
 * Les gestes de la file de modération.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * `moderer_le_contenu`, ET RIEN D'AUTRE
 *
 * Pas `consulter_le_systeme` : un modérateur n'a aucune raison de lire l'état
 * de la base. Enchaîner les deux gardes lui aurait fermé son propre écran —
 * c'est le piège que `exigerLePouvoir` portait avant v1.44.0.
 *
 * Un module « use server » expose chacun de ses exports au navigateur. La garde
 * est donc ici, pas dans la page : cacher un bouton ne ferme rien.
 */

export type EtatModeration = { ok: boolean; message?: string };

export async function trancherOffre(
  offreId: string,
  geste: Geste,
  _precedent: EtatModeration | null,
  donnees: FormData,
): Promise<EtatModeration> {
  const qui = await exigerLePouvoir("moderer_le_contenu");

  const suite = await trancher({
    offreId,
    geste,
    moderateurId: qui.id,
    motif: String(donnees.get("motif") ?? ""),
  });

  revalidatePath("/dashboard/moderation");

  return suite.ok ? { ok: true } : { ok: false, message: MESSAGES[suite.motif] };
}

/**
 * Poser ou retirer « Offre vérifiée ».
 *
 * Le badge est un geste à part : toute offre en ligne a été relue, mais celle-ci
 * a été *vérifiée* — l'entreprise existe, l'adresse de candidature lui
 * appartient, on ne demande pas d'argent au candidat. Les confondre viderait le
 * badge de son sens.
 */
export async function basculerVerification(
  offreId: string,
  verifiee: boolean,
): Promise<EtatModeration> {
  const qui = await exigerLePouvoir("moderer_le_contenu");

  const suite = await marquerVerifiee({
    offreId,
    moderateurId: qui.id,
    verifiee,
  });

  revalidatePath("/dashboard/moderation");

  return suite.ok ? { ok: true } : { ok: false, message: MESSAGES[suite.motif] };
}
