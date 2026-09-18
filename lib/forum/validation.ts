import { slugifier } from "@/lib/products/validation";

/**
 * Ce qu'on accepte d'écrire dans un forum.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES SEUILS SONT PLUS BAS QUE PARTOUT AILLEURS, ET C'EST VOULU
 *
 * Un article de blog exige 200 signes, un événement 60. Un message de forum en
 * demande 2.
 *
 * « Merci ! », « Oui, la plastisol marche », « ↑ ça » : ce sont de vrais
 * messages, et ce sont même les plus fréquents dans une conversation qui
 * fonctionne. Un seuil qui les refuse ne relève pas le niveau — il apprend aux
 * gens à écrire trois phrases creuses pour passer, ou à se taire.
 *
 * Le plafond, lui, existe : il protège la base et l'affichage, pas la qualité.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE MODULE EST PUR
 *
 * Il ne sait pas qui écrit ni où — les droits vivent dans `acces.ts`, et
 * l'unicité d'un slug dans `redaction.ts`. Ici, seulement la forme.
 */

export type Champ = "nom" | "description" | "titre" | "corps";

export interface Refus {
  champ: Champ;
  message: string;
}

export type Verdict<T> = { ok: true; valeur: T } | { ok: false; refus: Refus };

// ── Une communauté ──────────────────────────────────────────────────────────

const NOM_MIN = 3;
const NOM_MAX = 60;
const DESCRIPTION_MAX = 600;

export interface SaisieCommunaute {
  nom: string;
  description: string;
  visibilite: string;
}

export interface CommunauteValide {
  nom: string;
  slug: string;
  description: string | null;
  visibilite: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
}

const VISIBILITES = ["PUBLIC", "PRIVATE", "INVITE_ONLY"] as const;

export function validerCommunaute(
  saisie: SaisieCommunaute,
): Verdict<CommunauteValide> {
  const nom = saisie.nom.trim().replace(/\s+/g, " ");

  if (nom.length < NOM_MIN) {
    return refus("nom", `Le nom fait au moins ${NOM_MIN} caractères.`);
  }
  if (nom.length > NOM_MAX) {
    return refus("nom", `Le nom ne dépasse pas ${NOM_MAX} caractères.`);
  }

  const slug = slugifier(nom);
  if (slug.length === 0) {
    return refus(
      "nom",
      "Le nom doit contenir des lettres ou des chiffres : c'est lui qui fait l'adresse.",
    );
  }

  const description = saisie.description.trim();
  if (description.length > DESCRIPTION_MAX) {
    return refus(
      "description",
      `La description ne dépasse pas ${DESCRIPTION_MAX} caractères.`,
    );
  }

  // Une visibilité inconnue vaut la plus fermée, jamais la plus ouverte.
  //
  // C'est la règle à ne pas inverser : un formulaire trafiqué, un champ
  // renommé, une valeur ajoutée à l'enum sans mettre ce fichier à jour — dans
  // les trois cas, l'erreur doit fermer.
  const demandee = saisie.visibilite.trim().toUpperCase();
  const visibilite = (VISIBILITES as readonly string[]).includes(demandee)
    ? (demandee as CommunauteValide["visibilite"])
    : "INVITE_ONLY";

  return {
    ok: true,
    valeur: {
      nom,
      slug,
      description: description.length > 0 ? description : null,
      visibilite,
    },
  };
}

// ── Un sujet ────────────────────────────────────────────────────────────────

const TITRE_MIN = 4;
const TITRE_MAX = 140;

export interface SaisieSujet {
  titre: string;
  corps: string;
}

export interface SujetValide {
  titre: string;
  corps: string;
}

export function validerSujet(saisie: SaisieSujet): Verdict<SujetValide> {
  const titre = saisie.titre.trim().replace(/\s+/g, " ");

  if (titre.length < TITRE_MIN) {
    return refus("titre", `Le titre fait au moins ${TITRE_MIN} caractères.`);
  }
  if (titre.length > TITRE_MAX) {
    return refus("titre", `Le titre ne dépasse pas ${TITRE_MAX} caractères.`);
  }

  const message = validerMessage({ corps: saisie.corps });
  if (!message.ok) return message;

  return { ok: true, valeur: { titre, corps: message.valeur.corps } };
}

// ── Un message ──────────────────────────────────────────────────────────────

const CORPS_MIN = 2;
const CORPS_MAX = 20_000;

export interface SaisieMessage {
  corps: string;
}

export function validerMessage(
  saisie: SaisieMessage,
): Verdict<{ corps: string }> {
  const corps = saisie.corps.trim();

  if (corps.length < CORPS_MIN) {
    // Pas de seuil moral : « Merci ! » est un vrai message. On refuse le vide,
    // et c'est tout.
    return refus("corps", "Écris quelque chose.");
  }
  if (corps.length > CORPS_MAX) {
    return refus(
      "corps",
      `Un message ne dépasse pas ${CORPS_MAX} caractères — au-delà, c'est un article.`,
    );
  }

  return { ok: true, valeur: { corps } };
}

function refus<T>(champ: Champ, message: string): Verdict<T> {
  return { ok: false, refus: { champ, message } };
}
