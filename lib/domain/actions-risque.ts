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
  /**
   * « ÉVÉNEMENT:0|1 » — l'événement et la levée de suspension dans une
   * seule clé. Deux gestes différents peuvent viser le même état d'arrivée, et
   * seul l'un des deux a le droit de défaire une suspension : les séparer dans
   * la clé évite qu'un bouton emprunte le pouvoir de l'autre.
   */
  cle: string,
  _precedent: EtatDecision | null,
  donnees: FormData,
): Promise<EtatDecision> {
  const qui = await exigerLePouvoir("agir_sur_l_exploitation");

  const [brut, drapeau] = cle.split(":");
  const event = brut as RiskEvent;
  const leveSuspension = drapeau === "1";

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
