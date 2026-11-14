import { createElement, type CSSProperties } from "react";

import { ICONES, type NomIcone } from "@/lib/icones/donnees";
import type { Forme } from "@/lib/icones/source";

/**
 * Une icône Baobart.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUE DIT LA PLANCHE (« Baobart Icons.dc.html »)
 *
 * Grille de 24 px. Trait noir de 2 px, bouts ronds, avec en dessous un aplat
 * de couleur décalé de 1,6 px vers le bas à droite : la même ombre dure que
 * les cartes Baobart.
 *
 *   — tailles : 16 en ligne, 20 dans un bouton, 24 en navigation, 40 pour un
 *     état vide ;
 *   — aplats : jaune neutre, orange action ou alerte, violet social, lavande
 *     secondaire (`APLATS`) ;
 *   — sur fond noir, le trait passe en blanc ; l'aplat reste dans la palette.
 *
 * La planche annonce « 48 icônes » ; sa propre liste et la source en
 * comptent 49 (mesuré le 13/11/2026).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * SANS `innerHTML`
 *
 * La maquette dessine par `innerHTML` dans un élément `<bb-icon>`. Ici, chaque
 * forme est un élément React construit depuis `lib/icones/donnees.ts` : rien
 * n'est jamais interprété comme du balisage. `lib/icones/icones.test.ts` le
 * vérifie sur ce dossier.
 *
 * Aucun état, aucun effet : l'icône se rend aussi bien dans un composant
 * serveur que client.
 */

export const APLATS = {
  jaune: "#FFD84A",
  orange: "#E2622C",
  violet: "#C9A8F5",
  lavande: "#EADFF9",
} as const;

export const TRAITS = {
  encre: "#121212",
  /** Sur fond noir. */
  blanc: "#FFFFFF",
} as const;

export interface IconeProps {
  nom: NomIcone;
  /** En pixels. 16 en ligne, 20 dans un bouton, 24 en navigation, 40 pour un état vide. */
  taille?: number;
  /** Couleur de l'aplat — de préférence une valeur d'`APLATS`. */
  aplat?: string;
  /** Couleur du trait : encre, ou blanc sur fond noir. */
  trait?: string;
  /** Décalage de l'aplat, en unités de la grille de 24. */
  decalage?: number;
  /**
   * Nom lu par les lecteurs d'écran. Sans lui, l'icône est décorative et
   * masquée (`aria-hidden`) : c'est le cas d'une icône posée à côté d'un
   * texte qui dit déjà la même chose.
   */
  titre?: string;
  className?: string;
  style?: CSSProperties;
}

function dessiner(forme: Forme, cle: number) {
  return createElement(forme.t, { key: cle, ...forme.a });
}

export function Icone({
  nom,
  taille = 24,
  aplat = APLATS.jaune,
  trait = TRAITS.encre,
  decalage = 1.6,
  titre,
  className,
  style,
}: IconeProps) {
  const { formes, lignes } = ICONES[nom];
  const accessibilite = titre
    ? { role: "img", "aria-label": titre }
    : { "aria-hidden": true as const };

  return (
    <svg
      viewBox="0 0 24 24"
      width={taille}
      height={taille}
      focusable="false"
      className={className}
      // `overflow: visible` : l'aplat décalé déborde de la grille de 1,6 px.
      // `flex: none` : dans une ligne flex, une icône ne s'écrase jamais.
      style={{ display: "block", flex: "none", overflow: "visible", ...style }}
      {...accessibilite}
    >
      <g
        transform={`translate(${decalage} ${decalage})`}
        fill={aplat}
        stroke={aplat}
        strokeWidth={2}
        strokeLinejoin="round"
      >
        {formes.map(dessiner)}
      </g>
      <g
        fill="none"
        stroke={trait}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {formes.map(dessiner)}
        {lignes.map((f, i) => dessiner(f, formes.length + i))}
      </g>
    </svg>
  );
}
