"use client";

import { useEffect } from "react";

import { marquerFilVuAction } from "@/lib/social/actions";

/**
 * Marque le fil « Suivre les détails » vu, une fois la page AFFICHÉE (lot 5b).
 *
 * Pas pendant le rendu du serveur : la page dit « NOUVEAU » d'après la visite
 * précédente, et c'est après qu'elle est sous les yeux qu'on avance la marque.
 * `rendueLe` est l'instant du rendu, pas celui de la réponse : une ressource
 * parue entre les deux n'a pas été vue. En développement, React joue l'effet
 * deux fois : sans conséquence, la marque ne fait qu'avancer
 * (`marquerFilVu`, lib/social/fil.ts).
 */
export function MarqueFilVu({ rendueLe }: { rendueLe: string }) {
  useEffect(() => {
    void marquerFilVuAction(rendueLe);
  }, [rendueLe]);
  return null;
}
