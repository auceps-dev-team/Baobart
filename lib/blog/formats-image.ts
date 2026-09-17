/**
 * Quelles images un article accepte, et comment on le vérifie.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * PAS DE SVG, ET C'EST LA DÉCISION DE CE FICHIER
 *
 * `lib/upload/formats.ts` accepte `image/svg+xml` — légitime pour une ressource
 * qu'on VEND : elle se télécharge, elle ne s'affiche pas sur notre domaine.
 *
 * Une image d'article s'affiche. Or un SVG est un document XML qui peut porter
 * un `<script>`, et servi depuis notre domaine il s'exécute avec nos droits,
 * cookies de session compris. Ce serait une faille de script inter-sites
 * **stockée** — la pire espèce : elle frappe tous les lecteurs, pas seulement
 * celui qu'on a piégé.
 *
 * Tout ce module a été construit pour empêcher l'HTML d'entrer par le texte.
 * L'accepter par une image serait ouvrir la porte de derrière.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE TYPE ANNONCÉ NE SUFFIT PAS
 *
 * `File.type` vient du navigateur et se falsifie en une ligne. On relit donc
 * les premiers octets — les « nombres magiques » —, comme le fait déjà la
 * vérification des CV en PDF (§22).
 *
 * Ce module est pur : des octets entrent, un format ou `null` sort. C'est ce
 * qui permet d'éprouver « un SVG déguisé en PNG est refusé » sans stockage.
 */

export interface FormatImage {
  mime: string;
  ext: string;
}

interface Signature extends FormatImage {
  /** Les premiers octets qui identifient le format. */
  entete: readonly number[];
  /**
   * Un second contrôle, quand l'entête ne suffit pas.
   *
   * WebP commence par « RIFF », comme les fichiers AVI et WAV. Sans ce
   * contrôle, une vidéo renommée passerait pour une image.
   */
  confirme?: (octets: Uint8Array) => boolean;
}

const SIGNATURES: readonly Signature[] = [
  { mime: "image/png", ext: "png", entete: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", ext: "jpg", entete: [0xff, 0xd8, 0xff] },
  { mime: "image/gif", ext: "gif", entete: [0x47, 0x49, 0x46, 0x38] },
  {
    mime: "image/webp",
    ext: "webp",
    entete: [0x52, 0x49, 0x46, 0x46],
    confirme: (o) => lire(o, 8, 12) === "WEBP",
  },
];

/** Deux mégaoctets. Une illustration d'article n'a pas à être plus lourde. */
export const TAILLE_MAX = 2 * 1024 * 1024;

export const FORMATS_ACCEPTES = SIGNATURES.map((s) => s.mime);

/**
 * Le format réel, lu dans les octets. `null` quand rien ne correspond.
 *
 * Un SVG rend `null` sans qu'on ait à le chercher : il commence par `<?xml` ou
 * `<svg`, et aucune signature d'ici ne lui ressemble. C'est mieux qu'une liste
 * de refus — une liste d'acceptation ne se contourne pas en inventant un
 * format de plus.
 */
export function reconnaitre(octets: Uint8Array): FormatImage | null {
  for (const s of SIGNATURES) {
    if (octets.length < s.entete.length) continue;
    if (!s.entete.every((o, i) => octets[i] === o)) continue;
    if (s.confirme && !s.confirme(octets)) continue;

    return { mime: s.mime, ext: s.ext };
  }

  return null;
}

function lire(octets: Uint8Array, debut: number, fin: number): string {
  return Array.from(octets.subarray(debut, fin))
    .map((o) => String.fromCharCode(o))
    .join("");
}
