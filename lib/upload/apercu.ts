import "server-only";

import sharp from "sharp";

import { journal } from "@/lib/observabilite/journal";

import { filigraner, texteDuFiligrane } from "./filigrane";
import { formatDe } from "./formats";
import {
  PREFIXE_PUBLIC,
  deposerObjet,
  telechargerObjet,
  urlPublique,
} from "./storage";

/**
 * Fabrique des aperçus.
 *
 * L'aperçu est une **image dérivée**, pas le fichier vendu. La distinction est
 * tout l'enjeu : un PNG à 8 000 px vendu 15 000 F ne peut pas servir lui-même
 * de vignette au feed, sinon il est gratuit pour qui lit le code source de la
 * page. On produit donc une version réduite, publique, et l'original reste
 * privé derrière une URL signée.
 */

/**
 * Largeur maximale d'un aperçu, et sa qualité.
 *
 * 800 px en WebP qualité 60 : `Doc/SPEC_BAOBART_SHIELD.md` §3.1 (« aperçu
 * détail ~800 px, q60, filigrane diagonal visible »). Avant le 09/10/2026 :
 * 1 400 px en qualité 80, sans marque — assez pour un usage réel de l'image,
 * ce qui en faisait la version gratuite de ce qui est vendu. La carte du fil
 * l'affiche sur moins de 400 px : elle n'y perd rien.
 */
export const LARGEUR_APERCU = 800;
export const QUALITE_APERCU = 60;

/**
 * Change quand la recette de l'aperçu change.
 *
 * Les aperçus sont servis avec `Cache-Control: immutable` pour un an : réécrire
 * la MÊME clé laisserait l'ancienne image — grande et sans filigrane — dans le
 * cache des navigateurs et du CDN. Une nouvelle clé force le nouveau rendu ;
 * l'ancienne est supprimée par `scripts/regenerer-apercus.ts`.
 */
export const VERSION_APERCU = 2;

export function cleDApercu(mediaId: string): string {
  return `${PREFIXE_PUBLIC}apercus/${mediaId}-v${VERSION_APERCU}.webp`;
}

/** La clé d'avant le filigrane, à supprimer. */
export function ancienneCleDApercu(mediaId: string): string {
  return `${PREFIXE_PUBLIC}apercus/${mediaId}.webp`;
}

/**
 * Au-delà, on renonce à l'aperçu plutôt que de charger le fichier en mémoire.
 * La ressource reste vendable — elle affichera la trame du design system.
 */
export const POIDS_MAX_APERCU = 40 * 1024 * 1024;

export interface Apercu {
  cle: string;
  url: string;
  largeur: number;
  hauteur: number;
}

/**
 * Dimensions réelles du fichier, lues à la source.
 *
 * Ce sont ces valeurs-là qui s'affichent sur la fiche — jamais celles que le
 * créateur aurait saisies. Une dimension annoncée n'est pas une dimension.
 */
export interface Mesures {
  largeur: number;
  hauteur: number;
}

/** Un aperçu ne se tente que pour ce qui s'affiche déjà tel quel. */
export function apercuPossible(nomFichier: string, taille: number): boolean {
  return formatDe(nomFichier)?.apercu === "direct" && taille <= POIDS_MAX_APERCU;
}

/**
 * Produit l'aperçu public d'un média et renvoie son URL.
 *
 * `null` si le fichier ne s'y prête pas ou si l'image est illisible — un fichier
 * corrompu ne doit pas empêcher la ressource d'exister.
 */
export async function produireApercu(input: {
  mediaId: string;
  cleSource: string;
  nomFichier: string;
  taille: number;
  /** Le pseudo du créateur, écrit dans le filigrane. */
  pseudo: string | null;
}): Promise<Apercu | null> {
  if (!apercuPossible(input.nomFichier, input.taille)) return null;

  const source = await telechargerObjet(input.cleSource, POIDS_MAX_APERCU);
  if (!source) return null;

  try {
    const image = sharp(source, {
      // Un SVG est rastérisé à la densité demandée, pas à sa taille nominale.
      density: 200,
      // Une bombe de décompression ne doit pas emporter le serveur.
      limitInputPixels: 100_000_000,
    });

    const metadonnees = await image.metadata();

    const reduite = await image
      .rotate() // respecte l'orientation EXIF, sinon les photos sortent couchées
      .resize({
        width: LARGEUR_APERCU,
        // On ne grossit jamais une petite image : ce serait du flou en plus lourd.
        withoutEnlargement: true,
        fit: "inside",
      })
      // Sans perte à l'étape intermédiaire : la seule compression est la finale.
      .png()
      .toBuffer();

    const marquee = await filigraner(reduite, texteDuFiligrane(input.pseudo));
    const rendu = await sharp(marquee)
      .webp({ quality: QUALITE_APERCU })
      .toBuffer({ resolveWithObject: true });

    const cle = cleDApercu(input.mediaId);

    await deposerObjet({
      cle,
      corps: rendu.data,
      contentType: "image/webp",
    });

    return {
      cle,
      url: urlPublique(cle),
      // Les dimensions retenues sont celles de l'original, pas de la vignette :
      // c'est ce que l'acheteur reçoit qui l'intéresse.
      largeur: metadonnees.width ?? rendu.info.width,
      hauteur: metadonnees.height ?? rendu.info.height,
    };
  } catch (cause) {
    // Un fichier illisible n'empêche pas la ressource d'exister. Mais le
    // journal le dit : un filigrane qui échoue (police absente) ne doit pas
    // passer pour une image corrompue.
    journal.avertissement("aperçu non produit", {
      media: input.mediaId,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
    return null;
  }
}
