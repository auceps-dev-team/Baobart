import { useSyncExternalStore } from "react";

/**
 * Ce que seul le navigateur sait, lu SANS effet.
 *
 * L1 (#65) : `react-hooks/set-state-in-effect` relevait des composants qui
 * posaient ces valeurs dans un `useEffect` après le premier rendu — un rendu de
 * plus à chaque montage, et une exception de lint par composant. Le moyen
 * prévu par React pour lire une valeur extérieure sans casser l'hydratation
 * est `useSyncExternalStore` : la valeur du serveur (ici `null` ou `false`) sert
 * au rendu serveur et à l'hydratation, puis celle du navigateur prend le relais.
 *
 * Ces valeurs ne changent pas pendant la vie de la page : rien à écouter.
 */
const sansAbonnement = () => () => {};

/** `https://baobart.ci` dans le navigateur ; `null` au rendu serveur. */
export function useOrigine(): string | null {
  return useSyncExternalStore(sansAbonnement, () => window.location.origin, () => null);
}

/** Le partage natif (`navigator.share`) existe-t-il ? `false` au rendu serveur. */
export function usePartageNatif(): boolean {
  return useSyncExternalStore(sansAbonnement, () => typeof navigator.share === "function", () => false);
}
