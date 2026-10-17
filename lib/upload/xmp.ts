/**
 * Graver des métadonnées XMP dans une image SANS la ré-encoder.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI PAS `sharp`
 *
 * `sharp(image).withXmp(x).toBuffer()` décode puis ré-encode l'image. Pour un
 * PNG c'est sans perte de pixels, mais pour un JPEG chaque ré-encodage requantifie
 * et dégrade — et ce fichier-ci est le produit VENDU. On ne recompresse pas ce
 * qu'un créateur vend pour y poser une mention. On insère donc la métadonnée
 * dans le conteneur, octets de pixels intacts :
 *
 *   — JPEG : un segment APP1 (`FF E1`) juste après le marqueur de début ;
 *   — PNG  : un bloc `iTXt` « XML:com.adobe.xmp » avant le bloc de fin.
 *
 * Les autres formats (WebP, TIFF, GIF, et tout ce qui n'est pas une image :
 * ZIP, PSD, police…) ne sont pas gravés : `injecterXmp` rend `null`, et
 * l'appelant livre le fichier tel quel. Mieux vaut un fichier intact sans
 * mention qu'un fichier abîmé — la copie de référence (`lib/upload/apercu.ts`)
 * porte la mention de son côté.
 *
 * Note : l'insertion AJOUTE un paquet XMP ; elle ne remplace pas celui qui
 * existerait déjà. L'appelant ne grave qu'une fois, au téléversement, sur le
 * fichier d'origine du créateur.
 */

const SIGNATURE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const EN_TETE_XMP_JPEG = Buffer.from("http://ns.adobe.com/xap/1.0/\0", "latin1");
const TAILLE_MAX_SEGMENT_JPEG = 0xffff; // longueur sur deux octets, elle-même comprise

/** Table CRC-32 (polynôme PNG/zlib), calculée une fois. */
const TABLE_CRC32 = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    c = TABLE_CRC32[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function estPng(image: Buffer): boolean {
  return image.length >= 8 && image.subarray(0, 8).equals(SIGNATURE_PNG);
}

function estJpeg(image: Buffer): boolean {
  return image.length >= 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
}

/**
 * Le bloc `iTXt` d'un paquet XMP, prêt à insérer dans un PNG.
 *
 * Structure iTXt : mot-clé\0 + drapeau de compression(0) + méthode(0) +
 * langue\0 + mot-clé traduit\0 + texte. Le mot-clé « XML:com.adobe.xmp » est
 * celui que les lecteurs attendent pour un paquet XMP.
 */
function blocITXtXmp(xmp: string): Buffer {
  const type = Buffer.from("iTXt", "latin1");
  const contenu = Buffer.concat([
    Buffer.from("XML:com.adobe.xmp\0", "latin1"),
    Buffer.from([0x00, 0x00]), // non compressé
    Buffer.from("\0\0", "latin1"), // langue vide, mot-clé traduit vide
    Buffer.from(xmp, "utf8"),
  ]);
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(contenu.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([type, contenu])), 0);
  return Buffer.concat([longueur, type, contenu, crc]);
}

/**
 * Insère le bloc iTXt juste après l'en-tête `IHDR`, donc avant les données
 * d'image. Les décodeurs (libvips/sharp) lisent les blocs de texte en parcourant
 * l'en-tête et s'arrêtent souvent à `IDAT` : un XMP placé après ne serait jamais
 * relu. Après `IHDR`, il l'est.
 */
function injecterPng(image: Buffer, xmp: string): Buffer {
  // Signature(8) puis le premier bloc, qui DOIT être IHDR.
  if (image.length < 33 || image.subarray(12, 16).toString("latin1") !== "IHDR") {
    return image; // PNG inattendu : on ne touche à rien.
  }
  const apresIhdr = 8 + 4 + 4 + image.readUInt32BE(8) + 4; // sig + long + type + données + CRC
  return Buffer.concat([image.subarray(0, apresIhdr), blocITXtXmp(xmp), image.subarray(apresIhdr)]);
}

/** Insère un segment APP1 XMP juste après le marqueur de début (`FF D8`). */
function injecterJpeg(image: Buffer, xmp: string): Buffer | null {
  const charge = Buffer.concat([EN_TETE_XMP_JPEG, Buffer.from(xmp, "utf8")]);
  const longueur = charge.length + 2; // la longueur se compte elle-même (2 octets)
  if (longueur > TAILLE_MAX_SEGMENT_JPEG) return null; // XMP trop long pour un seul segment.

  const segment = Buffer.alloc(4 + charge.length);
  segment[0] = 0xff;
  segment[1] = 0xe1; // APP1
  segment.writeUInt16BE(longueur, 2);
  charge.copy(segment, 4);

  return Buffer.concat([image.subarray(0, 2), segment, image.subarray(2)]);
}

/**
 * Grave `xmp` dans `image` sans la ré-encoder.
 *
 * Rend le nouveau tampon, ou `null` si le format ne se prête pas à une
 * insertion sans perte : l'appelant livre alors le fichier intact.
 */
export function injecterXmp(image: Buffer, xmp: string): Buffer | null {
  if (estPng(image)) return injecterPng(image, xmp);
  if (estJpeg(image)) return injecterJpeg(image, xmp);
  return null;
}

/** Le format se prête-t-il à une gravure sans perte ? (PNG, JPEG) */
export function gravureSansPertePossible(image: Buffer): boolean {
  return estPng(image) || estJpeg(image);
}
