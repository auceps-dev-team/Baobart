"use server";

import { redirect } from "next/navigation";

import { sessionCourante } from "@/lib/auth/session";
import { MESSAGES_ECHEC, postuler } from "@/lib/jobs/postuler";
import { verifierLimiteAction } from "@/lib/securite/garde";

/**
 * Postuler à une offre depuis l'écran de candidature.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TROIS GARDES, ET LA SESSION D'ABORD
 *
 * L'offre est lue ensuite : rediriger un visiteur non connecté avant qu'il ne
 * touche à l'offre lui évite d'apprendre qu'elle existe.
 *
 * Un module « use server » expose chacun de ses exports au navigateur.
 * `offreId` est un paramètre — c'est inévitable — et c'est `postuler` qui en
 * fait le tour : offre publique, mode `BAOBART`, pas la sienne. Cacher un
 * formulaire ne ferme rien.
 */

export type EtatPostuler =
  | { ok: true }
  | { ok: false; message: string; champ?: string };

export async function envoyerCandidature(
  offreId: string,
  _precedent: EtatPostuler | null,
  donnees: FormData,
): Promise<EtatPostuler> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) {
    redirect(`/connexion?suite=/jobs/${offreId}/postuler`);
  }

  // Limitation de débit — postuler beaucoup est normal quand on cherche du
  // travail. Le plafond n'existe que contre l'envoi automatisé.
  const borne = await verifierLimiteAction("job.candidature");
  if (!borne.autorise) {
    return {
      ok: false,
      message: `Trop de candidatures d'un coup. Réessaie dans ${Math.ceil(borne.dansSecondes / 60)} minutes.`,
    };
  }

  const cv = donnees.get("cv");
  if (!(cv instanceof File)) {
    return { ok: false, champ: "cv", message: "Joins ton CV au format PDF." };
  }

  const octets = new Uint8Array(await cv.arrayBuffer());

  const suite = await postuler({
    offreId,
    candidatId: utilisateur.id,
    saisie: {
      message: String(donnees.get("message") ?? ""),
      cvNom: cv.name,
      cvOctets: cv.size,
      cvType: cv.type,
    },
    cv: octets,
  });

  if (!suite.ok) {
    if (suite.motif === "REFUS") {
      return { ok: false, champ: suite.refus.champ, message: suite.refus.message };
    }
    return { ok: false, message: MESSAGES_ECHEC[suite.motif] };
  }

  return { ok: true };
}
