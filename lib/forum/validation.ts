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
}

export interface CommunauteValide {
  nom: string;
  slug: string;
  description: string | null;
  visibilite: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
}

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

  return {
    ok: true,
    valeur: {
      nom,
      slug,
      description: description.length > 0 ? description : null,
      // ══════════════════════════════════════════════════════════════════════
      // TOUTES LES COMMUNAUTÉS SONT OUVERTES, ET CE N'EST PAS UN OUBLI
      //
      // Le formulaire ne propose plus le choix, et cette fonction ne le lit
      // plus : une communauté créée aujourd'hui est PUBLIC, sans exception.
      //
      // La raison est le manque qu'on avait livré avec : adhérer à une privée
      // était REFUSÉ, faute de table de demandes d'adhésion. Un réglage dont
      // la moitié des valeurs mène à une porte close n'est pas un réglage,
      // c'est un piège — et la maquette n'en dessine aucun.
      //
      // `acces.ts` continue de traiter PRIVATE et INVITE_ONLY correctement.
      // C'est délibéré : si une ligne porte encore l'une des deux — jeu
      // d'essai, base de développement, retour arrière — elle doit rester
      // fermée. On a retiré la façon d'en créer, pas la règle qui les protège.
      visibilite: "PUBLIC" as const,
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
