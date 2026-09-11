/**
 * Ce qu'on accepte de recevoir dans un profil public.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA VITRINE EXISTAIT, RIEN NE LA REMPLISSAIT
 *
 * `Profile` porte `speciality`, `portfolioUrl`, `instagram`, `behance`,
 * `openToCommissions` et `dailyRate` depuis longtemps, et
 * `/createurs/[username]` les affiche depuis la v1.45.0. Mais **aucune action
 * ne les écrivait** : ces colonnes étaient vides pour tout le monde, et la
 * page que les agences visitent montrait des blancs que personne ne pouvait
 * combler.
 *
 * On avait construit l'affichage sans l'alimentation. Ce module ferme la
 * boucle.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL EST PUR
 *
 * Il reçoit des chaînes, il rend une décision. L'unicité du nom
 * d'utilisateur, elle, demande la base — c'est l'appelant qui la vérifie,
 * parce qu'elle ne se décide pas sans lire ailleurs.
 */

export interface Saisie {
  nomAffiche: string;
  username: string;
  bio: string;
  ville: string;
  pays: string;
  specialite: string;
  portfolio: string;
  instagram: string;
  behance: string;
  disponibilite: string;
  tarifJournalier: string;
}

export type Champ =
  | "nomAffiche"
  | "username"
  | "bio"
  | "ville"
  | "pays"
  | "specialite"
  | "portfolio"
  | "instagram"
  | "behance"
  | "disponibilite"
  | "tarifJournalier";

export interface Refus {
  champ: Champ;
  message: string;
}

/** Le profil, une fois accepté. Prêt à écrire, sans retouche. */
export interface ProfilValide {
  nomAffiche: string;
  username: string;
  bio: string | null;
  ville: string | null;
  pays: string | null;
  specialite: string | null;
  portfolio: string | null;
  instagram: string | null;
  behance: string | null;
  disponibilite: string | null;
  tarifJournalier: number | null;
}

export type Verdict =
  | { ok: true; profil: ProfilValide }
  | { ok: false; refus: Refus };

const NOM_MIN = 2;
const NOM_MAX = 80;
const USERNAME_MIN = 3;
const USERNAME_MAX = 40;
const BIO_MAX = 600;
const COURT_MAX = 80;
const URL_MAX = 300;

/** Cinq millions par jour : au-delà, c'est une faute de frappe. */
const TARIF_MAX = 5_000_000;

/**
 * Le nom d'utilisateur, ramené à ce qu'une URL accepte.
 *
 * Recopié de l'inscription : les deux doivent produire exactement la même
 * chaîne, sans quoi quelqu'un pourrait « changer » son nom pour celui qu'il a
 * déjà et se heurter à sa propre unicité.
 */
export function normaliserUsername(valeur: string): string {
  return valeur
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function valider(saisie: Saisie): Verdict {
  const nomAffiche = saisie.nomAffiche.trim().replace(/\s+/g, " ");

  if (nomAffiche.length < NOM_MIN) {
    return refus("nomAffiche", "Donne le nom sous lequel on te connaît.");
  }
  if (nomAffiche.length > NOM_MAX) {
    return refus("nomAffiche", `Le nom ne doit pas dépasser ${NOM_MAX} caractères.`);
  }

  const username = normaliserUsername(saisie.username);

  if (username.length < USERNAME_MIN) {
    return refus(
      "username",
      `Le nom d'utilisateur doit faire au moins ${USERNAME_MIN} caractères.`,
    );
  }
  if (username.length > USERNAME_MAX) {
    return refus("username", "Ce nom d'utilisateur est trop long.");
  }

  const bio = saisie.bio.trim();
  if (bio.length > BIO_MAX) {
    return refus("bio", `La présentation ne doit pas dépasser ${BIO_MAX} caractères.`);
  }

  // Le pays sert au filtre et au rail de paiement : deux lettres majuscules,
  // ISO 3166-1 alpha-2, comme partout ailleurs dans le projet.
  const pays = saisie.pays.trim().toUpperCase();
  if (pays.length > 0 && !/^[A-Z]{2}$/.test(pays)) {
    return refus("pays", "Le pays doit être un code à deux lettres (CI, SN, ML…).");
  }

  const portfolio = lireLien(saisie.portfolio);
  if (portfolio === "invalide") {
    return refus("portfolio", "L'adresse doit commencer par https://.");
  }

  const tarif = lireEntier(saisie.tarifJournalier);
  if (tarif === "invalide") {
    return refus("tarifJournalier", "Indique un montant en chiffres, ou laisse vide.");
  }
  if (tarif !== null && tarif > TARIF_MAX) {
    return refus("tarifJournalier", "Ce tarif semble trop élevé — vérifie les zéros.");
  }

  return {
    ok: true,
    profil: {
      nomAffiche,
      username,
      bio: vide(bio),
      ville: vide(saisie.ville.trim().slice(0, COURT_MAX)),
      pays: vide(pays),
      specialite: vide(saisie.specialite.trim().slice(0, COURT_MAX)),
      portfolio,
      // Les deux réseaux sont rangés en **identifiant**, pas en URL : la
      // vitrine les préfixe d'un « @ » et compose le lien elle-même. Accepter
      // une URL entière ferait afficher « @https://instagram.com/awa ».
      instagram: vide(nettoyerPseudo(saisie.instagram)),
      behance: vide(nettoyerPseudo(saisie.behance)),
      disponibilite: vide(saisie.disponibilite.trim().slice(0, COURT_MAX)),
      // Zéro et vide disent la même chose — pas de tarif annoncé. On range
      // `null` dans les deux cas, pour n'avoir qu'une écriture à lire.
      tarifJournalier: tarif === 0 ? null : tarif,
    },
  };
}

function refus(champ: Champ, message: string): { ok: false; refus: Refus } {
  return { ok: false, refus: { champ, message } };
}

function vide(valeur: string): string | null {
  return valeur.length > 0 ? valeur : null;
}

/**
 * Une adresse de portfolio, ou rien.
 *
 * `https` seul : `http` en clair sur un lien qu'on met en avant, et
 * `javascript:` déguisé en lien, n'ont rien à faire sur une page publique.
 */
function lireLien(brut: string): string | null | "invalide" {
  const propre = brut.trim();
  if (propre.length === 0) return null;
  if (propre.length > URL_MAX) return "invalide";

  try {
    const url = new URL(propre);
    return url.protocol === "https:" ? url.toString() : "invalide";
  } catch {
    return "invalide";
  }
}

/**
 * Un pseudo de réseau social, quelle que soit la façon dont il a été collé.
 *
 * Les gens collent l'URL entière, le « @ », ou le pseudo nu. Les trois
 * arrivent ici et repartent identiques — sinon la vitrine afficherait
 * « @https://instagram.com/awa » à qui a collé son lien.
 */
function nettoyerPseudo(brut: string): string {
  return brut
    .trim()
    .replace(/^https?:\/\/(www\.)?[^/]+\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "")
    .slice(0, COURT_MAX);
}

/** Un entier positif, ou `null` si vide, ou `"invalide"` sinon. */
function lireEntier(brut: string): number | null | "invalide" {
  const propre = brut.trim().replace(/\s/g, "");
  if (propre.length === 0) return null;
  if (!/^\d+$/.test(propre)) return "invalide";
  return Number(propre);
}
