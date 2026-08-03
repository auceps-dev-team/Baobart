/**
 * Règles du like, du suivi et du commentaire.
 *
 * Module pur : ni base, ni session. Ce qui décide d'un refus se teste sans
 * monter un Postgres, et se relit sans suivre une jointure.
 */

// ───────────────────────────────────────────────────────────── commentaire ──

/** Au-delà, ce n'est plus un commentaire mais un article. */
export const COMMENTAIRE_MAX = 1200;

/** En deçà, il n'y a rien à publier. */
export const COMMENTAIRE_MIN = 2;

/** Profondeur du fil : une réponse, pas une réponse à une réponse à une… */
export const PROFONDEUR_MAX = 1;

export type RefusCommentaire =
  | "VIDE"
  | "TROP_COURT"
  | "TROP_LONG"
  | "TROP_PROFOND";

export interface VerdictCommentaire {
  accepte: boolean;
  refus?: RefusCommentaire;
  message?: string;
  /** Corps nettoyé, prêt à enregistrer. */
  corps?: string;
}

const MESSAGES: Record<RefusCommentaire, string> = {
  VIDE: "Écris quelque chose avant de publier.",
  TROP_COURT: "Un commentaire d'un seul caractère n'apprend rien à personne.",
  TROP_LONG: `Un commentaire ne peut pas dépasser ${COMMENTAIRE_MAX} caractères.`,
  TROP_PROFOND:
    "On ne peut répondre qu'à un commentaire, pas à une réponse. Réponds au commentaire d'origine.",
};

/**
 * Nettoie et valide un commentaire.
 *
 * Les espaces de bord tombent, et les lignes vides en série sont ramenées à
 * deux : coller trente retours à la ligne pour occuper l'écran est un abus,
 * pas une mise en forme.
 */
export function verifierCommentaire(input: {
  corps: string;
  /** Profondeur du parent, ou `null` si le commentaire est à la racine. */
  profondeurParent?: number | null;
}): VerdictCommentaire {
  const corps = input.corps
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (corps.length === 0) {
    return { accepte: false, refus: "VIDE", message: MESSAGES.VIDE };
  }
  if (corps.length < COMMENTAIRE_MIN) {
    return { accepte: false, refus: "TROP_COURT", message: MESSAGES.TROP_COURT };
  }
  if (corps.length > COMMENTAIRE_MAX) {
    return { accepte: false, refus: "TROP_LONG", message: MESSAGES.TROP_LONG };
  }

  const profondeur = input.profondeurParent;
  if (profondeur !== null && profondeur !== undefined && profondeur >= PROFONDEUR_MAX) {
    return {
      accepte: false,
      refus: "TROP_PROFOND",
      message: MESSAGES.TROP_PROFOND,
    };
  }

  return { accepte: true, corps };
}

/**
 * Qui peut retirer un commentaire ?
 *
 * Son auteur, et le créateur de la ressource commentée. Le second point n'est
 * pas de la censure : sans lui, un créateur n'a aucun moyen de retirer une
 * insulte de sa propre vitrine, et devrait attendre une modération qui n'existe
 * pas encore.
 */
export function peutRetirerCommentaire(input: {
  userId: string;
  auteurId: string;
  proprietaireId: string;
}): boolean {
  return input.userId === input.auteurId || input.userId === input.proprietaireId;
}

/** Texte affiché à la place d'un commentaire retiré. */
export const COMMENTAIRE_RETIRE = "Commentaire retiré.";

// ─────────────────────────────────────────────────────────────────── suivi ──

export type RefusSuivi = "SOI_MEME" | "INCONNU";

export function verifierSuivi(input: {
  suiveurId: string;
  suiviId: string;
}): { accepte: boolean; refus?: RefusSuivi; message?: string } {
  if (input.suiveurId === input.suiviId) {
    return {
      accepte: false,
      refus: "SOI_MEME",
      message: "On ne peut pas se suivre soi-même.",
    };
  }
  if (input.suiviId.length === 0) {
    return { accepte: false, refus: "INCONNU", message: "Créateur introuvable." };
  }
  return { accepte: true };
}

// ──────────────────────────────────────────────────────────── compteurs ─────

/**
 * Compteur après bascule, jamais négatif.
 *
 * Un compteur dénormalisé peut dériver — une suppression en base, une reprise
 * de données. Le laisser passer sous zéro afficherait « −1 j'aime », ce qui
 * signale un bug au visiteur plutôt qu'au développeur.
 */
export function compteurApresBascule(actuel: number, ajoute: boolean): number {
  return Math.max(0, actuel + (ajoute ? 1 : -1));
}

// ────────────────────────────────────────────────────────────── affichage ───

/**
 * « il y a 2 h », « il y a 3 j » — comme la maquette.
 *
 * Au-delà d'une semaine on donne la date : « il y a 34 j » ne dit plus rien à
 * personne.
 */
export function ilYA(quand: Date, maintenant: Date = new Date()): string {
  const secondes = Math.floor((maintenant.getTime() - quand.getTime()) / 1000);

  if (secondes < 60) return "à l'instant";
  if (secondes < 3600) return `il y a ${Math.floor(secondes / 60)} min`;
  if (secondes < 86_400) return `il y a ${Math.floor(secondes / 3600)} h`;

  const jours = Math.floor(secondes / 86_400);
  if (jours <= 7) return `il y a ${jours} j`;

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: quand.getFullYear() === maintenant.getFullYear() ? undefined : "numeric",
  }).format(quand);
}
