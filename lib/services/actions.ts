"use server";

import { redirect } from "next/navigation";

import { sessionCourante } from "@/lib/auth/session";
import { MESSAGES as MESSAGES_DROIT, peutPublier } from "@/lib/cms/droits";
import { verifierLimiteAction } from "@/lib/securite/garde";

import { MESSAGES_ECHEC, deposerUnService } from "@/lib/services/depot";
import { lireQualifications } from "@/lib/services/qualifications";
import type { Saisie } from "@/lib/services/validation";

/**
 * Le dépôt d'un service, depuis l'écran public.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TROIS GARDES, DANS CET ORDRE
 *
 * 1. **La session.** Déposer est une action, et une action demande un compte.
 * 2. **La limitation de débit.** Elle ne protège pas la base — l'écriture n'est
 *    pas anonyme — mais la file de relecture.
 * 3. **Le droit de publier**, en passant par le même `peutPublier` que les
 *    trois autres CMS : c'est ce qui empêche les cinq écrans de diverger le
 *    jour où la règle change.
 *
 * Un module « use server » expose chacun de ses exports au navigateur. Aucune
 * de ces gardes n'est donc dans la page : cacher un formulaire ne ferme rien.
 */

export type EtatDepot =
  | { ok: true }
  | { ok: false; message: string; champ?: string; saisie: Saisie };

export async function deposerService(
  _precedent: EtatDepot | null,
  donnees: FormData,
): Promise<EtatDepot> {
  const saisie = lireSaisie(donnees);

  const utilisateur = await sessionCourante();
  if (!utilisateur) {
    redirect("/connexion?suite=/services/deposer");
  }

  const borne = await verifierLimiteAction("service.depot");
  if (!borne.autorise) {
    return {
      ok: false,
      saisie,
      message: `Tu as déposé plusieurs services coup sur coup. Réessaie dans ${Math.ceil(borne.dansSecondes / 60)} minutes.`,
    };
  }

  const qualifs = await lireQualifications(utilisateur.id);

  const droit = peutPublier(
    {
      role: utilisateur.role,
      estVendeur: utilisateur.progression.aPublie,
      abonnementOuvert: qualifs.abonnementOuvert,
      badgeProfessionnel: qualifs.badgeProfessionnel,
    },
    "service",
  );

  if (!droit.ok) {
    return { ok: false, saisie, message: MESSAGES_DROIT[droit.motif] };
  }

  const suite = await deposerUnService({ creatorId: utilisateur.id, saisie });

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
 * saisir une description de deux mille signes pour un délai mal tapé est
 * cruel, et le créateur repart.
 */
function lireSaisie(donnees: FormData): Saisie {
  const lire = (nom: string) => String(donnees.get(nom) ?? "");
  return {
    titre: lire("titre"),
    description: lire("description"),
    categoryId: lire("categoryId"),
    startingPrice: lire("startingPrice"),
    deliveryDays: lire("deliveryDays"),
  };
}
