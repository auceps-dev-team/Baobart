"use server";

import { revalidatePath } from "next/cache";

import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import type { Geste } from "@/lib/cms/cycle";
import { MESSAGES, trancher } from "@/lib/services/moderation";

/**
 * Le geste de la file de modération, pour un service.
 *
 * Un module « use server » expose chacun de ses exports au navigateur. La
 * garde `moderer_le_contenu` est donc ici, pas dans la page — cacher un
 * bouton ne ferme rien.
 */

export type EtatModeration = { ok: boolean; message?: string };

export async function trancherService(
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
