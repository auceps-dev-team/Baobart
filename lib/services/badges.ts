/**
 * Les deux badges professionnels — Freelance et Agence.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ILS S'EXCLUENT, ET C'EST INTENTIONNEL
 *
 * La maquette des badges (E.1) le dit franchement : « Freelance et Agence
 * s'excluent ». On est l'un ou l'autre — jamais les deux. Un compte qui
 * afficherait les deux racontrait qu'il est simultanément indépendant et
 * structure, ce qui n'a pas de sens pour l'acheteur qui les lit.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'EXCLUSIVITÉ VIT ICI, PAS DANS LE SCHÉMA
 *
 * Une contrainte SQL demanderait de connaître les identifiants des badges
 * (`badgeId`), et non leur code. Ils sont posés par un seed et changent d'un
 * environnement à l'autre — la contrainte n'aurait donc rien de portable, et
 * finirait recopiée à la main dans chaque migration.
 *
 * Un module pur, en revanche, se relit facilement et se teste sans base :
 * `retirer <badge complémentaire> AVANT de poser` — deux instructions, une
 * transaction, la même sémantique qu'un swap.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'ATTRIBUTION EST UN ACTE D'ADMINISTRATION
 *
 * Un badge que l'on se donne soi-même ne vaut rien — surtout sur des
 * prestations payantes, où c'est précisément ce qu'un arnaqueur cocherait.
 * Le module rend une DÉCISION ; la trace à l'audit et la garde du pouvoir
 * `moderer_le_contenu` sont ajoutées par l'appelant (§13 de la spec).
 */

import type { BadgeCode } from "@prisma/client";

/** Les deux codes qui s'excluent. Nommer aide à la lecture des tests. */
export const BADGES_PRO: readonly BadgeCode[] = ["FREELANCE", "AGENCE"];

export type BadgePro = "FREELANCE" | "AGENCE";

/** L'autre badge de la paire — utile pour savoir lequel retirer. */
export function opposeDe(badge: BadgePro): BadgePro {
  return badge === "FREELANCE" ? "AGENCE" : "FREELANCE";
}

/**
 * Peut-on poser ce badge sur ce compte, tel qu'il est aujourd'hui ?
 *
 * Renvoie une décision, jamais une exception : la garde de l'appelant a
 * déjà tranché « qui a le droit », ce module tranche « est-ce cohérent ».
 * Deux motifs distincts pour deux corrections distinctes.
 */
export type Verdict =
  | { ok: true; retirerAvant: BadgePro | null }
  | { ok: false; motif: "DEJA_POSE" };

export function verdictPour(input: {
  aPoser: BadgePro;
  badgesActuels: readonly BadgeCode[];
}): Verdict {
  const { aPoser, badgesActuels } = input;

  // Déjà en place : rien à faire, mais l'appelant doit le savoir pour ne
  // pas écrire une seconde ligne (que l'unicité `(userId, badgeId)`
  // refuserait de toute façon, mais sans message clair).
  if (badgesActuels.includes(aPoser)) {
    return { ok: false, motif: "DEJA_POSE" };
  }

  const oppose = opposeDe(aPoser);
  const doitRetirer = badgesActuels.includes(oppose);

  return { ok: true, retirerAvant: doitRetirer ? oppose : null };
}
