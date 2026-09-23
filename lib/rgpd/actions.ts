"use server";

import { revalidatePath } from "next/cache";

import { sessionCourante } from "@/lib/auth/session";
import {
  annulerEffacement,
  demanderEffacement,
} from "@/lib/rgpd/effacement";

/**
 * Demander et annuler l'effacement de son compte.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE COMPTE VISÉ EST CELUI DE LA SESSION, JAMAIS UN PARAMÈTRE
 *
 * Même règle que la double authentification, et pour un enjeu plus grave
 * encore : une action « use server » qui accepterait un identifiant laisserait
 * n'importe qui programmer l'effacement du compte de n'importe qui d'autre.
 * Le formulaire n'y changerait rien — ces modules sont joignables sans passer
 * par l'écran.
 */

export type EtatAction =
  | { ok: true; message: string }
  | { ok: false; message: string };

const CHEMIN = "/dashboard/profil";

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export async function demanderMonEffacement(
  _precedent: EtatAction | null,
  donnees: FormData,
): Promise<EtatAction> {
  const moi = await sessionCourante();
  if (!moi) return { ok: false, message: "Reconnecte-toi." };

  // ══════════════════════════════════════════════════════════════════════════
  // ON FAIT RECOPIER SON ADRESSE
  //
  // Un simple bouton, même avec une fenêtre de confirmation, se clique par
  // erreur — et ce qu'on déclenche ici est irréversible au bout de trente
  // jours. Recopier son adresse demande de lire ce qu'on est en train de
  // faire.
  //
  // Comparaison insensible à la casse et aux espaces : on ne cherche pas à
  // piéger, seulement à ralentir.
  const confirmation = String(donnees.get("confirmation") ?? "")
    .trim()
    .toLowerCase();

  if (confirmation !== moi.email.toLowerCase()) {
    return {
      ok: false,
      message: "Recopie exactement ton adresse pour confirmer.",
    };
  }

  const motif = String(donnees.get("motif") ?? "").trim();
  const suite = await demanderEffacement(moi.id, motif || null);

  revalidatePath(CHEMIN);

  if (!suite.ok) {
    return {
      ok: false,
      message:
        suite.motif === "DEJA_DEMANDE"
          ? "Une demande est déjà en cours."
          : "Ce compte est déjà effacé.",
    };
  }

  return {
    ok: true,
    message: `Demande enregistrée. L'effacement aura lieu le ${DATE.format(suite.executeLe)}, sauf annulation de ta part.`,
  };
}

export async function annulerMonEffacement(
  // Imposés par `useActionState`, et inutiles ici : annuler ne demande
  // aucune saisie. Le geste n'a pas besoin d'être ralenti — c'est celui qui
  // remet les choses en place.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _precedent: EtatAction | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _donnees: FormData,
): Promise<EtatAction> {
  const moi = await sessionCourante();
  if (!moi) return { ok: false, message: "Reconnecte-toi." };

  const annule = await annulerEffacement(moi.id);

  revalidatePath(CHEMIN);

  return annule
    ? { ok: true, message: "Demande annulée. Ton compte reste en place." }
    : { ok: false, message: "Aucune demande en cours." };
}
