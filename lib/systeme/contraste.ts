import { BLANC, ENCRE } from "@/lib/systeme/charte";

/**
 * Le contraste d'un texte sur son fond, selon WCAG 2.1 (critère 1.4.3).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI CE MODULE EXISTE (08/11/2026)
 *
 * La maquette des badges pose du blanc sur l'orange de la charte (#E2622C) :
 * « Pionnier », « Bibliothèque », « Mille ventes ». Le rapport vaut 3,5 pour 1.
 * WCAG demande 4,5 pour un texte courant, 3 pour un « grand » texte — 24 px,
 * ou 18,66 px en gras. Le chiffre d'un jeton de 44 px, « 1K » à 15 px, n'est
 * pas un grand texte : la maquette, recopiée telle quelle, le rendait illisible
 * pour une partie des gens, sans qu'aucun outil ne le signale.
 *
 * Plutôt que de corriger couleur par couleur, on calcule : la couleur de la
 * maquette est gardée quand elle passe, l'encre ou le blanc la remplace sinon.
 */

function canal(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Luminance relative d'une couleur `#RRGGBB`. */
export function luminance(hex: string): number {
  const v = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!v) throw new Error(`couleur illisible : ${hex}`);
  const n = Number.parseInt(v[1]!, 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

export function rapportDeContraste(a: string, b: string): number {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (clair + 0.05) / (sombre + 0.05);
}

/**
 * Le seuil qu'un texte doit atteindre. La police d'affichage est grasse
 * (Archivo Black) : elle devient un « grand texte » dès 18,66 px.
 */
export function seuilPour(taillePx: number, gras: boolean): number {
  return taillePx >= 24 || (gras && taillePx >= 18.66) ? 3 : 4.5;
}

/** L'encre demandée si elle se lit sur ce fond ; sinon, la plus lisible de l'encre et du blanc. */
export function encreLisible(fond: string, encre: string, taillePx: number, gras = true): string {
  if (rapportDeContraste(encre, fond) >= seuilPour(taillePx, gras)) return encre;
  return rapportDeContraste(ENCRE, fond) >= rapportDeContraste(BLANC, fond) ? ENCRE : BLANC;
}
