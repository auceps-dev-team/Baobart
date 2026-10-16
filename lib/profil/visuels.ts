/**
 * La photo de profil et la bannière : ce qu'on accepte, ce qu'on en fait.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * PERSONNE NE POUVAIT LES REMPLIR
 *
 * `Profile.avatarUrl` et `Profile.bannerUrl` existent depuis le début, et la
 * vitrine les affiche. Relu le 16/10 : aucun code n'écrivait l'un ni l'autre —
 * recherché dans `lib`, `app`, `components`, `prisma` et `scripts`. Chaque
 * vitrine montrait donc les rayures de la maquette, faute de mieux.
 *
 * La maquette du tableau de bord (`c_profil`, bloc « Vitrine », `hasAvatar`)
 * dessine l'envoi de la photo : « Photo de profil — PNG ou JPG · 400×400
 * min », bouton « Téléverser ». Elle ne dessine pas celui de la bannière : il
 * reprend la même forme.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON NE PUBLIE JAMAIS L'ORIGINAL
 *
 * Une photo de téléphone porte souvent l'endroit où elle a été prise (EXIF,
 * GPS). L'original part dans le stockage privé, le serveur en tire une copie
 * réduite en WebP — sans métadonnées, ce que sharp fait par défaut — et c'est
 * elle seule qui devient publique. L'original est ensuite supprimé.
 *
 * Ce module est pur : il décide des formes. Le stockage vit dans
 * `lib/profil/visuels-service.ts`.
 */

export type Visuel = "avatar" | "banniere";

export const VISUELS: readonly Visuel[] = ["avatar", "banniere"];

interface Regle {
  titre: string;
  /** Ce que la maquette écrit sous le titre. */
  consigne: string;
  largeurMin: number;
  hauteurMin: number;
  /** La copie publiée. */
  sortie: { largeur: number; hauteur: number; ajustement: "cover" | "inside" };
}

export const REGLES: Record<Visuel, Regle> = {
  avatar: {
    titre: "Photo de profil",
    consigne: "PNG ou JPG · 400×400 min",
    largeurMin: 400,
    hauteurMin: 400,
    // Un carré : la vitrine l'affiche en rond de 104 px, la fiche en 34.
    sortie: { largeur: 400, hauteur: 400, ajustement: "cover" },
  },
  banniere: {
    titre: "Bannière",
    consigne: "PNG ou JPG · 1600×400 min",
    largeurMin: 1600,
    hauteurMin: 400,
    // Proportions gardées : la vitrine la recadre elle-même (`cover`), sur
    // une hauteur de 150 px et toute la largeur de la carte.
    sortie: { largeur: 2400, hauteur: 800, ajustement: "inside" },
  },
};

/** Dix mégaoctets : bien au-delà d'une photo de téléphone. */
export const POIDS_MAX = 10 * 1024 * 1024;

/** Une bombe de décompression ne doit pas emporter le serveur. */
export const PIXELS_MAX = 50_000_000;

const FORMATS: Record<string, string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
};

export type Decision = { ok: true } | { ok: false; message: string };

/** Ce que le navigateur annonce — puis, à la confirmation, ce que le stockage relit. */
export function verifierAnnonce(
  visuel: Visuel,
  fichier: { nom: string; taille: number; mime: string },
): Decision {
  const regle = REGLES[visuel];
  const extensions = FORMATS[fichier.mime.toLowerCase()];
  const nom = fichier.nom.toLowerCase();
  if (!extensions || !extensions.some((e) => nom.endsWith(e))) {
    return { ok: false, message: `${regle.titre} : PNG ou JPG seulement.` };
  }
  if (fichier.taille <= 0) return { ok: false, message: "Ce fichier est vide." };
  if (fichier.taille > POIDS_MAX) {
    return { ok: false, message: `${regle.titre} : 10 Mo au maximum.` };
  }
  return { ok: true };
}

/** Les dimensions lues dans l'image elle-même, orientation appliquée. */
export function verifierDimensions(visuel: Visuel, largeur: number, hauteur: number): Decision {
  const regle = REGLES[visuel];
  if (largeur < regle.largeurMin || hauteur < regle.hauteurMin) {
    return {
      ok: false,
      message: `${regle.titre} : ${regle.largeurMin}×${regle.hauteurMin} au minimum — celle-ci fait ${largeur}×${hauteur}.`,
    };
  }
  return { ok: true };
}

/**
 * Largeur et hauteur telles qu'on les voit. Les orientations EXIF 5 à 8
 * couchent l'image : une photo prise en portrait arrive en 4000×3000 avec
 * l'ordre de la tourner.
 */
export function dimensionsVues(largeur: number, hauteur: number, orientation?: number): [number, number] {
  return orientation && orientation >= 5 ? [hauteur, largeur] : [largeur, hauteur];
}

/** Où dort l'original, le temps de le traiter. Privé. */
export function cleDOriginal(userId: string, id: string): string {
  return `profils/${userId}/${id}`;
}

/** La copie publiée. L'identifiant change à chaque envoi : le cache est éternel. */
export function cleDeVisuel(userId: string, visuel: Visuel, id: string): string {
  return `public/profils/${userId}/${visuel}-${id}.webp`;
}

/**
 * La clé d'une copie publiée, retrouvée depuis son adresse — `null` si
 * l'adresse n'est pas une des nôtres pour ce compte. Une adresse rangée
 * autrement (import, données de démonstration) ne se supprime jamais.
 */
export function cleDepuisAdresse(adresse: string | null, userId: string): string | null {
  if (!adresse) return null;
  const debut = adresse.indexOf(`public/profils/${userId}/`);
  if (debut < 0) return null;
  const cle = adresse.slice(debut);
  const motif = new RegExp(`^public/profils/${echapper(userId)}/(avatar|banniere)-[a-z0-9-]+\\.webp$`);
  return motif.test(cle) ? cle : null;
}

function echapper(valeur: string): string {
  return valeur.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
