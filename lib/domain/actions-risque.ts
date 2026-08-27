"use server";

import { revalidatePath } from "next/cache";

import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import { appliquerEvenementRisque } from "@/lib/domain/risque";
import type { RiskEvent } from "@/lib/domain/trust";

/**
 * Décider du sort d'un compte, depuis l'administration.
 *
 * La garde exige `agir_sur_l_exploitation`, et l'auteur de la décision est lu
 * depuis la session — jamais reçu en paramètre. Un module « use server » est
 * joignable sans passer par l'écran : quelqu'un qui pourrait choisir son propre
 * nom d'auteur signerait une suspension du nom d'un collègue.
 */

export type EtatDecision =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function deciderDuCompte(
  userId: string,
  event: RiskEvent,
  leveSuspension: boolean,
  _precedent: EtatDecision | null,
  donnees: FormData,
): Promise<EtatDecision> {
  const qui = await exigerLePouvoir("agir_sur_l_exploitation");

  // Le motif n'est pas décoratif : une suspension sans raison écrite est
  // impossible à défendre trois mois plus tard, devant le créateur ou ailleurs.
  const motif = String(donnees.get("motif") ?? "").trim();
  if (motif.length < 4) {
    return { ok: false, message: "Écris la raison de cette décision." };
  }

  // On ne se sanctionne pas soi-même : la garde éviterait surtout qu'un
  // administrateur ferme sa propre session par mégarde en testant l'écran.
  if (userId === qui.id) {
    return { ok: false, message: "On ne décide pas sur son propre compte." };
  }

  const suite = await appliquerEvenementRisque({
    userId,
    event,
    auteur: qui.email,
    motif,
    clearSuspension: leveSuspension,
  });

  revalidatePath("/dashboard/systeme/membres");

  if (!suite.applique) return { ok: false, message: suite.message };

  return {
    ok: true,
    message: `Compte passé de ${suite.de} à ${suite.vers}.`,
  };
}
