/**
 * Ce qu'une bannière accepte comme média, et ses dimensions.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES IMAGES : LA RÈGLE DU BLOG, SANS EN ÉCRIRE UNE SECONDE
 *
 * Une bannière s'affiche sur notre domaine, comme une image d'article : même
 * risque, même règle. On reprend donc `reconnaitre` de
 * `lib/blog/formats-image.ts` — quatre formats matriciels lus à leurs premiers
 * octets, et pas de SVG, qui peut porter un `<script>`.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES VIDÉOS : DES FICHIERS, PAS DES LIENS YOUTUBE
 *
 * Le plugin acceptait une adresse YouTube ou Vimeo, rendue dans une `<iframe>`.
 * Pas ici, et c'est délibéré : une iframe YouTube dépose ses propres cookies
 * chez chaque visiteur de la mosaïque, qu'il ait cliqué ou non, et Baobart
 * deviendrait l'endroit où Google suit ses visiteurs. Une vidéo MP4 ou WebM
 * déposée sur notre stockage se lit sans tiers.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI LIRE LES DIMENSIONS
 *
 * La mosaïque répartit les cartes AVANT de les afficher (`lib/feed/masonry.ts`)
 * : il lui faut la hauteur d'une bannière sans attendre que l'image arrive.
 * Les dimensions sont donc lues une fois, au dépôt, et rangées avec la pub.
 *
 * Ce qui n'est pas lu : l'orientation EXIF d'une photo de téléphone. Une photo
 * portrait enregistrée « couchée » donnera des dimensions inversées. Ça ne
 * casse rien — la bannière s'affiche à sa vraie taille (`height: auto`), seule
 * l'estimation de la colonne est fausse —, mais la colonne sera mal équilibrée.
 *
 * Pur : des octets entrent, un format sort.
 */

import { reconnaitre, type FormatImage } from "@/lib/blog/formats-image";

export type FormatMedia =
  | ({ nature: "IMAGE" } & FormatImage)
  | ({ nature: "VIDEO" } & FormatImage);

/** Cinq mégaoctets : une bannière est une image d'écran, pas une affiche. */
export const TAILLE_MAX_IMAGE = 5 * 1024 * 1024;
/** Vingt mégaoctets : une quinzaine de secondes en 720p. */
export const TAILLE_MAX_VIDEO = 20 * 1024 * 1024;

export function reconnaitreMedia(octets: Uint8Array): FormatMedia | null {
  const image = reconnaitre(octets);
  if (image) return { nature: "IMAGE", ...image };

  // MP4 : une boîte « ftyp » en tête, sa taille sur les quatre premiers octets.
  // La marque « qt » est celle de QuickTime : Chrome n'en lit qu'une partie, et
  // une bannière qui ne joue que sur un navigateur sur deux est une bannière
  // cassée.
  if (texte(octets, 4, 8) === "ftyp" && texte(octets, 8, 12) !== "qt  ") {
    return { nature: "VIDEO", mime: "video/mp4", ext: "mp4" };
  }

  // WebM : l'entête EBML de Matroska.
  if (octets[0] === 0x1a && octets[1] === 0x45 && octets[2] === 0xdf && octets[3] === 0xa3) {
    return { nature: "VIDEO", mime: "video/webm", ext: "webm" };
  }

  return null;
}

export interface Dimensions {
  largeur: number;
  hauteur: number;
}

/** Largeur et hauteur en pixels, lues dans l'entête. `null` si illisibles. */
export function dimensionsImage(octets: Uint8Array): Dimensions | null {
  const format = reconnaitre(octets);
  if (!format) return null;

  const d = (() => {
    switch (format.mime) {
      case "image/png":
        // L'entête IHDR suit la signature : largeur puis hauteur, 32 bits.
        return { largeur: u32be(octets, 16), hauteur: u32be(octets, 20) };
      case "image/gif":
        return { largeur: u16le(octets, 6), hauteur: u16le(octets, 8) };
      case "image/jpeg":
        return dimensionsJpeg(octets);
      case "image/webp":
        return dimensionsWebp(octets);
      default:
        return null;
    }
  })();

  if (!d || !(d.largeur > 0) || !(d.hauteur > 0)) return null;
  return d;
}

/**
 * JPEG : les dimensions sont dans le segment « début de trame » (SOF), qui
 * vient après un nombre variable d'autres segments (EXIF, tables…). On saute
 * de segment en segment grâce à la longueur que chacun annonce.
 */
function dimensionsJpeg(o: Uint8Array): Dimensions | null {
  let i = 2;
  while (i + 9 < o.length) {
    if (o[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marqueur = o[i + 1]!;
    // Les marqueurs sans longueur : bourrage, début d'image, redémarrages.
    if (marqueur === 0xff) {
      i += 1;
      continue;
    }
    if (marqueur === 0xd8 || marqueur === 0x01 || (marqueur >= 0xd0 && marqueur <= 0xd7)) {
      i += 2;
      continue;
    }
    const estTrame =
      marqueur >= 0xc0 && marqueur <= 0xcf &&
      marqueur !== 0xc4 && marqueur !== 0xc8 && marqueur !== 0xcc;
    if (estTrame) {
      return { hauteur: u16be(o, i + 5), largeur: u16be(o, i + 7) };
    }
    const longueur = u16be(o, i + 2);
    if (longueur < 2) return null;
    i += 2 + longueur;
  }
  return null;
}

/** WebP : trois variantes, chacune range ses dimensions à sa façon. */
function dimensionsWebp(o: Uint8Array): Dimensions | null {
  const morceau = texte(o, 12, 16);
  if (morceau === "VP8X") {
    return { largeur: 1 + u24le(o, 24), hauteur: 1 + u24le(o, 27) };
  }
  if (morceau === "VP8L") {
    const [b0, b1, b2, b3] = [o[21]!, o[22]!, o[23]!, o[24]!];
    return {
      largeur: 1 + (((b1 & 0x3f) << 8) | b0),
      hauteur: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    };
  }
  if (morceau === "VP8 ") {
    return { largeur: u16le(o, 26) & 0x3fff, hauteur: u16le(o, 28) & 0x3fff };
  }
  return null;
}

function texte(o: Uint8Array, debut: number, fin: number): string {
  return String.fromCharCode(...o.slice(debut, fin));
}
function u16be(o: Uint8Array, i: number): number {
  return ((o[i] ?? 0) << 8) | (o[i + 1] ?? 0);
}
function u16le(o: Uint8Array, i: number): number {
  return (o[i] ?? 0) | ((o[i + 1] ?? 0) << 8);
}
function u24le(o: Uint8Array, i: number): number {
  return (o[i] ?? 0) | ((o[i + 1] ?? 0) << 8) | ((o[i + 2] ?? 0) << 16);
}
function u32be(o: Uint8Array, i: number): number {
  return (((o[i] ?? 0) << 24) >>> 0) + (((o[i + 1] ?? 0) << 16) | ((o[i + 2] ?? 0) << 8) | (o[i + 3] ?? 0));
}
