"use client";

import { type RefObject, useLayoutEffect, useState } from "react";

/**
 * La place de l'élément actif d'un groupe, pour y glisser une pastille.
 *
 * Adapté d'Animata, `animata/tabs/fluid-tabs.tsx` (MIT, voir
 * `components/labo/animata/LICENCE-animata.md`), par le labo
 * « explorations » (`components/labo/explorations/onglets.tsx`). Ce qui a
 * changé ici :
 *
 * - plus de `motion` : l'original fait glisser sa pastille par `layoutId`, ce
 *   qui tire 41 Kio (mesure du 08/10). On mesure l'élément actif et une
 *   transition CSS fait le reste (`.pastille-glisse`, globals.css) ;
 * - la position est EN DEUX DIMENSIONS : la barre de filtres du feed passe à
 *   la ligne, et la pastille doit pouvoir changer de rangée ;
 * - seulement la mesure : la sémantique reste celle de l'appelant (ici, des
 *   boutons `aria-pressed`, pas des onglets).
 *
 * Rend `null` avant la première mesure : l'appelant marque alors l'élément
 * actif lui-même (rendu serveur, hydratation, JavaScript absent).
 *
 * `selecteur` désigne les éléments du groupe ; `actif` le rang du choisi.
 */
export function usePastille(
  conteneur: RefObject<HTMLElement | null>,
  selecteur: string,
  actif: number,
) {
  const [place, setPlace] = useState<{ x: number; y: number; l: number; h: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    const c = conteneur.current;
    if (!c) return;
    const mesurer = () => {
      const e = c.querySelectorAll<HTMLElement>(selecteur)[actif];
      setPlace(e ? { x: e.offsetLeft, y: e.offsetTop, l: e.offsetWidth, h: e.offsetHeight } : null);
    };
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(c);
    return () => obs.disconnect();
  }, [conteneur, selecteur, actif]);

  return place;
}
