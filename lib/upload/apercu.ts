import "server-only";

import sharp from "sharp";

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

/** Largeur maximale d'un aperçu : au-delà, le feed ne gagne plus rien. */
const LARGEUR_APERCU = 1400;

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

    const rendu = await image
      .rotate() // respecte l'orientation EXIF, sinon les photos sortent couchées
      .resize({
        width: LARGEUR_APERCU,
        // On ne grossit jamais une petite image : ce serait du flou en plus lourd.
        withoutEnlargement: true,
        fit: "inside",
      })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });

    const cle = `${PREFIXE_PUBLIC}apercus/${input.mediaId}.webp`;

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
  } catch {
    return null;
  }
}
