/**
 * Formats acceptés à l'envoi.
 *
 * La maquette annonce « PNG, JPG, AI, PSD, SVG, TTF, MP4, ZIP — 200 Mo max ».
 * On élargit à la liste du PLAN §13, qui décrit ce que la bibliothèque devra
 * savoir livrer, mais la promesse affichée reste celle de la maquette.
 *
 * Module pur : aucune dépendance au stockage ni à la base. C'est lui qui décide
 * ce qui entre, et il doit pouvoir être relu d'un coup d'œil.
 */

/** Ce qu'on sait faire d'un fichier, pas seulement ce qu'il est. */
export type Apercu =
  /** Le fichier est sa propre vignette : on peut l'afficher tel quel. */
  | "direct"
  /** Un aperçu est possible, mais demande un traitement qui n'existe pas encore. */
  | "a-produire"
  /** Rien à montrer : on affichera la trame du design system. */
  | "aucun";

export interface Format {
  extension: string;
  /** Type MIME attendu. Vérifié, jamais cru sur parole. */
  mime: string;
  famille: "image" | "vecteur" | "source" | "police" | "video" | "audio" | "3d" | "document" | "archive";
  apercu: Apercu;
}

/** 200 Mo, comme l'annonce la maquette. */
export const TAILLE_MAX = 200 * 1024 * 1024;

/** Un nom de fichier au-delà devient ingérable dans une URL et un en-tête. */
export const NOM_MAX = 180;

export const FORMATS: Format[] = [
  // Images : le fichier est son propre aperçu.
  { extension: "png", mime: "image/png", famille: "image", apercu: "direct" },
  { extension: "jpg", mime: "image/jpeg", famille: "image", apercu: "direct" },
  { extension: "jpeg", mime: "image/jpeg", famille: "image", apercu: "direct" },
  { extension: "webp", mime: "image/webp", famille: "image", apercu: "direct" },
  { extension: "gif", mime: "image/gif", famille: "image", apercu: "direct" },
  { extension: "svg", mime: "image/svg+xml", famille: "vecteur", apercu: "direct" },

  // Les grands formats d'image ne s'affichent pas dans un navigateur : ils
  // demandent une conversion.
  { extension: "tif", mime: "image/tiff", famille: "image", apercu: "a-produire" },
  { extension: "tiff", mime: "image/tiff", famille: "image", apercu: "a-produire" },

  // Fichiers de travail : aperçu possible, mais il faut les ouvrir pour ça.
  { extension: "ai", mime: "application/postscript", famille: "source", apercu: "a-produire" },
  { extension: "eps", mime: "application/postscript", famille: "source", apercu: "a-produire" },
  { extension: "psd", mime: "image/vnd.adobe.photoshop", famille: "source", apercu: "a-produire" },
  { extension: "pdf", mime: "application/pdf", famille: "document", apercu: "a-produire" },

  // Polices : l'aperçu est un spécimen à composer.
  { extension: "ttf", mime: "font/ttf", famille: "police", apercu: "a-produire" },
  { extension: "otf", mime: "font/otf", famille: "police", apercu: "a-produire" },
  { extension: "woff", mime: "font/woff", famille: "police", apercu: "a-produire" },
  { extension: "woff2", mime: "font/woff2", famille: "police", apercu: "a-produire" },

  // Vidéo et audio : un extrait, à découper.
  { extension: "mp4", mime: "video/mp4", famille: "video", apercu: "a-produire" },
  { extension: "webm", mime: "video/webm", famille: "video", apercu: "a-produire" },
  { extension: "mov", mime: "video/quicktime", famille: "video", apercu: "a-produire" },
  { extension: "mp3", mime: "audio/mpeg", famille: "audio", apercu: "a-produire" },
  { extension: "wav", mime: "audio/wav", famille: "audio", apercu: "a-produire" },

  // 3D : un visualiseur, pas une image.
  { extension: "glb", mime: "model/gltf-binary", famille: "3d", apercu: "a-produire" },
  { extension: "gltf", mime: "model/gltf+json", famille: "3d", apercu: "a-produire" },

  // Archive : on ne sait rien de son contenu avant de l'ouvrir.
  { extension: "zip", mime: "application/zip", famille: "archive", apercu: "aucun" },
];

/** Extensions annoncées à la personne, dans l'ordre de la maquette. */
export const EXTENSIONS_ANNONCEES = [
  "PNG",
  "JPG",
  "AI",
  "PSD",
  "SVG",
  "TTF",
  "MP4",
  "ZIP",
] as const;

export function extensionDe(nomFichier: string): string {
  const point = nomFichier.lastIndexOf(".");
  if (point <= 0 || point === nomFichier.length - 1) return "";
  return nomFichier.slice(point + 1).toLowerCase();
}

export function formatDe(nomFichier: string): Format | null {
  const extension = extensionDe(nomFichier);
  return FORMATS.find((f) => f.extension === extension) ?? null;
}

export type RefusEnvoi =
  | "NOM_VIDE"
  | "NOM_TROP_LONG"
  | "EXTENSION_INCONNUE"
  | "TYPE_INCOHERENT"
  | "TROP_LOURD"
  | "TAILLE_INVALIDE";

export interface VerdictEnvoi {
  accepte: boolean;
  refus?: RefusEnvoi;
  message?: string;
  format?: Format;
}

const MESSAGES: Record<RefusEnvoi, string> = {
  NOM_VIDE: "Ce fichier n'a pas de nom.",
  NOM_TROP_LONG: `Le nom du fichier dépasse ${NOM_MAX} caractères.`,
  EXTENSION_INCONNUE: `Format non accepté. Formats acceptés : ${EXTENSIONS_ANNONCEES.join(", ")}.`,
  TYPE_INCOHERENT:
    "Le type du fichier ne correspond pas à son extension. Renomme-le avec la bonne extension.",
  TROP_LOURD: "Le fichier dépasse 200 Mo.",
  TAILLE_INVALIDE: "La taille de ce fichier est illisible.",
};

/**
 * Décide si un fichier peut être envoyé.
 *
 * Le type MIME déclaré est **vérifié contre l'extension**, pas simplement
 * enregistré : un `.png` annoncé `application/zip` est refusé. Sans ce contrôle,
 * un fichier pourrait être servi plus tard avec un type qui n'est pas le sien.
 */
export function verifierEnvoi(input: {
  nom: string;
  taille: number;
  mimeDeclare?: string;
}): VerdictEnvoi {
  const nom = input.nom.trim();

  if (nom.length === 0) {
    return { accepte: false, refus: "NOM_VIDE", message: MESSAGES.NOM_VIDE };
  }
  if (nom.length > NOM_MAX) {
    return {
      accepte: false,
      refus: "NOM_TROP_LONG",
      message: MESSAGES.NOM_TROP_LONG,
    };
  }

  const format = formatDe(nom);
  if (!format) {
    return {
      accepte: false,
      refus: "EXTENSION_INCONNUE",
      message: MESSAGES.EXTENSION_INCONNUE,
    };
  }

  if (!Number.isFinite(input.taille) || input.taille <= 0) {
    return {
      accepte: false,
      refus: "TAILLE_INVALIDE",
      message: MESSAGES.TAILLE_INVALIDE,
    };
  }
  if (input.taille > TAILLE_MAX) {
    return { accepte: false, refus: "TROP_LOURD", message: MESSAGES.TROP_LOURD };
  }

  // Les navigateurs laissent parfois le type vide : on ne refuse que ce qui
  // est déclaré ET contredit l'extension.
  const declare = (input.mimeDeclare ?? "").trim().toLowerCase();
  if (declare.length > 0 && declare !== format.mime) {
    const memeFamille = declare.split("/")[0] === format.mime.split("/")[0];
    if (!memeFamille) {
      return {
        accepte: false,
        refus: "TYPE_INCOHERENT",
        message: MESSAGES.TYPE_INCOHERENT,
      };
    }
  }

  return { accepte: true, format };
}

/**
 * Poids lisible : « 84 Mo », comme l'annonce la maquette.
 *
 * Base 1024 — c'est ce que le système d'exploitation montrera à l'acheteur
 * après téléchargement, et deux chiffres différents pour le même fichier
 * passeraient pour une erreur.
 */
export function formatPoids(octets: number): string {
  if (!Number.isFinite(octets) || octets < 0) return "—";
  if (octets < 1024) return `${Math.round(octets)} o`;

  const unites = ["Ko", "Mo", "Go"] as const;
  let valeur = octets / 1024;
  let rang = 0;

  while (valeur >= 1024 && rang < unites.length - 1) {
    valeur /= 1024;
    rang += 1;
  }

  // Une décimale en dessous de dix, aucune au-delà : « 8,4 Mo » puis « 84 Mo ».
  const arrondi = valeur < 10 ? Math.round(valeur * 10) / 10 : Math.round(valeur);
  return `${arrondi.toString().replace(".", ",")} ${unites[rang]}`;
}

/** Nom de fichier assaini pour une clé de stockage. */
export function nomSur(nomFichier: string): string {
  const extension = extensionDe(nomFichier);
  const base = nomFichier
    .slice(0, nomFichier.length - (extension.length ? extension.length + 1 : 0))
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);

  const racine = base.length > 0 ? base : "fichier";
  return extension.length > 0 ? `${racine}.${extension}` : racine;
}
