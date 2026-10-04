/**
 * Ce qu'un témoignage doit être pour être proposé, et refusé.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI CE MODULE EXISTE
 *
 * La section « Ils nous font confiance » de l'accueil affichait quatre
 * témoignages de la maquette — « Mariam Sow, DA, Studio Kaay », « Yao Kouadio,
 * Type designer »… —, signés de personnes qui n'existent pas. Des avis
 * inventés présentés comme réels : ce que tout le reste du projet s'interdit.
 *
 * Décidé le 04/10 : un membre propose le sien, l'administration ou le
 * marketing le publie ou le refuse.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'ACCORD EST UNE CASE, ET ELLE N'EST PAS COCHÉE D'AVANCE
 *
 * Le témoignage paraît sur l'accueil avec le nom et l'avatar de son auteur :
 * c'est une donnée personnelle rendue publique. L'auteur le dit en cochant,
 * et la date de cet accord est gardée (`consentAt`).
 *
 * Pur : se teste sans base.
 */

export const CORPS_MIN = 20;
export const CORPS_MAX = 400;
export const ROLE_MAX = 60;
/** Comme les refus des autres contenus relus : un motif qui dit quelque chose. */
export const MOTIF_MIN = 8;

export type ChampTemoignage = "corps" | "role" | "accord";

export type VerdictTemoignage =
  | { ok: true; temoignage: { body: string; role: string | null } }
  | { ok: false; champ: ChampTemoignage; message: string };

/** Les espaces en trop et les caractères de contrôle partent ; le reste est gardé tel quel. */
function nettoyer(brut: string): string {
  return brut.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

export function validerTemoignage(saisie: { corps: string; role: string; accord: boolean }): VerdictTemoignage {
  const body = nettoyer(saisie.corps);
  if (body.length < CORPS_MIN || body.length > CORPS_MAX) {
    return {
      ok: false,
      champ: "corps",
      message: `Ton témoignage tient en ${CORPS_MIN} à ${CORPS_MAX} caractères — il en fait ${body.length}.`,
    };
  }

  const role = nettoyer(saisie.role);
  if (role.length > ROLE_MAX) {
    return { ok: false, champ: "role", message: `Ta présentation tient en ${ROLE_MAX} caractères au plus.` };
  }

  if (!saisie.accord) {
    return {
      ok: false,
      champ: "accord",
      message: "Coche la case : ton témoignage paraît sur l'accueil avec ton nom et ton avatar.",
    };
  }

  return { ok: true, temoignage: { body, role: role.length > 0 ? role : null } };
}

/** Un refus dit pourquoi : l'auteur doit pouvoir corriger. */
export function motifAcceptable(motif: string): boolean {
  return nettoyer(motif).length >= MOTIF_MIN;
}

export type StatutTemoignage = "PENDING" | "APPROVED" | "REJECTED";

export const LIBELLE_STATUT: Record<StatutTemoignage, string> = {
  PENDING: "En relecture",
  APPROVED: "Publié",
  REJECTED: "Refusé",
};
