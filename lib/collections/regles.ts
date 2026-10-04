/**
 * Ce qu'une collection doit être, et qui peut y toucher.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA FONCTION MANQUAIT, ET RIEN NE LE DISAIT
 *
 * Relevé le 04/10 : aucun code ne créait de collection ni n'y rangeait de
 * ressource. Le bouton « Épingler » des cartes changeait de couleur et
 * n'enregistrait rien ; l'écran « Mes collections » invitait à « épingler une
 * ressource depuis le feed » ; le partage avec une communauté
 * (`lib/forum/collections.ts`) existait, mais n'avait jamais rien à partager.
 * La base de développement contenait une collection, créée à la main par une
 * campagne QA.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TROIS DROITS, PAS UN
 *
 *   — VOIR : le propriétaire ; les membres de la communauté avec laquelle elle
 *     est partagée ; tout membre connecté si elle est publique ;
 *   — ÉPINGLER ou RETIRER une ressource : le propriétaire ;
 *   — RÉGLER (renommer, rendre privée, supprimer) : le propriétaire.
 *
 * Les membres d'une communauté voient la sélection, ils ne la modifient pas :
 * le partage d'une collection est un geste de son propriétaire et de lui seul
 * (voir l'en-tête de `lib/forum/collections.ts`), et ce qu'on y range aussi.
 *
 * Pur : se teste sans base.
 */

export const TITRE_MIN = 2;
export const TITRE_MAX = 60;
export const DESCRIPTION_MAX = 200;

export type VerdictCollection =
  | { ok: true; collection: { title: string; description: string | null; isPublic: boolean } }
  | { ok: false; champ: "titre" | "description"; message: string };

const nettoyer = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();

export function validerCollection(saisie: { titre: string; description: string; publique: boolean }): VerdictCollection {
  const title = nettoyer(saisie.titre);
  if (title.length < TITRE_MIN || title.length > TITRE_MAX) {
    return { ok: false, champ: "titre", message: `Donne-lui un nom de ${TITRE_MIN} à ${TITRE_MAX} caractères.` };
  }
  const description = nettoyer(saisie.description);
  if (description.length > DESCRIPTION_MAX) {
    return { ok: false, champ: "description", message: `La description tient en ${DESCRIPTION_MAX} caractères au plus.` };
  }
  return { ok: true, collection: { title, description: description || null, isPublic: saisie.publique } };
}

export interface CollectionDroits {
  proprietaireId: string;
  communauteId: string | null;
  publique: boolean;
}

export interface Visiteur {
  id: string;
  /** Les communautés dont il est membre. */
  communautes: ReadonlySet<string>;
}

export function peutVoir(c: CollectionDroits, v: Visiteur | null): boolean {
  if (!v) return false;
  if (v.id === c.proprietaireId) return true;
  if (c.communauteId && v.communautes.has(c.communauteId)) return true;
  return c.publique;
}

export function peutModifier(c: CollectionDroits, v: Visiteur | null): boolean {
  return v !== null && v.id === c.proprietaireId;
}
