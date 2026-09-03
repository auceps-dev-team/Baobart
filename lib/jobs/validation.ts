/**
 * Ce qu'on accepte de recevoir dans une offre d'emploi.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * C'EST LE FORMULAIRE LE PLUS EXPOSÉ DU PROJET
 *
 * N'importe quel inscrit peut déposer une offre. Un compte se crée en deux
 * minutes : l'authentification donne quelqu'un à qui imputer, elle ne filtre
 * rien. Ce module est donc la première barrière, et la modération la seconde.
 *
 * Il est **pur** : il reçoit des chaînes, il rend une décision. Aucune requête,
 * aucune session — ce qui permet d'éprouver chaque refus sans rien monter.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON BORNE TOUT CE QUI ENTRE
 *
 * Une description sans limite finit par être une description d'un mégaoctet,
 * envoyée mille fois. Les bornes ne sont pas des devinettes : elles partent de
 * ce qu'une vraie offre demande, avec de la marge.
 */

import type { ApplyMode, JobMode, JobType } from "@/lib/jobs/enums";
import { MODES, TYPES } from "@/lib/jobs/enums";

export interface Saisie {
  titre: string;
  description: string;
  type: string;
  mode: string;
  pays: string;
  ville: string;
  salaireMin: string;
  salaireMax: string;
  echeance: string;
  commentPostuler: string;
  urlExterne: string;
}

export type Champ =
  | "titre"
  | "description"
  | "type"
  | "mode"
  | "pays"
  | "salaire"
  | "echeance"
  | "urlExterne";

export interface Refus {
  champ: Champ;
  message: string;
}

/** L'offre, une fois acceptée. Prête à écrire, sans retouche. */
export interface OffreValide {
  titre: string;
  description: string;
  type: JobType;
  mode: JobMode;
  pays: string | null;
  ville: string | null;
  salaireMin: number | null;
  salaireMax: number | null;
  /** Fin du jour choisi, en UTC. Voir plus bas. */
  echeance: Date | null;
  commentPostuler: ApplyMode;
  urlExterne: string | null;
}

export type Verdict =
  | { ok: true; offre: OffreValide }
  | { ok: false; refus: Refus };

const TITRE_MIN = 6;
const TITRE_MAX = 120;
const DESCRIPTION_MIN = 60;
const DESCRIPTION_MAX = 8_000;
const URL_MAX = 500;

/**
 * Au-delà, une échéance n'en est plus une.
 *
 * Un an. Une offre valable trois ans est une offre qu'on a oublié de fermer,
 * et l'annuaire se remplit de fantômes que plus personne ne retire.
 */
const ECHEANCE_MAX_JOURS = 365;

export function valider(saisie: Saisie, maintenant = new Date()): Verdict {
  const titre = saisie.titre.trim().replace(/\s+/g, " ");
  const description = saisie.description.trim();

  if (titre.length < TITRE_MIN) {
    return refus("titre", "Donne un intitulé de poste, même court.");
  }
  if (titre.length > TITRE_MAX) {
    return refus("titre", `L'intitulé ne doit pas dépasser ${TITRE_MAX} caractères.`);
  }

  // Un minimum de description n'est pas de la coquetterie : « recrute, contacte
  // par WhatsApp » est la forme exacte de l'arnaque qu'on cherche à écarter, et
  // c'est aussi ce qui rend une offre inexploitable pour un candidat.
  if (description.length < DESCRIPTION_MIN) {
    return refus(
      "description",
      "Décris le poste en quelques phrases : missions, profil recherché, conditions.",
    );
  }
  if (description.length > DESCRIPTION_MAX) {
    return refus("description", "La description est trop longue.");
  }

  if (!TYPES.includes(saisie.type as JobType)) {
    return refus("type", "Choisis un type de contrat.");
  }
  if (!MODES.includes(saisie.mode as JobMode)) {
    return refus("mode", "Choisis un mode de travail.");
  }

  // Le pays sert au filtre. Deux lettres, majuscules — ISO 3166-1 alpha-2,
  // comme partout ailleurs dans le projet.
  const pays = saisie.pays.trim().toUpperCase();
  if (pays.length > 0 && !/^[A-Z]{2}$/.test(pays)) {
    return refus("pays", "Le pays doit être un code à deux lettres.");
  }

  const salaire = lireSalaire(saisie.salaireMin, saisie.salaireMax);
  if (!salaire.ok) return salaire.refus;

  const echeance = lireEcheance(saisie.echeance, maintenant);
  if (!echeance.ok) return echeance.refus;

  const postuler = lirePostuler(saisie.commentPostuler, saisie.urlExterne);
  if (!postuler.ok) return postuler.refus;

  return {
    ok: true,
    offre: {
      titre,
      description,
      type: saisie.type as JobType,
      mode: saisie.mode as JobMode,
      pays: pays.length > 0 ? pays : null,
      ville: saisie.ville.trim().slice(0, 80) || null,
      salaireMin: salaire.min,
      salaireMax: salaire.max,
      echeance: echeance.valeur,
      commentPostuler: postuler.mode,
      urlExterne: postuler.url,
    },
  };
}

function refus(champ: Champ, message: string): { ok: false; refus: Refus } {
  return { ok: false, refus: { champ, message } };
}

/**
 * Le salaire, s'il est annoncé.
 *
 * Les deux bornes sont facultatives, et beaucoup d'offres n'en donnent aucune.
 * Mais un minimum supérieur au maximum n'est pas une omission : c'est une
 * saisie inversée, et l'afficher telle quelle ferait passer l'annonceur pour
 * négligent.
 */
function lireSalaire(
  brutMin: string,
  brutMax: string,
):
  | { ok: true; min: number | null; max: number | null }
  | { ok: false; refus: { ok: false; refus: Refus } } {
  const min = nombreOuNull(brutMin);
  const max = nombreOuNull(brutMax);

  if (min === "invalide" || max === "invalide") {
    return { ok: false, refus: refus("salaire", "Indique un montant en chiffres.") };
  }
  if (min !== null && min < 0) {
    return { ok: false, refus: refus("salaire", "Un salaire ne peut pas être négatif.") };
  }
  if (min !== null && max !== null && min > max) {
    return {
      ok: false,
      refus: refus("salaire", "Le minimum dépasse le maximum : les deux sont inversés."),
    };
  }

  return { ok: true, min, max };
}

function nombreOuNull(brut: string): number | null | "invalide" {
  const propre = brut.trim().replace(/\s/g, "");
  if (propre.length === 0) return null;
  if (!/^\d+$/.test(propre)) return "invalide";
  return Number(propre);
}

/**
 * L'échéance, rangée à la **fin** du jour choisi.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * « JUSQU'AU 31 OCTOBRE » VEUT DIRE QUE LE 31 COMPTE ENCORE
 *
 * Un champ date rend « 2026-10-31 », que `new Date()` lit comme minuit. Ranger
 * cet instant ferait disparaître l'offre au premier tic du 31 — la veille du
 * jour que l'annonceur croit avoir donné.
 *
 * L'interprétation vit ici, à la saisie, et nulle part ailleurs : la mettre à
 * la lecture la disperserait dans chaque écran, et l'un d'eux l'oublierait.
 */
function lireEcheance(
  brut: string,
  maintenant: Date,
):
  | { ok: true; valeur: Date | null }
  | { ok: false; refus: { ok: false; refus: Refus } } {
  const propre = brut.trim();
  if (propre.length === 0) return { ok: true, valeur: null };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(propre)) {
    return { ok: false, refus: refus("echeance", "Date attendue au format JJ/MM/AAAA.") };
  }

  const valeur = new Date(`${propre}T23:59:59.999Z`);
  if (Number.isNaN(valeur.getTime())) {
    return { ok: false, refus: refus("echeance", "Cette date n'existe pas.") };
  }

  if (valeur <= maintenant) {
    return {
      ok: false,
      refus: refus("echeance", "L'échéance est déjà passée : l'offre ne paraîtrait pas."),
    };
  }

  const limite = new Date(maintenant.getTime() + ECHEANCE_MAX_JOURS * 86_400_000);
  if (valeur > limite) {
    return {
      ok: false,
      refus: refus("echeance", "Une offre ne peut pas courir plus d'un an."),
    };
  }

  return { ok: true, valeur };
}

/**
 * Où postuler — et le contrôle le plus important de ce fichier.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UNE URL EXTERNE EST LE VECTEUR D'ARNAQUE LE PLUS DIRECT DU PROJET
 *
 * Une adresse d'hameçonnage déposée sous couvert d'offre d'emploi profite de la
 * confiance que le site lui prête. On ne peut pas décider ici si elle est
 * honnête — c'est le travail du modérateur, qui la verra en entier. Mais on
 * peut écarter ce qui n'a aucune raison d'être là :
 *
 *   — tout ce qui n'est pas `https`. `javascript:` et `data:` sont des
 *     injections déguisées en lien ; `http` en clair conduit un candidat à
 *     envoyer son CV sans chiffrement ;
 *   — les adresses qui pointent chez nous. Une offre qui renvoie sur Baobart
 *     n'est pas externe : elle emprunte notre nom pour rassurer.
 *
 * Le serveur ne suit **jamais** cette adresse. Pas d'aperçu, pas de logo
 * récupéré, pas de vérification automatique : ce serait offrir une requête
 * sortante à quiconque dépose une offre.
 */
function lirePostuler(
  brutMode: string,
  brutUrl: string,
):
  | { ok: true; mode: ApplyMode; url: string | null }
  | { ok: false; refus: { ok: false; refus: Refus } } {
  const externe = brutMode === "EXTERNE";

  if (!externe) {
    // Les deux modes s'excluent : une URL laissée par mégarde ne doit pas
    // survivre au changement d'avis de l'annonceur.
    return { ok: true, mode: "BAOBART", url: null };
  }

  const url = brutUrl.trim();
  if (url.length === 0) {
    return {
      ok: false,
      refus: refus("urlExterne", "Indique l'adresse où postuler."),
    };
  }
  if (url.length > URL_MAX) {
    return { ok: false, refus: refus("urlExterne", "Cette adresse est trop longue.") };
  }

  let analysee: URL;
  try {
    analysee = new URL(url);
  } catch {
    return {
      ok: false,
      refus: refus("urlExterne", "Cette adresse n'est pas une URL valide."),
    };
  }

  if (analysee.protocol !== "https:") {
    return {
      ok: false,
      refus: refus(
        "urlExterne",
        "L'adresse doit commencer par https:// — un candidat y enverra ses informations.",
      ),
    };
  }

  return { ok: true, mode: "EXTERNE", url: analysee.toString() };
}

/**
 * L'adresse pointe-t-elle chez nous ?
 *
 * Séparé de la validation parce que le domaine du site n'est pas connu d'un
 * module pur — l'appelant le fournit. Une offre « externe » qui renvoie sur
 * Baobart emprunte notre nom pour rassurer.
 */
export function pointeVersNous(url: string, notreHote: string | null): boolean {
  if (!notreHote) return false;
  try {
    return new URL(url).host.toLowerCase() === notreHote.toLowerCase();
  } catch {
    return false;
  }
}
