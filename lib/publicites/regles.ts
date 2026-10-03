/**
 * Ce qu'une publicité doit être pour paraître, et ce qu'on en dit.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE LIEN : NOTRE SITE OU HTTPS, RIEN D'AUTRE
 *
 * La bannière est un lien que des milliers de visiteurs vont suivre en nous
 * faisant confiance. `javascript:` exécuterait du code avec nos droits ;
 * `http://` enverrait vers une page que n'importe quel réseau peut réécrire ;
 * `//ailleurs` ressemble à un chemin interne et n'en est pas un.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES MÉDIAS : SEULEMENT CE QUI A ÉTÉ DÉPOSÉ ICI
 *
 * L'image et la vidéo doivent venir de notre stockage, sous `pubs/`. Une
 * adresse extérieure ferait charger un fichier tiers par chaque visiteur de la
 * mosaïque — un pixel de suivi déguisé en bannière —, et ce fichier pourrait
 * changer après qu'on l'a relu.
 *
 * Pur : la règle se teste sans base ni stockage.
 */

export type NatureMedia = "IMAGE" | "VIDEO";

/** Ce qui arrive du formulaire, tel quel. */
export interface SaisiePub {
  titre: string;
  lien: string;
  nature: string;
  imageUrl: string;
  imageLargeur: string;
  imageHauteur: string;
  videoUrl: string;
  frequence: string;
  debut: string;
  fin: string;
}

export type ChampPub = keyof SaisiePub;

export interface PubValide {
  title: string;
  linkUrl: string;
  mediaKind: NatureMedia;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  videoUrl: string | null;
  frequency: number;
  startsAt: Date | null;
  endsAt: Date | null;
}

export type VerdictPub =
  | { ok: true; pub: PubValide }
  | { ok: false; champ: ChampPub; message: string };

/**
 * La fréquence la plus serrée : une bannière tous les trois produits. C'est le
 * minimum du widget Mayosis (`ad_frequency_min: 3`) ; en dessous, la mosaïque
 * devient un panneau publicitaire avec quelques produits dedans.
 */
export const FREQUENCE_MIN = 3;
export const FREQUENCE_MAX = 100;
/** Le plugin proposait dix par défaut. */
export const FREQUENCE_PAR_DEFAUT = 10;

export const ECART_MIN = 1;
export const ECART_MAX = 50;
/** Le défaut du schéma (`AdSettings.minGap`) : une rangée de quatre, au moins. */
export const ECART_PAR_DEFAUT = 4;

const TITRE_MAX = 80;
const LIEN_MAX = 500;
const COTE_MAX = 20_000;

export function validerPublicite(saisie: SaisiePub, racineMedias: string): VerdictPub {
  const refus = (champ: ChampPub, message: string): VerdictPub => ({ ok: false, champ, message });

  const titre = saisie.titre.trim();
  if (titre.length < 2 || titre.length > TITRE_MAX) {
    return refus("titre", `Donne un nom à la publicité, ${TITRE_MAX} caractères au plus. Il sert aussi de texte de remplacement à l'image.`);
  }

  const lien = saisie.lien.trim();
  if (!lienAcceptable(lien)) {
    return refus("lien", "Le lien doit être une page de Baobart (« /products/… ») ou une adresse en https://.");
  }

  const nature: NatureMedia | null =
    saisie.nature === "IMAGE" || saisie.nature === "VIDEO" ? saisie.nature : null;
  if (!nature) return refus("nature", "Choisis une image ou une vidéo.");

  const imageUrl = saisie.imageUrl.trim();
  if (!imageUrl.startsWith(racineMedias)) {
    return refus(
      "imageUrl",
      nature === "VIDEO"
        ? "Envoie l'image qui s'affiche avant que la vidéo ne démarre."
        : "Envoie l'image de la bannière.",
    );
  }

  const largeur = entier(saisie.imageLargeur);
  const hauteur = entier(saisie.imageHauteur);
  if (largeur === null || hauteur === null || largeur < 1 || hauteur < 1 || largeur > COTE_MAX || hauteur > COTE_MAX) {
    return refus("imageUrl", "Les dimensions de l'image ne se lisent pas. Renvoie-la.");
  }

  const videoUrl = saisie.videoUrl.trim();
  if (nature === "VIDEO" && !videoUrl.startsWith(racineMedias)) {
    return refus("videoUrl", "Envoie la vidéo, en MP4 ou WebM.");
  }

  const frequence = entier(saisie.frequence);
  if (frequence === null || frequence < FREQUENCE_MIN || frequence > FREQUENCE_MAX) {
    return refus("frequence", `La fréquence va d'une bannière tous les ${FREQUENCE_MIN} produits à une tous les ${FREQUENCE_MAX}.`);
  }

  const debut = lireDate(saisie.debut);
  const fin = lireDate(saisie.fin);
  if (debut === "illisible") return refus("debut", "Cette date de début ne se lit pas.");
  if (fin === "illisible") return refus("fin", "Cette date de fin ne se lit pas.");
  if (debut && fin && fin <= debut) {
    return refus("fin", "La fin doit venir après le début.");
  }

  return {
    ok: true,
    pub: {
      title: titre,
      linkUrl: lien,
      mediaKind: nature,
      imageUrl,
      imageWidth: largeur,
      imageHeight: hauteur,
      // Une vidéo abandonnée en repassant à l'image ne reste pas rangée : elle
      // reparaîtrait le jour où quelqu'un rebasculerait sans la revoir.
      videoUrl: nature === "VIDEO" ? videoUrl : null,
      frequency: frequence,
      startsAt: debut,
      endsAt: fin,
    },
  };
}

export function lienAcceptable(lien: string): boolean {
  if (lien.length === 0 || lien.length > LIEN_MAX) return false;
  // Un chemin de chez nous — mais pas « //ailleurs.com », que le navigateur
  // lit comme une adresse extérieure, ni « /\ailleurs.com », qu'il corrige en
  // « // ».
  if (lien.startsWith("/")) return !/^\/[/\\]/.test(lien) && !/\s/.test(lien);
  try {
    const url = new URL(lien);
    return url.protocol === "https:" && url.hostname.length > 0 && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Le lien mène-t-il hors de Baobart ? Il s'ouvre alors dans un nouvel onglet. */
export function lienExterieur(lien: string): boolean {
  return !lien.startsWith("/");
}

/** L'écart minimal entre deux bannières, borné. `null` s'il ne se lit pas. */
export function validerEcart(brut: string): number | null {
  const n = entier(brut);
  return n !== null && n >= ECART_MIN && n <= ECART_MAX ? n : null;
}

export type EtatPub = "ACTIVE" | "PROGRAMMEE" | "EN_PAUSE" | "TERMINEE" | "ARCHIVEE";

export const LIBELLE_ETAT_PUB: Record<EtatPub, string> = {
  ACTIVE: "En diffusion",
  PROGRAMMEE: "Programmée",
  EN_PAUSE: "En pause",
  TERMINEE: "Terminée",
  ARCHIVEE: "Archivée",
};

/**
 * Où en est une publicité.
 *
 * « Archivée » passe avant tout : elle a quitté la mosaïque, quelles que soient
 * ses dates. « Terminée » passe avant « en pause » : une campagne finie ne
 * reprendra pas, et l'afficher « en pause » inviterait à cliquer « reprendre »
 * pour rien.
 */
export function etatDeLaPublicite(
  pub: { pausedAt: Date | null; startsAt: Date | null; endsAt: Date | null; archivedAt?: Date | null },
  maintenant: Date,
): EtatPub {
  if (pub.archivedAt) return "ARCHIVEE";
  if (pub.endsAt && pub.endsAt <= maintenant) return "TERMINEE";
  if (pub.pausedAt) return "EN_PAUSE";
  if (pub.startsAt && pub.startsAt > maintenant) return "PROGRAMMEE";
  return "ACTIVE";
}

/** Le taux de clic, en pour cent. `null` sans affichage : 0 % mentirait. */
export function tauxDeClic(vues: number, clics: number): number | null {
  if (!(vues > 0)) return null;
  return Math.round((clics / vues) * 1000) / 10;
}

function entier(brut: string): number | null {
  const t = brut.trim();
  return /^\d{1,6}$/.test(t) ? Number(t) : null;
}

/**
 * Lue en GMT, comme les dates du blog : sans fuseau, Node lirait l'heure du
 * serveur. Abidjan est en GMT, toute l'année.
 */
function lireDate(brut: string): Date | null | "illisible" {
  const t = brut.trim();
  if (t.length === 0) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t)) return "illisible";
  const quand = new Date(`${t}:00Z`);
  return Number.isNaN(quand.getTime()) ? "illisible" : quand;
}
