"use server";

import { redirect } from "next/navigation";

import { sessionCourante } from "@/lib/auth/session";
import { peutPublier } from "@/lib/cms/droits";
import { MESSAGES_ECHEC, deposerUneOffre } from "@/lib/jobs/depot";
import { MESSAGES as MESSAGES_DROIT } from "@/lib/cms/droits";
import type { Saisie } from "@/lib/jobs/validation";
import { verifierLimiteAction } from "@/lib/securite/garde";

/**
 * Le dépôt d'une offre, depuis l'écran public.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TROIS GARDES, DANS CET ORDRE
 *
 * 1. **La session.** Déposer est une action, et une action demande un compte.
 *    Voir est public ; c'est la seule asymétrie de Jobs.
 * 2. **La limitation de débit.** Elle ne protège pas la base — l'écriture n'est
 *    pas anonyme — mais la file de relecture : quarante offres en dix minutes
 *    la noieraient, et les vraies attendraient derrière.
 * 3. **Le droit de publier.** Pour Jobs il est acquis à tout inscrit, et l'on
 *    passe quand même par `peutPublier` : écrire « tout le monde peut » en dur
 *    ici ferait diverger cet écran des trois autres le jour où la règle change.
 *
 * Un module « use server » expose chacun de ses exports au navigateur. Aucune
 * de ces gardes n'est donc dans la page : cacher un formulaire ne ferme rien.
 */

export type EtatDepot =
  | { ok: true }
  | { ok: false; message: string; champ?: string; saisie: Saisie };

export async function deposerOffre(
  _precedent: EtatDepot | null,
  donnees: FormData,
): Promise<EtatDepot> {
  const saisie = lireSaisie(donnees);

  const utilisateur = await sessionCourante();
  if (!utilisateur) {
    // Redirection plutôt que message : la personne a déjà écrit son offre, et
    // lui dire « connecte-toi » sans l'y emmener lui fait chercher la porte.
    redirect("/connexion?suite=/jobs/deposer");
  }

  const borne = await verifierLimiteAction("job.depot");
  if (!borne.autorise) {
    return {
      ok: false,
      saisie,
      message: `Tu as déposé plusieurs offres coup sur coup. Réessaie dans ${Math.ceil(borne.dansSecondes / 60)} minutes.`,
    };
  }

  // Jobs l'accorde à tout inscrit — mais la question passe par le même module
  // que les trois autres CMS, et c'est ce qui garantit qu'ils ne divergeront
  // pas.
  const droit = peutPublier(
    {
      role: utilisateur.role,
      // Ces trois-là ne servent qu'aux services. On les renseigne au plus juste
      // plutôt que de mentir : `peutPublier` ne les lit pas pour un job.
      estVendeur: utilisateur.progression.aPublie,
      abonnementOuvert: false,
      badgeProfessionnel: false,
    },
    "job",
  );

  if (!droit.ok) {
    return { ok: false, saisie, message: MESSAGES_DROIT[droit.motif] };
  }

  const suite = await deposerUneOffre({ auteurId: utilisateur.id, saisie });

  if (!suite.ok) {
    if (suite.motif === "REFUS") {
      return {
        ok: false,
        saisie,
        champ: suite.refus.champ,
        message: suite.refus.message,
      };
    }
    return { ok: false, saisie, message: MESSAGES_ECHEC[suite.motif] };
  }

  return { ok: true };
}

/**
 * Ce que le formulaire a envoyé, renvoyé tel quel en cas de refus.
 *
 * React vide les champs non contrôlés à la fin d'une action serveur. Refaire
 * saisir une description de deux mille signes pour une date mal tapée est
 * cruel, et l'annonceur repart.
 */
function lireSaisie(donnees: FormData): Saisie {
  const lire = (nom: string) => String(donnees.get(nom) ?? "");
  return {
    titre: lire("titre"),
    description: lire("description"),
    type: lire("type"),
    mode: lire("mode"),
    pays: lire("pays"),
    ville: lire("ville"),
    salaireMin: lire("salaireMin"),
    salaireMax: lire("salaireMax"),
    echeance: lire("echeance"),
    commentPostuler: lire("commentPostuler"),
    urlExterne: lire("urlExterne"),
  };
}
