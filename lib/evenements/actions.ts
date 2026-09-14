"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Geste } from "@/lib/cms/cycle";
import { exigerAccesAuxEvenements } from "@/lib/evenements/garde";
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
 * Les gestes sur les événements — de l'équipe comme d'une agence.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE GARDE QUI REND UNE PORTÉE, PAS UN OUI OU NON
 *
 * C'était `exigerLePouvoir("publier_du_contenu")` jusqu'à v1.50.0. Cette
 * garde-là ne sait répondre qu'à « entres-tu ? », et il fallait désormais
 * répondre aussi à « jusqu'où ? ».
 *
 * `exigerAccesAuxEvenements` rend les deux d'un coup, et chaque appel au
 * module de rédaction reçoit la portée. Un geste qui l'oublierait ne
 * compilerait pas : c'est la seule forme de vigilance qui ne s'épuise pas.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN MODULE « use server » EXPOSE CHACUN DE SES EXPORTS AU NAVIGATEUR
 *
 * Les gardes sont donc ici, pas dans les pages : cacher un formulaire ne ferme
 * rien. Et l'identifiant de l'événement arrive du client — il ne prouve rien.
 * C'est la portée, lue de la session, qui décide.
 */

export type EtatFormulaire =
  | { ok: true }
  | { ok: false; message: string; champ?: string; saisie: Saisie };

export async function creerEvenement(
  _precedent: EtatFormulaire | null,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const { utilisateur } = await exigerAccesAuxEvenements();
  const saisie = lireSaisie(donnees);

  // `auteurId` vient de la session, jamais du formulaire : le recevoir du
  // client suffirait à créer un événement au nom de quelqu'un d'autre — et
  // c'est ce nom qui deviendrait la portée du propriétaire.
  const suite = await creer({ auteurId: utilisateur.id, saisie });

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
  const { portee } = await exigerAccesAuxEvenements();
  const saisie = lireSaisie(donnees);

  const suite = await modifier({ evenementId, saisie, portee });

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
  const { utilisateur, portee } = await exigerAccesAuxEvenements();

  const suite = await trancher({
    evenementId,
    geste,
    acteurId: utilisateur.id,
    portee,
  });

  // La file se vide aussi depuis cet écran : soumettre l'y met, publier l'en
  // retire. Oublier cette ligne ferait afficher une file périmée à qui vient
  // d'y agir depuis ailleurs.
  revalidatePath("/dashboard/moderation");
  revalidatePath("/dashboard/evenements");
  revalidatePath(`/dashboard/evenements/${evenementId}`);

  return suite.ok ? { ok: true } : { ok: false, message: MESSAGES_ECHEC[suite.motif] };
}

/**
 * La même décision, mais depuis un formulaire.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX ACTIONS POUR UN SEUL GESTE, ET CE N'EST PAS UN DOUBLON
 *
 * `trancherEvenement` part d'un **clic** : un bouton, une transition, rien à
 * saisir — c'est `useTransition` côté client. Celle-ci part d'un
 * **formulaire**, parce qu'un refus porte un texte — c'est `useActionState`,
 * dont la signature impose l'état précédent et le `FormData`.
 *
 * Les deux appellent le même `trancher`, qui porte toute la règle. Ce qui est
 * dupliqué ici est une forme d'appel, pas une décision.
 *
 * Elle sert aux deux écrans où l'on tranche : la file de modération, et la
 * fiche de l'événement.
 */
export async function trancherEvenementAvecMotif(
  evenementId: string,
  geste: Geste,
  _precedent: EtatGeste | null,
  donnees: FormData,
): Promise<EtatGeste> {
  const { utilisateur, portee } = await exigerAccesAuxEvenements();

  const suite = await trancher({
    evenementId,
    geste,
    acteurId: utilisateur.id,
    portee,
    motif: String(donnees.get("motif") ?? ""),
  });

  revalidatePath("/dashboard/moderation");
  revalidatePath("/dashboard/evenements");
  revalidatePath(`/dashboard/evenements/${evenementId}`);

  return suite.ok ? { ok: true } : { ok: false, message: MESSAGES_ECHEC[suite.motif] };
}

export async function annulerEvenement(
  evenementId: string,
  _precedent: EtatGeste | null,
  donnees: FormData,
): Promise<EtatGeste> {
  const { utilisateur, portee } = await exigerAccesAuxEvenements();

  const suite = await annuler({
    evenementId,
    raison: String(donnees.get("raison") ?? ""),
    acteurId: utilisateur.id,
    portee,
  });

  revalidatePath("/dashboard/evenements");
  revalidatePath(`/dashboard/evenements/${evenementId}`);

  return suite.ok ? { ok: true } : { ok: false, message: MESSAGES_ECHEC[suite.motif] };
}

export async function retablirEvenement(evenementId: string): Promise<EtatGeste> {
  const { utilisateur, portee } = await exigerAccesAuxEvenements();

  const suite = await retablir({ evenementId, acteurId: utilisateur.id, portee });

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
