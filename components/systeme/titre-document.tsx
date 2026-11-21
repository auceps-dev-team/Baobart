"use client";

import { useEffect } from "react";

/**
 * Le titre de l'onglet, pour une vue qui n'a pas de page à elle.
 *
 * Q-29 (recette du 14/11/2026) : la fiche ouverte EN FENÊTRE (route
 * interceptée `@modal/(.)products`) gardait le titre de la page de dessous —
 * un lecteur d'écran annonçait « Explorer » sur la fiche d'une affiche. Le
 * titre précédent revient à la fermeture.
 */
export function TitreDocument({ titre }: { titre: string }) {
  useEffect(() => {
    const avant = document.title;
    document.title = titre;
    return () => {
      document.title = avant;
    };
  }, [titre]);
  return null;
}
