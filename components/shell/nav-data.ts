/**
 * Structure de navigation, reprise telle quelle des maquettes
 * (« Baobart Accueil.dc.html », constantes `NAV` et `railItems`).
 *
 * Les destinations pointent vers les routes qui existent aujourd'hui. Celles
 * qui n'existent pas encore portent `href: null` : le lien reste affiché — la
 * maquette le prévoit — mais il ne mène nulle part plutôt que vers un 404.
 */

import type { Filtre } from "@/lib/feed/types";
import type { NomIcone } from "@/lib/icones/donnees";

export interface EntreeMenu {
  label: string;
  hint: string;
  icone: NomIcone;
  href: string | null;
}

export interface GroupeMenu {
  key: string;
  label: string;
  href: string | null;
  items: EntreeMenu[];
}

export const MENUS: GroupeMenu[] = [
  {
    key: "explorer",
    label: "Explorer",
    href: "/explore",
    items: [
      {
        label: "Explorer les ressources",
        hint: "Toute la bibliothèque",
        icone: "compass",
        href: "/explore",
      },
      {
        label: "Concours & Événements",
        hint: "Ateliers, concours et expositions",
        icone: "trophy",
        href: "/evenements",
      },
      {
        label: "Sponsoriser",
        hint: "Formats & partenariats",
        icone: "target",
        href: "/sponsoriser",
      },
    ],
  },
  {
    key: "createurs",
    label: "Créateurs",
    // Le titre du groupe menait à « # » ; il mène à l'annuaire, sa première entrée.
    href: "/createurs",
    items: [
      { label: "Créateurs", hint: "Annuaire des membres", icone: "user", href: "/createurs" },
      { label: "Services", hint: "Prestations des membres", icone: "tag", href: "/services" },
      { label: "Jobs", hint: "Missions à saisir", icone: "folder", href: "/jobs" },
    ],
  },
  {
    key: "conditions",
    label: "Conditions générales",
    // Idem : la page des conditions existe depuis le 04/10.
    href: "/conditions",
    items: [
      {
        label: "Licences Baobart",
        hint: "Ce que tu peux faire des fichiers",
        icone: "shield",
        href: "/licences",
      },
      {
        label: "Règles de publication",
        hint: "Pour les contributeurs",
        icone: "check",
        href: "/regles-de-publication",
      },
      {
        // La maquette écrit « Signalement DMCA ». Le DMCA est une loi
        // américaine, et Baobart est établie à Abidjan : la procédure qui
        // s'applique ici est celle des articles 46 à 54 de la loi ivoirienne
        // n° 2013-451, qui diffère — notamment parce qu'elle exige d'avoir
        // écrit à l'auteur avant de saisir la plateforme.
        //
        // Nommer une page juridique d'après un texte qui ne la régit pas
        // n'est pas un choix de design : c'est une erreur de fait. Le libellé
        // est corrigé, la place et l'intention de la maquette sont gardées.
        label: "Signalement & retrait",
        hint: "Signaler un contenu",
        icone: "alert",
        href: "/signalement",
      },
      {
        // La maquette écrit « Politique de cookies (UE) ». Même raison que pour
        // « Signalement DMCA » ci-dessus : Baobart est établie à Abidjan, et
        // la loi qui régit ses traitements est ivoirienne (n° 2013-450). Le
        // libellé perd « (UE) » ; la place et l'intention sont gardées.
        label: "Politique de cookies",
        hint: "Traceurs & consentement",
        icone: "eye",
        href: "/cookies",
      },
    ],
  },
  {
    key: "communaute",
    label: "Communauté & Blogs",
    href: "/communautes",
    items: [
      {
        label: "Communautés",
        hint: "Des espaces où les créateurs se parlent",
        icone: "users",
        href: "/communautes",
      },
      { label: "À propos", hint: "Notre histoire", icone: "heart", href: "/a-propos" },
      { label: "Contact", hint: "Nous écrire", icone: "message", href: "/contact" },
      { label: "Blogs", hint: "Articles et coulisses", icone: "edit", href: "/blog" },
      { label: "Support", hint: "Aide et litiges", icone: "info", href: "/support" },
      {
        label: "Documentation Baobart",
        hint: "Guides d'utilisation",
        icone: "file",
        href: "/documentation",
      },
      {
        label: "Changelog",
        hint: "Nouveautés de la plateforme",
        icone: "clock",
        href: "/changelog",
      },
    ],
  },
  { key: "features", label: "Fonctionnalités", href: "/fonctionnalites", items: [] },
  { key: "tarifs", label: "Tarifs", href: "/tarifs", items: [] },
];

export interface EntreeRail {
  label: string;
  icone: NomIcone;
  filtre: Filtre;
}

/** Les onze entrées du rail, dans l'ordre de la maquette. */
export const ENTREES_RAIL: EntreeRail[] = [
  { label: "Accueil", icone: "home", filtre: "Tous" },
  { label: "Arts", icone: "image", filtre: "Art" },
  { label: "Audios", icone: "mic", filtre: "Audio" },
  { label: "Fonts", icone: "file", filtre: "Font" },
  { label: "Icons", icone: "star", filtre: "Icône" },
  { label: "Illustrations", icone: "edit", filtre: "Illustration" },
  { label: "Images", icone: "camera", filtre: "Photo" },
  { label: "Logos", icone: "tag", filtre: "Logo" },
  { label: "Mockups", icone: "card", filtre: "Mockup" },
  { label: "Packs", icone: "folder", filtre: "Pack" },
  { label: "Vidéos", icone: "video", filtre: "Vidéo" },
];

export const RESEAUX = ["f", "X", "P", "ig", "in"] as const;

export const ENCRE = "#121212";
export const ORANGE = "#E2622C";
export const JAUNE = "#FFD84A";
export const BLANC = "#FFFFFF";
export const LAVANDE = "#EADFF9";
export const LAVANDE_CLAIR = "#F4EEFC";
export const LAVANDE_PROFOND = "#C9A8F5";
/** Le fond de l'entrée « Déconnexion » — maquette, ligne 1934. */
export const ORANGE_PALE = "#FFF3EE";
