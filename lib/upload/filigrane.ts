import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";

/**
 * Le filigrane visible des aperçus publics (Baobart Shield, couche 2 —
 * `Doc/SPEC_BAOBART_SHIELD.md` §3).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI UN FILIGRANE, ET PAS UN SCRIPT ANTI-CLIC-DROIT
 *
 * Une capture d'écran, une extension de téléchargement, l'inspecteur du
 * navigateur : tout ce que l'écran montre peut être pris, et aucun site ne
 * l'empêche. Ce qu'on choisit, c'est ce qui est pris. Un aperçu marqué du
 * pseudo de son créateur et du nom de Baobart reste attribuable partout où il
 * circule — c'est la seule défense qui survive à la capture.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA POLICE EST DANS LE DÉPÔT, JAMAIS CELLE DU SYSTÈME
 *
 * Mesuré le 09/10/2026 : l'image Docker (`node:22-alpine`) n'a aucune police.
 * Sous une configuration fontconfig vide, sharp dessine le texte… en carrés
 * vides (« tofu ») : l'image a bien des pixels, aucune erreur ne remonte, et
 * l'aperçu partirait avec une rangée de rectangles au lieu d'un nom. Le poste
 * de développement, lui, a des polices : tout y aurait paru juste.
 *
 * On dessine donc toujours avec `assets/polices/Inter-Bold.otf` (OFL-1.1,
 * licence à côté), copié explicitement dans l'image (Dockerfile). S'il manque,
 * on lève : mieux vaut pas d'aperçu qu'un aperçu nu.
 */

export const POLICE_FILIGRANE = join(process.cwd(), "assets", "polices", "Inter-Bold.otf");

/** Opacité du texte : lisible sur une photo claire comme sombre, sans la masquer. */
const OPACITE = 0.32;

/** Inclinaison du motif, en degrés. */
const ANGLE = -30;

/**
 * Le texte du filigrane : le pseudo du créateur, puis Baobart.
 *
 * Le pseudo est réduit aux caractères d'un identifiant : il part dans le
 * balisage Pango de sharp, où `<` ou `&` casseraient le rendu — ou pire,
 * le rendraient vide.
 */
export function texteDuFiligrane(pseudo: string | null | undefined): string {
  const propre = (pseudo ?? "").replace(/[^\p{L}\p{N}._-]/gu, "").slice(0, 40);
  return propre ? `@${propre} · Baobart` : "Baobart";
}

/** Taille du texte, proportionnelle à la largeur de l'image. */
export function tailleDuTexte(largeurImage: number): number {
  return Math.max(12, Math.round(largeurImage / 32));
}

/**
 * Les options de rendu du texte — exportées pour que le test « sans police
 * système » rende avec EXACTEMENT celles-ci, et tombe si `fontfile` disparaît.
 */
export function optionsDuTexte(texte: string, couleur: string, taille: number) {
  return {
    text: `<span foreground="${couleur}">${texte}</span>`,
    fontfile: POLICE_FILIGRANE,
    font: `Inter Bold ${taille}`,
    dpi: 72,
    rgba: true,
  };
}

function texteEnImage(texte: string, couleur: string, taille: number): Promise<Buffer> {
  return sharp({ text: optionsDuTexte(texte, couleur, taille) }).png().toBuffer();
}

/**
 * Une tuile du motif : le texte en blanc sur une ombre noire, à demi
 * transparent, incliné, entouré d'assez de vide pour que les répétitions ne
 * se touchent pas.
 *
 * Blanc ET noir : un texte d'une seule couleur disparaît sur une image de la
 * même couleur — et la moitié des visuels vendus ici sont sur fond blanc.
 */
export async function tuileDeFiligrane(texte: string, largeurImage: number): Promise<Buffer> {
  if (!existsSync(POLICE_FILIGRANE)) {
    throw new Error(`police du filigrane introuvable : ${POLICE_FILIGRANE}`);
  }

  const taille = tailleDuTexte(largeurImage);
  const [blanc, noir] = await Promise.all([
    texteEnImage(texte, "#FFFFFF", taille),
    texteEnImage(texte, "#000000", taille),
  ]);
  const { width = 1, height = 1 } = await sharp(blanc).metadata();

  const decalage = Math.max(1, Math.round(taille / 14));
  const largeur = width + decalage;
  const hauteur = height + decalage;
  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

  const ombre = await sharp({ create: { width: largeur, height: hauteur, channels: 4, background: transparent } })
    .composite([
      { input: noir, left: decalage, top: decalage },
      { input: blanc, left: 0, top: 0 },
      // Multiplie l'opacité de tout ce qui est dessiné.
      {
        input: { create: { width: largeur, height: hauteur, channels: 4, background: { r: 0, g: 0, b: 0, alpha: OPACITE } } },
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();

  const marge = Math.round(taille * 2.2);
  return sharp(ombre)
    .rotate(ANGLE, { background: transparent })
    .extend({ top: marge, bottom: marge, left: marge, right: marge, background: transparent })
    .png()
    .toBuffer();
}

/**
 * Pose le motif sur toute l'image, en répétition.
 *
 * Une tuile plus grande que l'image (vignette minuscule) est ramenée à sa
 * taille : sharp refuse de composer une surcouche plus grande que le fond.
 */
export async function filigraner(image: Buffer, texte: string): Promise<Buffer> {
  const { width = 1, height = 1 } = await sharp(image).metadata();
  let tuile = await tuileDeFiligrane(texte, width);

  const dims = await sharp(tuile).metadata();
  if ((dims.width ?? 0) > width || (dims.height ?? 0) > height) {
    tuile = await sharp(tuile).resize({ width, height, fit: "inside" }).png().toBuffer();
  }

  return sharp(image).composite([{ input: tuile, tile: true, blend: "over" }]).toBuffer();
}
