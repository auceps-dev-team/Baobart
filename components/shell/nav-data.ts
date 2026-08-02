/**
 * Structure de navigation, reprise telle quelle des maquettes
 * (« Baobart Accueil.dc.html », constantes `NAV` et `railItems`).
 *
 * Les destinations pointent vers les routes qui existent aujourd'hui. Celles
 * qui n'existent pas encore portent `href: null` : le lien reste affiché — la
 * maquette le prévoit — mais il ne mène nulle part plutôt que vers un 404.
 */

import type { Filtre } from "@/lib/feed/types";

export interface EntreeMenu {
  label: string;
  hint: string;
  glyph: string;
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
        glyph: "▣",
        href: "/explore",
      },
      {
        label: "Concours & Événements",
        hint: "Édition Wax Futurism en cours",
        glyph: "★",
        href: null,
      },
      {
        label: "Sponsoriser",
        hint: "Formats & partenariats",
        glyph: "◆",
        href: null,
      },
    ],
  },
  {
    key: "createurs",
    label: "Créateurs",
    href: null,
    items: [
      { label: "Créateurs", hint: "Annuaire des membres", glyph: "☺", href: null },
      { label: "Services", hint: "Prestations des membres", glyph: "✦", href: null },
      { label: "Jobs", hint: "Missions à saisir", glyph: "▤", href: null },
    ],
  },
  {
    key: "conditions",
    label: "Conditions générales",
    href: null,
    items: [
      {
        label: "Licences Baobart",
        hint: "Ce que tu peux faire des fichiers",
        glyph: "§",
        href: null,
      },
      {
        label: "Règles de publication",
        hint: "Pour les contributeurs",
        glyph: "✎",
        href: null,
      },
      { label: "Signalement DMCA", hint: "Signaler un contenu", glyph: "!", href: null },
      {
        label: "Politique de cookies (UE)",
        hint: "Traceurs & consentement",
        glyph: "◍",
        href: null,
      },
    ],
  },
  {
    key: "communaute",
    label: "Communauté & Blogs",
    href: null,
    items: [
      { label: "À propos", hint: "Notre histoire", glyph: "◈", href: null },
      { label: "Contact", hint: "Nous écrire", glyph: "✉", href: null },
      { label: "Blogs", hint: "Articles et coulisses", glyph: "▤", href: null },
      { label: "Support", hint: "Aide et litiges", glyph: "?", href: null },
      {
        label: "Documentation Baobart",
        hint: "Guides d'utilisation",
        glyph: "▦",
        href: null,
      },
      {
        label: "Changelog",
        hint: "Nouveautés de la plateforme",
        glyph: "★",
        href: null,
      },
    ],
  },
  { key: "features", label: "Fonctionnalités", href: null, items: [] },
  { key: "tarifs", label: "Tarifs", href: null, items: [] },
];

export interface EntreeRail {
  label: string;
  glyph: string;
  filtre: Filtre;
}

/** Les onze entrées du rail, dans l'ordre de la maquette. */
export const ENTREES_RAIL: EntreeRail[] = [
  { label: "Accueil", glyph: "⌂", filtre: "Tous" },
  { label: "Arts", glyph: "◈", filtre: "Art" },
  { label: "Audios", glyph: "♪", filtre: "Audio" },
  { label: "Fonts", glyph: "A", filtre: "Font" },
  { label: "Icons", glyph: "✦", filtre: "Icône" },
  { label: "Illustrations", glyph: "✎", filtre: "Illustration" },
  { label: "Images", glyph: "▣", filtre: "Photo" },
  { label: "Logos", glyph: "◎", filtre: "Logo" },
  { label: "Mockups", glyph: "▤", filtre: "Mockup" },
  { label: "Packs", glyph: "▦", filtre: "Pack" },
  { label: "Vidéos", glyph: "▶", filtre: "Vidéo" },
];

export const RESEAUX = ["f", "X", "P", "ig", "in"] as const;

export const ENCRE = "#121212";
export const ORANGE = "#E2622C";
export const JAUNE = "#FFD84A";
export const BLANC = "#FFFFFF";
export const LAVANDE = "#EADFF9";
export const LAVANDE_CLAIR = "#F4EEFC";
export const LAVANDE_PROFOND = "#C9A8F5";
