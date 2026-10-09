"use client";

import { flushSync } from "react-dom";

import { mouvementReduit } from "./mouvement-reduit";

/**
 * Applique une mise à jour d'état sous une transition de vue du navigateur.
 *
 * Repris de `components/labo/explorations/grille-liste.tsx` (hors Animata,
 * API View Transitions). Le navigateur photographie la page, on change le
 * DOM, il photographie de nouveau et anime d'une photo à l'autre ; chaque
 * élément qui porte un `view-transition-name` unique voyage jusqu'à sa
 * nouvelle place.
 *
 * `flushSync` force React à écrire le DOM DANS le rappel. Sans lui, la mise à
 * jour arrive après la seconde photo et il n'y a rien à animer — aucune
 * erreur, simplement aucun mouvement (relevé au labo le 08/10).
 *
 * Replis : sans l'API, ou sous mouvement réduit, la mise à jour s'applique
 * d'un coup. La règle globale de `globals.css` ne vise pas les
 * pseudo-éléments `::view-transition-*`, qui garderaient leur durée : on ne
 * démarre donc pas la transition du tout.
 */
export function avecTransition(maj: () => void) {
  if (mouvementReduit() || typeof document.startViewTransition !== "function") {
    maj();
    return;
  }
  document.startViewTransition(() => flushSync(maj));
}
