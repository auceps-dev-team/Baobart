/**
 * Ce qu'un message de contact doit porter pour être enregistré.
 *
 * Module pur : la page, l'action et les tests lisent les mêmes bornes.
 */

import { adressePlausible } from "@/lib/email/pilotes";

export const NOM_MIN = 2;
export const NOM_MAX = 80;
export const SUJET_MIN = 3;
export const SUJET_MAX = 120;
export const CORPS_MIN = 10;
export const CORPS_MAX = 4000;
export const BUDGET_MAX = 80;

export type Genre = "CONTACT" | "SPONSOR";
export type ChampContact = "nom" | "email" | "sujet" | "corps" | "budget";

/** Les sujets proposés au formulaire Contact — les questions de la maquette. */
export const SUJETS_CONTACT = [
  "Une question sur une licence",
  "Un paiement ou un remboursement",
  "Un fichier qui ne se télécharge pas",
  "Mon compte",
  "Un bug",
  "Un partenariat ou la presse",
  "Autre chose",
] as const;

export interface Saisie {
  genre: Genre;
  nom: string;
  email: string;
  sujet: string;
  corps: string;
  budget?: string;
}

export interface MessageValide {
  genre: Genre;
  nom: string;
  email: string;
  sujet: string;
  corps: string;
  budget: string | null;
}

export type Verdict = { ok: true; message: MessageValide } | { ok: false; champ: ChampContact; message: string };

export function validerMessage(s: Saisie): Verdict {
  const nom = s.nom.trim().replace(/\s+/g, " ");
  const email = s.email.trim().toLowerCase();
  // Une demande de sponsoring n'a pas de sujet à choisir : c'en est un.
  const sujet = (s.genre === "SPONSOR" ? "Sponsoriser" : s.sujet).trim().replace(/\s+/g, " ");
  const corps = s.corps.trim();
  const budget = (s.budget ?? "").trim().replace(/\s+/g, " ");

  if (nom.length < NOM_MIN || nom.length > NOM_MAX) {
    return { ok: false, champ: "nom", message: `Ton nom, entre ${NOM_MIN} et ${NOM_MAX} caractères.` };
  }
  if (!adressePlausible(email)) {
    return { ok: false, champ: "email", message: "Une adresse e-mail où te répondre." };
  }
  if (sujet.length < SUJET_MIN || sujet.length > SUJET_MAX) {
    return { ok: false, champ: "sujet", message: "Choisis un sujet." };
  }
  if (corps.length < CORPS_MIN) {
    return { ok: false, champ: "corps", message: `Dis-nous en un peu plus — ${CORPS_MIN} caractères au moins.` };
  }
  if (corps.length > CORPS_MAX) {
    return { ok: false, champ: "corps", message: `${CORPS_MAX} caractères au plus.` };
  }
  if (budget.length > BUDGET_MAX) {
    return { ok: false, champ: "budget", message: `${BUDGET_MAX} caractères au plus.` };
  }

  return { ok: true, message: { genre: s.genre, nom, email, sujet, corps, budget: budget.length > 0 ? budget : null } };
}
