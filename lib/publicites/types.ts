/**
 * Ce que la mosaïque reçoit d'une publicité — et rien de plus.
 *
 * Ni le créateur de la campagne, ni ses dates, ni ses chiffres : la page part
 * chez chaque visiteur, et ce qui n'y sert pas n'a pas à y voyager.
 */
export interface PubCarte {
  id: string;
  /** Le texte de remplacement de l'image. */
  titre: string;
  nature: "IMAGE" | "VIDEO";
  imageUrl: string;
  largeur: number;
  hauteur: number;
  videoUrl: string | null;
  /** Vrai quand le lien sort de Baobart : nouvel onglet. */
  exterieure: boolean;
  frequence: number;
}

/** Les publicités d'une page, avec la règle qui les espace. */
export interface Diffusion {
  pubs: PubCarte[];
  ecartMinimal: number;
}

export const AUCUNE_DIFFUSION: Diffusion = { pubs: [], ecartMinimal: 1 };

/** Le cookie qui retient les derniers clics, pour attribuer une vente. */
export const COOKIE_CLICS = "bb_pub";
/** Trente jours, comme le plugin. */
export const DUREE_ATTRIBUTION_S = 30 * 24 * 60 * 60;
/** Les cinq dernières bannières cliquées — voir `attribuer`. */
export const CLICS_RETENUS = 5;
