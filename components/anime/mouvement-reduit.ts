"use client";

import { useSyncExternalStore } from "react";

/**
 * Vrai quand le système demande de réduire les animations.
 *
 * Repris de `components/labo/explorations/mouvement-reduit.ts`. Écrit plutôt
 * que `useReducedMotion` de `motion` pour ne pas tirer 10 Kio de hooks
 * (mesure du 08/10, labo Animata) là où une requête média suffit.
 *
 * Pourquoi il en faut un : la règle `prefers-reduced-motion` de `globals.css`
 * raccourcit les durées CSS, mais un minuteur, un `requestAnimationFrame` ou
 * `document.startViewTransition` ne la voient pas.
 *
 * Côté serveur, et pendant l'hydratation, la réponse est « oui, réduit » :
 * rien ne démarre avant qu'on sache. La passe suivante donne la vraie valeur.
 */
const REQUETE = "(prefers-reduced-motion: reduce)";

function abonner(rappel: () => void) {
  const m = window.matchMedia(REQUETE);
  m.addEventListener("change", rappel);
  return () => m.removeEventListener("change", rappel);
}

export function useMouvementReduit() {
  return useSyncExternalStore(
    abonner,
    () => window.matchMedia(REQUETE).matches,
    () => true,
  );
}

/** La même question, posée une fois, hors de React (dans un gestionnaire). */
export function mouvementReduit(): boolean {
  return typeof window === "undefined" || window.matchMedia(REQUETE).matches;
}
