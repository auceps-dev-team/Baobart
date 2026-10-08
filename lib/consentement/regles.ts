/**
 * Le consentement aux cookies, et le registre de ce que Baobart dépose.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DÉCIDÉ LE 03/10
 *
 * Toutes les informations gardées sont dites, une par une, dans la politique
 * de cookies, avec à quoi elles servent ; et une bannière demande l'accord
 * avant tout cookie qui n'est pas indispensable au site.
 *
 * Aujourd'hui, un seul cookie en dépend : `bb_pub`, qui retient les bannières
 * cliquées pour attribuer une vente (`lib/publicites/attribution.ts`). Les
 * autres font marcher le site — sans session, pas de connexion — et ne se
 * refusent pas.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE REGISTRE EST LA SEULE LISTE
 *
 * La page `/cookies` se dessine depuis `REGISTRE`, et un test vérifie que
 * chaque fichier qui pose un cookie y figure. Une liste recopiée à la main dans
 * une page juridique vieillit en silence — et une politique qui oublie un
 * cookie dit quelque chose de faux à tous ceux qui la lisent.
 *
 * Pur : se lit côté serveur comme dans le navigateur.
 */

import { REGLES } from "@/lib/securite/limites";

export const COOKIE_CONSENTEMENT = "bb_consentement";

/**
 * Six mois : on redemande deux fois par an. C'est un choix de Baobart, pas
 * une durée lue dans un texte de loi.
 */
export const DUREE_CONSENTEMENT_S = 182 * 24 * 60 * 60;

/** La version du texte de la bannière. La changer redemande l'accord à tous. */
const VERSION = "1";

export interface Choix {
  /** Retenir les bannières cliquées, pour attribuer une vente. */
  mesurePub: boolean;
}

/**
 * Le format : `v1.pub-oui` ou `v1.pub-non`.
 *
 * Rien qui demande d'être encodé. Un premier format, `v1.pub=1`, ressortait
 * du serveur en `v1.pub%3D1` — Next encode la valeur d'un cookie — et tout
 * lecteur qui oubliait de décoder le prenait pour « pas encore choisi ».
 * Mesuré le 03/10 pendant la vérification au navigateur.
 */
const FORMAT = /^v(\d+)\.pub-(oui|non)$/;

/** `null` : pas encore de choix, ou un choix fait sur une version périmée. */
export function lireConsentement(brut: string | null | undefined): Choix | null {
  if (!brut) return null;
  let valeur: string;
  try {
    valeur = decodeURIComponent(brut).trim();
  } catch {
    return null;
  }
  const m = FORMAT.exec(valeur);
  if (!m || m[1] !== VERSION) return null;
  return { mesurePub: m[2] === "oui" };
}

export function ecrireConsentement(choix: Choix): string {
  return `v${VERSION}.pub-${choix.mesurePub ? "oui" : "non"}`;
}

/** Le choix lu dans un en-tête `Cookie`, côté serveur. */
export function consentementDepuisEntete(entete: string | null): Choix | null {
  const m = entete?.match(new RegExp(`(?:^|;\\s*)${COOKIE_CONSENTEMENT}=([^;]*)`));
  return lireConsentement(m?.[1]);
}

export type Categorie = "essentiel" | "mesure";

export interface EntreeRegistre {
  nom: string;
  categorie: Categorie;
  /** À quoi il sert, en une phrase qu'un visiteur comprend. */
  finalite: string;
  duree: string;
  /** Ce qu'il contient. */
  contenu: string;
  /** Les fichiers qui le posent — vérifiés par le test du registre. */
  sources: readonly string[];
}

export const REGISTRE: readonly EntreeRegistre[] = [
  {
    nom: "baobart_session",
    categorie: "essentiel",
    finalite: "Te garder connecté d'une page à l'autre.",
    duree: "30 jours, ou jusqu'à la déconnexion",
    contenu: "Un jeton tiré au sort, illisible par la page (HttpOnly). La session correspondante, en base, garde l'adresse IP de la connexion : elle sert à bloquer une adresse en cas de fraude, et part avec la session.",
    sources: ["lib/auth/session.ts"],
  },
  {
    nom: "baobart_2fa",
    categorie: "essentiel",
    finalite: "Finir une connexion en deux étapes, quand la double authentification est activée.",
    duree: "5 minutes",
    contenu: "Un jeton de défi, illisible par la page (HttpOnly).",
    sources: ["lib/auth/actions.ts", "lib/auth/actions-telephone.ts"],
  },
  {
    nom: "baobart_tel_connexion",
    categorie: "essentiel",
    finalite: "Se souvenir du numéro saisi entre la demande d'un code SMS et sa saisie, pour se connecter par téléphone.",
    duree: "10 minutes",
    contenu: "Ton numéro au format international, illisible par la page (HttpOnly). Effacé dès que le code est saisi.",
    sources: ["lib/auth/actions-telephone.ts"],
  },
  {
    nom: "baobart_tel_verification",
    categorie: "essentiel",
    finalite: "Se souvenir du numéro à vérifier entre l'envoi du code SMS et sa saisie, dans ton profil.",
    duree: "10 minutes",
    contenu: "Le numéro à vérifier, au format international, illisible par la page (HttpOnly). Effacé dès que le code est saisi.",
    sources: ["lib/auth/actions-telephone.ts"],
  },
  {
    nom: COOKIE_CONSENTEMENT,
    categorie: "essentiel",
    finalite: "Retenir ton choix sur les cookies, pour ne pas te le redemander à chaque visite.",
    duree: "6 mois",
    contenu: "Ton choix, et rien d'autre (« accepté » ou « refusé »). Lisible par la page, pour savoir s'il faut afficher la bannière.",
    sources: ["lib/consentement/actions.ts"],
  },
  {
    nom: "bb_pub",
    categorie: "mesure",
    finalite: "Savoir si une vente vient d'une bannière : si tu achètes une ressource après avoir cliqué la bannière qui y menait, la vente est comptée à cette bannière.",
    duree: "30 jours après le dernier clic",
    contenu: "Les numéros des cinq dernières bannières cliquées. Ni ton compte, ni ton adresse. Illisible par la page (HttpOnly).",
    sources: ["app/api/pub/[id]/clic/route.ts", "lib/consentement/actions.ts"],
  },
];

/** Ce qui n'est pas un cookie, mais qu'on garde quand même — dit aussi. */
export const AUTRES_DONNEES: readonly { quoi: string; pourquoi: string; duree: string }[] = [
  {
    quoi: "Les affichages et les clics des bannières, comptés par jour",
    pourquoi: "Dire aux annonceurs combien de fois leur bannière a été vue et cliquée.",
    duree: "Tant que la campagne existe. Aucun identifiant : un nombre par bannière et par jour.",
  },
  {
    quoi: "Une empreinte de ton adresse IP, par bannière",
    pourquoi: "Empêcher qu'une même connexion fasse compter des centaines de clics : au-delà du plafond du jour, tes gestes ne comptent plus.",
    duree: "26 heures. Calculée avec un secret du site et la date : on ne remonte pas à l'adresse.",
  },
  {
    quoi: "Ton adresse IP, dans les compteurs de limite",
    pourquoi: "Freiner les essais répétés — mots de passe, inscriptions, envois de formulaires.",
    duree: `${dureeDesLimites()} selon le geste, puis effacée d'elle-même.`,
  },
];

/**
 * Combien de temps une adresse reste dans les compteurs de limite : deux
 * fenêtres, la courante et la précédente (`lib/securite/garde.ts`). Calculé
 * depuis les règles, pour que la page ne puisse pas les contredire.
 */
export function dureeDesLimites(): string {
  const fenetres = Object.values(REGLES).map((r) => (2 * r.fenetreMs) / 60_000);
  const dire = (min: number) => (min >= 60 ? `${min / 60} heure${min >= 120 ? "s" : ""}` : `${min} minute${min > 1 ? "s" : ""}`);
  return `De ${dire(Math.min(...fenetres))} à ${dire(Math.max(...fenetres))}`;
}
