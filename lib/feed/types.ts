/**
 * Formes partagées entre le serveur et le navigateur.
 *
 * Ce fichier n'importe RIEN qui touche à la base. C'est délibéré : le feed est
 * un composant client, et il lui faut la liste des filtres. S'il l'importait
 * depuis `queries.ts`, il entraînerait Prisma dans le bundle navigateur — le
 * build ne dit rien, et la page casse à l'exécution.
 */

import type { Currency, ProductFamily, ProductType } from "@/lib/domain/prisma-types";

/**
 * La barre de filtres, dans l'ordre exact des maquettes
 * (« Baobart Accueil.dc.html », constante `FILTERS`).
 */
export const FILTRES = [
  "Tous",
  "Illustration",
  "Photo",
  "Mockup",
  "Font",
  "Icône",
  "Logo",
  "Pack",
  "Art",
  "Audio",
  "Vidéo",
] as const;

export type Filtre = (typeof FILTRES)[number];

/** Libellé affiché → valeur stockée. « Tous » ne filtre rien. */
export const FAMILLE_PAR_LIBELLE: Record<Filtre, ProductFamily | null> = {
  Tous: null,
  Illustration: "ILLUSTRATION",
  Photo: "PHOTO",
  Mockup: "MOCKUP",
  Font: "FONT",
  Icône: "ICONE",
  Logo: "LOGO",
  Pack: "PACK",
  Art: "ART",
  Audio: "AUDIO",
  Vidéo: "VIDEO",
};

/** Valeur stockée → libellé affiché. Inverse de FAMILLE_PAR_LIBELLE. */
export const LIBELLE_PAR_FAMILLE = Object.fromEntries(
  Object.entries(FAMILLE_PAR_LIBELLE)
    .filter(([, famille]) => famille !== null)
    .map(([libelle, famille]) => [famille as ProductFamily, libelle as Filtre]),
) as Record<ProductFamily, Filtre>;

export interface CarteRessource {
  id: string;
  slug: string;
  title: string;
  author: string;
  authorUsername: string | null;
  type: ProductType;
  /** Libellé de famille affiché sur la carte à la une (« Photo », « Pack »…). */
  famille: Filtre | null;
  price: number;
  currency: Currency;
  coverUrl: string | null;
  /**
   * L'extrait public, quand la ressource en a un.
   *
   * Il sert d'aperçu **de repli** sur la carte : une vidéo sans couverture
   * montrait une trame rayée, alors qu'elle a de quoi se montrer. Rien n'est
   * chargé tant qu'on ne survole pas — voir `resource-card.tsx`.
   */
  extrait: { url: string; nature: "audio" | "video" } | null;
  /** Compteurs dénormalisés affichés sur la carte — jamais un COUNT() par carte. */
  downloadsCount: number;
  salesCount: number;
  /** Hauteur du visuel dans la mosaïque — variée pour éviter l'effet damier. */
  visualHeight: number;
  isStaffPicked: boolean;
  createdAt: Date;
}

export interface PageFeed {
  items: CarteRessource[];
  /** Curseur opaque à renvoyer pour la page suivante. `null` = fin du feed. */
  nextCursor: string | null;
}
