"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import type { Geste } from "@/lib/cms/cycle";
import {
  MESSAGES_ECHEC,
  annuler,
  creer,
  modifier,
  retablir,
  trancher,
} from "@/lib/evenements/redaction";
import type { Saisie } from "@/lib/evenements/validation";

/**
 * Les gestes de l'administration sur les événements.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * `publier_du_contenu`, ET RIEN D'AUTRE
 *
 * Pas `consulter_le_systeme` : quelqu'un qui écrit des événements n'a aucune
 * raison de lire l'état de la base. Enchaîner les deux gardes lui fermerait
 * son propre écran — c'est le piège que `exigerLePouvoir` portait avant
 * v1.44.0, et que §20.1 raconte.
 *
 * Un module « use server » expose chacun de ses exports au navigateur. Les
 * gardes sont donc ici, pas dans les pages : cacher un formulaire ne ferme
 * rien.
 */

export type EtatFormulaire =
  | { ok: true }
  | { ok: false; message: string; champ?: string; saisie: Saisie };

export async function creerEvenement(
  _precedent: EtatFormulaire | null,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const qui = await exigerLePouvoir("publier_du_contenu");
  const saisie = lireSaisie(donnees);

  const suite = await creer({ auteurId: qui.id, saisie });

  if (!suite.ok) {
    if (suite.motif === "REFUS") {
      return { ok: false, saisie, champ: suite.refus.champ, message: suite.refus.message };
    }
    return { ok: false, saisie, message: MESSAGES_ECHEC[suite.motif] };
  }

  revalidatePath("/dashboard/evenements");
  // On part sur la fiche d'édition : un événement créé est un brouillon qu'on
  // veut relire avant de publier, pas une ligne de plus dans une liste.
  redirect(`/dashboard/evenements/${suite.evenementId}`);
}

export async function modifierEvenement(
  evenementId: string,
  _precedent: EtatFormulaire | null,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerLePouvoir("publier_du_contenu");
  const saisie = lireSaisie(donnees);

  const suite = await modifier({ evenementId, saisie });

  if (!suite.ok) {
    if (suite.motif === "REFUS") {
      return { ok: false, saisie, champ: suite.refus.champ, message: suite.refus.message };
    }
    return { ok: false, saisie, message: MESSAGES_ECHEC[suite.motif] };
  }

  revalidatePath("/dashboard/evenements");
  revalidatePath(`/dashboard/evenements/${evenementId}`);
  return { ok: true };
}

export type EtatGeste = { ok: boolean; message?: string };

export async function trancherEvenement(
  evenementId: string,
  geste: Geste,
): Promise<EtatGeste> {
  const qui = await exigerLePouvoir("publier_du_contenu");

  const suite = await trancher({ evenementId, geste, acteurId: qui.id });

  revalidatePath("/dashboard/evenements");
  revalidatePath(`/dashboard/evenements/${evenementId}`);

  return suite.ok ? { ok: true } : { ok: false, message: MESSAGES_ECHEC[suite.motif] };
}

export async function annulerEvenement(
  evenementId: string,
  _precedent: EtatGeste | null,
  donnees: FormData,
): Promise<EtatGeste> {
  const qui = await exigerLePouvoir("publier_du_contenu");

  const suite = await annuler({
    evenementId,
    raison: String(donnees.get("raison") ?? ""),
    acteurId: qui.id,
  });

  revalidatePath("/dashboard/evenements");
  revalidatePath(`/dashboard/evenements/${evenementId}`);

  return suite.ok ? { ok: true } : { ok: false, message: MESSAGES_ECHEC[suite.motif] };
}

export async function retablirEvenement(evenementId: string): Promise<EtatGeste> {
  const qui = await exigerLePouvoir("publier_du_contenu");

  const suite = await retablir({ evenementId, acteurId: qui.id });

  revalidatePath("/dashboard/evenements");
  revalidatePath(`/dashboard/evenements/${evenementId}`);

  return suite.ok ? { ok: true } : { ok: false, message: MESSAGES_ECHEC[suite.motif] };
}

/**
 * Ce que le formulaire a envoyé, renvoyé tel quel en cas de refus.
 *
 * React vide les champs non contrôlés à la fin d'une action serveur. Refaire
 * saisir une description de deux mille signes pour une heure mal tapée est
 * cruel.
 */
function lireSaisie(donnees: FormData): Saisie {
  const lire = (nom: string) => String(donnees.get(nom) ?? "");
  return {
    titre: lire("titre"),
    description: lire("description"),
    genre: lire("genre"),
    debut: lire("debut"),
    fin: lire("fin"),
    lieu: lire("lieu"),
    enLigne: lire("enLigne"),
    capacite: lire("capacite"),
    prixBillet: lire("prixBillet"),
    dotation: lire("dotation"),
  };
}
