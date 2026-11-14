/**
 * Les 49 icônes Baobart — FICHIER GÉNÉRÉ, ne pas modifier à la main.
 *
 * Tracés : `Baobart Design/baobart-icons.js`. Libellés : `Baobart Design/Baobart Icons.dc.html`.
 * Régénérer : `pnpm icones:generer`. `lib/icones/icones.test.ts` échoue si
 * ce fichier ne correspond plus à la maquette.
 *
 * Les identifiants sont ceux de la maquette (`<bb-icon name="home">` →
 * `<Icone nom="home" />`) : les traduire obligerait chaque lecteur à tenir
 * une table de correspondance entre les deux.
 */

import type { DefinitionIcone } from "@/lib/icones/source";

export const ICONES = {
  home: {
    groupe: "Navigation",
    libelle: "Accueil",
    formes: [
      { t: "path", a: {"d":"M4 10.5 12 4l8 6.5V20H4z"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M10 20v-5h4v5"} },
    ],
  },
  dashboard: {
    groupe: "Navigation",
    libelle: "Tableau de bord",
    formes: [
      { t: "rect", a: {"x":"4","y":"4","width":"7","height":"9","rx":"1.5"} },
      { t: "rect", a: {"x":"13","y":"11","width":"7","height":"9","rx":"1.5"} },
    ],
    lignes: [
      { t: "rect", a: {"x":"13","y":"4","width":"7","height":"4","rx":"1.5"} },
      { t: "rect", a: {"x":"4","y":"16","width":"7","height":"4","rx":"1.5"} },
    ],
  },
  folder: {
    groupe: "Navigation",
    libelle: "Projets",
    formes: [
      { t: "path", a: {"d":"M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M3 10.5h18"} },
    ],
  },
  message: {
    groupe: "Navigation",
    libelle: "Messages",
    formes: [
      { t: "path", a: {"d":"M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H6a2 2 0 0 1-2-2z"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M8.5 9h7M8.5 12.5h4"} },
    ],
  },
  calendar: {
    groupe: "Navigation",
    libelle: "Agenda",
    formes: [
      { t: "rect", a: {"x":"4","y":"5.5","width":"16","height":"15","rx":"2"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M4 10h16M8.5 3.5v4M15.5 3.5v4"} },
      { t: "path", a: {"d":"M8 14h2M14 14h2M8 17h2"} },
    ],
  },
  search: {
    groupe: "Navigation",
    libelle: "Recherche",
    formes: [
      { t: "circle", a: {"cx":"10.5","cy":"10.5","r":"6.5"} },
    ],
    lignes: [
      { t: "path", a: {"d":"m15.5 15.5 5 5"} },
    ],
  },
  compass: {
    groupe: "Navigation",
    libelle: "Explorer",
    formes: [
      { t: "circle", a: {"cx":"12","cy":"12","r":"8.5"} },
    ],
    lignes: [
      { t: "path", a: {"d":"m15.5 8.5-2 5-5 2 2-5z"} },
    ],
  },
  users: {
    groupe: "Navigation",
    libelle: "Communauté",
    formes: [
      { t: "circle", a: {"cx":"9","cy":"8.5","r":"3.5"} },
      { t: "path", a: {"d":"M3 20a6 6 0 0 1 12 0z"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M16 5.2a3.4 3.4 0 0 1 0 6.6M18 14.3a6 6 0 0 1 3 5.2"} },
    ],
  },
  plus: {
    groupe: "Actions",
    libelle: "Ajouter",
    formes: [
      { t: "rect", a: {"x":"3.5","y":"3.5","width":"17","height":"17","rx":"4"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M12 8v8M8 12h8"} },
    ],
  },
  edit: {
    groupe: "Actions",
    libelle: "Éditer",
    formes: [
      { t: "path", a: {"d":"m15 4.5 4.5 4.5L9 19.5H4.5V15z"} },
    ],
    lignes: [
      { t: "path", a: {"d":"m12.5 7 4.5 4.5"} },
    ],
  },
  trash: {
    groupe: "Actions",
    libelle: "Supprimer",
    formes: [
      { t: "path", a: {"d":"M6 7h12l-1 13H7z"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M4 7h16M9.5 7V4.5h5V7M10 11v5M14 11v5"} },
    ],
  },
  share: {
    groupe: "Actions",
    libelle: "Partager",
    formes: [
      { t: "circle", a: {"cx":"6.5","cy":"12","r":"2.8"} },
      { t: "circle", a: {"cx":"17.5","cy":"6","r":"2.8"} },
      { t: "circle", a: {"cx":"17.5","cy":"18","r":"2.8"} },
    ],
    lignes: [
      { t: "path", a: {"d":"m9 10.6 6-3.2M9 13.4l6 3.2"} },
    ],
  },
  download: {
    groupe: "Actions",
    libelle: "Télécharger",
    formes: [
      { t: "path", a: {"d":"M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3z"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M12 3.5V14M7.5 10l4.5 4.5 4.5-4.5"} },
    ],
  },
  upload: {
    groupe: "Actions",
    libelle: "Importer",
    formes: [
      { t: "path", a: {"d":"M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3z"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M12 14V3.5M7.5 8 12 3.5 16.5 8"} },
    ],
  },
  filter: {
    groupe: "Actions",
    libelle: "Filtrer",
    formes: [
      { t: "path", a: {"d":"M4 5h16l-6 7.5V19l-4 2v-8.5z"} },
    ],
    lignes: [],
  },
  more: {
    groupe: "Actions",
    libelle: "Plus",
    formes: [
      { t: "circle", a: {"cx":"5.5","cy":"12","r":"2"} },
      { t: "circle", a: {"cx":"12","cy":"12","r":"2"} },
      { t: "circle", a: {"cx":"18.5","cy":"12","r":"2"} },
    ],
    lignes: [],
  },
  file: {
    groupe: "Fichiers & médias",
    libelle: "Fichier",
    formes: [
      { t: "path", a: {"d":"M6 3.5h8l4.5 4.5v12.5H6z"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M14 3.5V8h4.5M9 13h6M9 16.5h4"} },
    ],
  },
  image: {
    groupe: "Fichiers & médias",
    libelle: "Image",
    formes: [
      { t: "rect", a: {"x":"3.5","y":"4.5","width":"17","height":"15","rx":"2"} },
    ],
    lignes: [
      { t: "circle", a: {"cx":"9","cy":"9.5","r":"1.6"} },
      { t: "path", a: {"d":"m3.5 17 5-4.5 4 3.5 3-2.5 5 4"} },
    ],
  },
  video: {
    groupe: "Fichiers & médias",
    libelle: "Vidéo",
    formes: [
      { t: "rect", a: {"x":"3","y":"6","width":"13","height":"12","rx":"2"} },
    ],
    lignes: [
      { t: "path", a: {"d":"m16 10.5 5-3v9l-5-3"} },
    ],
  },
  mic: {
    groupe: "Fichiers & médias",
    libelle: "Audio",
    formes: [
      { t: "rect", a: {"x":"8.5","y":"3","width":"7","height":"11.5","rx":"3.5"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"} },
    ],
  },
  link: {
    groupe: "Fichiers & médias",
    libelle: "Lien",
    formes: [
      { t: "rect", a: {"x":"2.5","y":"8.5","width":"10","height":"7","rx":"3.5"} },
    ],
    lignes: [
      { t: "rect", a: {"x":"11.5","y":"8.5","width":"10","height":"7","rx":"3.5"} },
      { t: "path", a: {"d":"M8.5 12h7"} },
    ],
  },
  attach: {
    groupe: "Fichiers & médias",
    libelle: "Pièce jointe",
    formes: [],
    lignes: [
      { t: "path", a: {"d":"m20 11.5-7.8 7.8a4.6 4.6 0 0 1-6.5-6.5l8.3-8.3a3 3 0 0 1 4.3 4.3l-8.2 8.2a1.5 1.5 0 0 1-2.1-2.1L15.5 7.5"} },
    ],
  },
  camera: {
    groupe: "Fichiers & médias",
    libelle: "Photo",
    formes: [
      { t: "path", a: {"d":"M3.5 8.5a2 2 0 0 1 2-2h2.5L9.5 4h5L16 6.5h2.5a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"} },
    ],
    lignes: [
      { t: "circle", a: {"cx":"12","cy":"13","r":"3.5"} },
    ],
  },
  card: {
    groupe: "Paiement & commandes",
    libelle: "Carte",
    formes: [
      { t: "rect", a: {"x":"2.5","y":"5","width":"19","height":"14","rx":"2.5"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M2.5 9.5h19M6 15h4"} },
    ],
  },
  cart: {
    groupe: "Paiement & commandes",
    libelle: "Panier",
    formes: [
      { t: "path", a: {"d":"M6 6.5h15l-2 8H7.5z"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M2.5 3.5h2.5L7.5 14.5"} },
      { t: "circle", a: {"cx":"9","cy":"19.5","r":"1.5"} },
      { t: "circle", a: {"cx":"17.5","cy":"19.5","r":"1.5"} },
    ],
  },
  bag: {
    groupe: "Paiement & commandes",
    libelle: "Achat",
    formes: [
      { t: "path", a: {"d":"M5 8h14l-1 12.5H6z"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M9 10.5V7a3 3 0 0 1 6 0v3.5"} },
    ],
  },
  wallet: {
    groupe: "Paiement & commandes",
    libelle: "Portefeuille",
    formes: [
      { t: "path", a: {"d":"M3.5 7a2 2 0 0 1 2-2H18v3h1a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5H5.5a2 2 0 0 1-2-2z"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M3.5 7.5a2 2 0 0 0 2 1H18"} },
      { t: "circle", a: {"cx":"16.5","cy":"14.5","r":"1.2"} },
    ],
  },
  receipt: {
    groupe: "Paiement & commandes",
    libelle: "Facture",
    formes: [
      { t: "path", a: {"d":"M5.5 3.5h13v17l-2.2-1.5-2.1 1.5-2.2-1.5-2.2 1.5-2.1-1.5-2.2 1.5z"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M9 8.5h6M9 12h6M9 15.5h3"} },
    ],
  },
  tag: {
    groupe: "Paiement & commandes",
    libelle: "Prix",
    formes: [
      { t: "path", a: {"d":"M3.5 4.5a1 1 0 0 1 1-1h7.2l9 9-8.2 8.2-9-9z"} },
    ],
    lignes: [
      { t: "circle", a: {"cx":"8.5","cy":"8.5","r":"1.6"} },
    ],
  },
  coins: {
    groupe: "Paiement & commandes",
    libelle: "Revenus",
    formes: [
      { t: "ellipse", a: {"cx":"9","cy":"7.5","rx":"5.5","ry":"2.5"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M3.5 7.5v4c0 1.4 2.5 2.5 5.5 2.5M3.5 11.5v4c0 1.4 2.5 2.5 5.5 2.5"} },
      { t: "ellipse", a: {"cx":"15.5","cy":"13.5","rx":"5","ry":"2.3"} },
      { t: "path", a: {"d":"M10.5 13.5v4.2c0 1.3 2.2 2.3 5 2.3s5-1 5-2.3v-4.2"} },
    ],
  },
  truck: {
    groupe: "Paiement & commandes",
    libelle: "Livraison",
    formes: [
      { t: "path", a: {"d":"M2.5 6h11v11h-11z"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M13.5 9.5h4l3.5 4V17h-7.5"} },
      { t: "circle", a: {"cx":"6.5","cy":"18","r":"1.8"} },
      { t: "circle", a: {"cx":"17","cy":"18","r":"1.8"} },
    ],
  },
  bell: {
    groupe: "Statuts & notifications",
    libelle: "Notification",
    formes: [
      { t: "path", a: {"d":"M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5z"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M10 21h4"} },
    ],
  },
  check: {
    groupe: "Statuts & notifications",
    libelle: "Validé",
    formes: [
      { t: "circle", a: {"cx":"12","cy":"12","r":"8.5"} },
    ],
    lignes: [
      { t: "path", a: {"d":"m8 12.3 2.8 2.7L16.2 9.5"} },
    ],
  },
  alert: {
    groupe: "Statuts & notifications",
    libelle: "Alerte",
    formes: [
      { t: "path", a: {"d":"M12 3.5 21.5 20h-19z"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M12 10v4.5M12 17.3v.2"} },
    ],
  },
  info: {
    groupe: "Statuts & notifications",
    libelle: "Info",
    formes: [
      { t: "circle", a: {"cx":"12","cy":"12","r":"8.5"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M12 11v5.5M12 7.8v.2"} },
    ],
  },
  clock: {
    groupe: "Statuts & notifications",
    libelle: "En attente",
    formes: [
      { t: "circle", a: {"cx":"12","cy":"12","r":"8.5"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M12 7.5V12l3 2"} },
    ],
  },
  star: {
    groupe: "Statuts & notifications",
    libelle: "Favori",
    formes: [
      { t: "path", a: {"d":"m12 3.5 2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.8l-5.4 2.9 1.2-5.9-4.4-4.1 6-.7z"} },
    ],
    lignes: [],
  },
  heart: {
    groupe: "Statuts & notifications",
    libelle: "J'aime",
    formes: [
      { t: "path", a: {"d":"M12 20s-8-4.6-8-10.4A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 2.6C20 15.4 12 20 12 20z"} },
    ],
    lignes: [],
  },
  user: {
    groupe: "Profil & paramètres",
    libelle: "Profil",
    formes: [
      { t: "circle", a: {"cx":"12","cy":"8","r":"4"} },
      { t: "path", a: {"d":"M4.5 20.5a7.5 7.5 0 0 1 15 0z"} },
    ],
    lignes: [],
  },
  sliders: {
    groupe: "Profil & paramètres",
    libelle: "Réglages",
    formes: [
      { t: "circle", a: {"cx":"9","cy":"7","r":"2.3"} },
      { t: "circle", a: {"cx":"15","cy":"17","r":"2.3"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M4 7h2.7M11.3 7H20M4 17h8.7M17.3 17H20"} },
    ],
  },
  lock: {
    groupe: "Profil & paramètres",
    libelle: "Sécurité",
    formes: [
      { t: "rect", a: {"x":"4.5","y":"10","width":"15","height":"10.5","rx":"2"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M8 10V7.5a4 4 0 0 1 8 0V10M12 14v2.5"} },
    ],
  },
  logout: {
    groupe: "Profil & paramètres",
    libelle: "Déconnexion",
    formes: [
      { t: "path", a: {"d":"M4 4.5h9v15H4z"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M16.5 8.5 20 12l-3.5 3.5M9.5 12H20"} },
    ],
  },
  shield: {
    groupe: "Profil & paramètres",
    libelle: "Confidentialité",
    formes: [
      { t: "path", a: {"d":"M12 3.5 19.5 6v5.5c0 4.6-3.2 7.8-7.5 9-4.3-1.2-7.5-4.4-7.5-9V6z"} },
    ],
    lignes: [
      { t: "path", a: {"d":"m9 12 2.2 2.2L15.5 10"} },
    ],
  },
  eye: {
    groupe: "Profil & paramètres",
    libelle: "Visibilité",
    formes: [
      { t: "path", a: {"d":"M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"} },
    ],
    lignes: [
      { t: "circle", a: {"cx":"12","cy":"12","r":"3"} },
    ],
  },
  bars: {
    groupe: "Analytique",
    libelle: "Statistiques",
    formes: [
      { t: "rect", a: {"x":"4","y":"12","width":"4","height":"8","rx":"1"} },
      { t: "rect", a: {"x":"10","y":"5","width":"4","height":"15","rx":"1"} },
      { t: "rect", a: {"x":"16","y":"9","width":"4","height":"11","rx":"1"} },
    ],
    lignes: [],
  },
  trend: {
    groupe: "Analytique",
    libelle: "Croissance",
    formes: [
      { t: "path", a: {"d":"M3.5 20.5V15l5-5 4 3.5 8-8v15z"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M15.5 5.5h5v5"} },
    ],
  },
  pie: {
    groupe: "Analytique",
    libelle: "Répartition",
    formes: [
      { t: "path", a: {"d":"M12 3.5a8.5 8.5 0 0 1 8.5 8.5H12z"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M10 5.8A8.5 8.5 0 1 0 18.2 14H10z"} },
    ],
  },
  target: {
    groupe: "Analytique",
    libelle: "Objectif",
    formes: [
      { t: "circle", a: {"cx":"12","cy":"12","r":"8.5"} },
    ],
    lignes: [
      { t: "circle", a: {"cx":"12","cy":"12","r":"4.8"} },
      { t: "circle", a: {"cx":"12","cy":"12","r":"1.2"} },
    ],
  },
  trophy: {
    groupe: "Analytique",
    libelle: "Badges",
    formes: [
      { t: "path", a: {"d":"M7 4h10v5a5 5 0 0 1-10 0z"} },
    ],
    lignes: [
      { t: "path", a: {"d":"M7 6H4v1.5a3 3 0 0 0 3.2 3M17 6h3v1.5a3 3 0 0 1-3.2 3M12 14v3.5M8.5 20.5h7l-.8-3h-5.4z"} },
    ],
  },
} as const satisfies Record<string, DefinitionIcone>;

export type NomIcone = keyof typeof ICONES;
