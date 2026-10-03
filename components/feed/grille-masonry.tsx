"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { ECART, colonnesPour, repartir } from "@/lib/feed/masonry";

/**
 * La grille masonry : des colonnes empilées, chaque carte dans la plus courte.
 *
 * La répartition vit dans `lib/feed/masonry.ts` — voir pourquoi les colonnes
 * CSS ne suffisaient plus. Ce composant ne fait que mesurer la largeur et
 * poser les piles.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE NOMBRE DE COLONNES DU PREMIER RENDU VIENT DU SERVEUR
 *
 * Avant que le navigateur ne mesure quoi que ce soit, il faut bien dessiner
 * quelque chose. Quatre colonnes sur un téléphone, puis une seule à
 * l'hydratation, ferait sauter toute la grille sous le pouce. La page devine
 * donc depuis l'agent utilisateur (`colonnesInitiales`) ; la mesure corrige
 * ensuite, avant la première peinture côté client.
 */
export function GrilleMasonry<T>({
  elements,
  cle,
  hauteur,
  rendu,
  colonnesInitiales,
}: {
  elements: readonly T[];
  cle: (element: T) => string;
  /** La hauteur estimée d'une carte, pour une largeur de colonne donnée. */
  hauteur: (element: T, largeurColonne: number) => number;
  rendu: (element: T) => ReactNode;
  colonnesInitiales: number;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = conteneur.current;
    if (!el) return;
    const mesurer = () => setLargeur(el.clientWidth);
    mesurer();
    if (typeof ResizeObserver === "undefined") return;
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(el);
    return () => observateur.disconnect();
  }, []);

  const colonnes = largeur === null ? colonnesInitiales : colonnesPour(largeur);
  // Sans mesure, on suppose la largeur de la maquette (1400 − 2 × 32).
  const largeurTotale = largeur ?? 1336;
  const largeurColonne = (largeurTotale - ECART * (colonnes - 1)) / colonnes;
  const piles = repartir(
    elements.map((e) => hauteur(e, largeurColonne)),
    colonnes,
  );

  return (
    <div
      ref={conteneur}
      style={{ display: "flex", gap: ECART, alignItems: "flex-start" }}
    >
      {piles.map((pile, c) => (
        <div
          key={c}
          style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column" }}
        >
          {pile.map((i) => {
            const element = elements[i] as T;
            return <div key={cle(element)}>{rendu(element)}</div>;
          })}
        </div>
      ))}
    </div>
  );
}
