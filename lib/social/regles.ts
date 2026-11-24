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

// ──────────────────────────────────────────────────────────────── abonnés ──

/** Ce que la base dit d'un abonné, avant de décider ce qu'on en montre. */
export interface AbonneBrut {
  userId: string;
  suitDepuis: Date;
  suspendu: boolean;
  /** Ressources PUBLISHED : sans aucune, pas de vitrine (`profilPublic`). */
  ressourcesPubliees: number;
  profil: {
    displayName: string;
    username: string;
    speciality: string | null;
    city: string | null;
    avatarUrl: string | null;
    acceptsMessages: boolean;
  } | null;
}

/** Ce qu'un créateur voit de quelqu'un qui le suit (maquette `c_abonnes`). */
export interface AbonneVu {
  userId: string;
  nom: string;
  /** « Illustration · Dakar » : ce que sa vitrine affiche déjà. Nul sans vitrine. */
  presentation: string | null;
  avatarUrl: string | null;
  /** `/@pseudo`, s'il a une vitrine. */
  vitrine: string | null;
  /** Où mène « Message » ; nul quand rien n'y mène. */
  ecrire: string | null;
  suitDepuis: Date;
}

/**
 * Ce qu'un créateur a le droit de voir de quelqu'un qui le suit.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * RIEN QUE CE QUI EST DÉJÀ PUBLIC
 *
 * Le nom affiché, pour tout le monde : il signe déjà les commentaires
 * (`commentairesDe`), et la page de confidentialité dit que le créateur suivi
 * le voit. Le reste — spécialité, ville, photo, l'adresse de sa vitrine —
 * seulement si l'abonné a une vitrine, c'est-à-dire s'il l'a lui-même rendu
 * public. Un acheteur qui a rempli sa ville dans son profil ne l'a montrée à
 * personne : la lui faire sortir parce qu'il a cliqué « Suivre » serait une
 * fuite.
 *
 * La vitrine suit la règle de `profilPublic` (lib/createurs/queries.ts) : un
 * profil, au moins une ressource publiée, et un compte non suspendu. Un abonné
 * suspendu reste dans la liste, sans rien de plus que son nom : le retirer
 * ferait mentir le total, et dire « suspendu » révélerait une sanction.
 *
 * « Message » mène à sa vitrine, fenêtre de contact ouverte (`#contact`) —
 * seulement s'il accepte les messages. Le bouton qui mène à un refus n'a rien
 * à montrer (même règle que la vitrine elle-même).
 */
export function presenterAbonne(b: AbonneBrut): AbonneVu {
  const p = b.profil;
  const aUneVitrine = p !== null && !b.suspendu && b.ressourcesPubliees > 0;
  const nom = p?.displayName.trim() || "Membre Baobart";

  if (!aUneVitrine) {
    return { userId: b.userId, nom, presentation: null, avatarUrl: null, vitrine: null, ecrire: null, suitDepuis: b.suitDepuis };
  }

  const presentation = [p.speciality?.trim(), p.city?.trim()].filter(Boolean).join(" · ") || null;
  const vitrine = `/@${p.username}`;
  return {
    userId: b.userId,
    nom,
    presentation,
    avatarUrl: p.avatarUrl,
    vitrine,
    ecrire: p.acceptsMessages ? `${vitrine}#contact` : null,
    suitDepuis: b.suitDepuis,
  };
}

/** « 1 240 personnes suivent ton travail. » — le nombre exact, pas « 1,2 k » : c'est sa liste. */
export function phraseDesAbonnes(total: number): string {
  if (total === 0) return "Personne ne suit encore ton travail.";
  const n = new Intl.NumberFormat("fr-FR").format(total);
  return total === 1 ? `${n} personne suit ton travail.` : `${n} personnes suivent ton travail.`;
}

/**
 * « te suit depuis 3 j », « te suit depuis le 12 nov. » — la ligne d'un abonné
 * sans vitrine. Bâtie sur `ilYA`, dont les trois formes ne se raccordent pas
 * pareil à « depuis » : « à l'instant », « il y a … », une date.
 */
export function suitDepuis(
  quand: Date,
  maintenant: Date = new Date(),
  // « tu suis » pour un créateur que l'on suit (lot 5b, les cartes de « Suivre les détails »).
  sujet: "te suit" | "tu suis" = "te suit",
): string {
  const relatif = ilYA(quand, maintenant);
  if (relatif === "à l'instant") return `${sujet} depuis un instant`;
  if (relatif.startsWith("il y a ")) return `${sujet} depuis ${relatif.slice("il y a ".length)}`;
  return `${sujet} depuis le ${relatif}`;
}

// ─────────────────────────────────────────────────── l'avis « Nouvel abonné » ──

/**
 * La clé de l'avis « Nouvel abonné » : une par couple (suiveur, créateur), pour
 * qu'un suivi défait puis refait ne prévienne pas deux fois (`basculerSuiviDe`).
 *
 * Elle commence par le suiveur, et c'est voulu : depuis le 21/11, l'avis porte
 * son NOM (décision du responsable). Effacer son compte doit donc retirer ces
 * avis chez chaque créateur qu'il suivait — `prefixeAvisAbonne` les retrouve
 * tous d'un seul `startsWith` (lib/rgpd/effacement.ts). Le tiret final compte :
 * sans lui, un identifiant serait le préfixe d'un autre plus long.
 */
export function cleAvisAbonne(suiveurId: string, createurId: string): string {
  return `${prefixeAvisAbonne(suiveurId)}${createurId}`;
}

export function prefixeAvisAbonne(suiveurId: string): string {
  return `abonne-${suiveurId}-`;
}

/** Le nom que l'avis donne au suiveur : son nom affiché, jamais son adresse. */
export function nomDansLAvis(displayName: string | null | undefined): string {
  return displayName?.trim() || "Un membre Baobart";
}

// ─────────────────────────────────────────── le fil « Suivre les détails » ──

export type EtatDansLeFil = "NOUVEAU" | "VU";

/**
 * « NOUVEAU » ou « VU », pour une ligne du fil (maquette `c_suivre`, lot 5b).
 *
 * « NOUVEAU » veut dire : publiée depuis ta dernière visite du fil. Qui n'est
 * jamais venu voit tout « NOUVEAU » — c'est vrai, il n'a rien vu. La visite
 * se mémorise APRÈS l'affichage (`marquerFilVu`, lib/social/fil.ts) : la page
 * qui montre « NOUVEAU » ne se dément pas elle-même pendant qu'on la lit.
 */
export function etatDansLeFil(publieeLe: Date, vuJusquA: Date | null): EtatDansLeFil {
  return vuJusquA === null || publieeLe > vuJusquA ? "NOUVEAU" : "VU";
}

/**
 * Le lundi 0 h de la semaine de `maintenant` : « Publications suivies · cette
 * semaine ». En UTC, pour la raison écrite dans `lib/dashboard/mois.ts` :
 * l'heure légale d'Abidjan est l'heure universelle toute l'année.
 */
export function debutDeSemaine(maintenant: Date): Date {
  const depuisLundi = (maintenant.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate() - depuisLundi));
}

/**
 * Jusqu'où avancer la marque « fil vu », ou `null` s'il n'y a rien à écrire.
 *
 * Le navigateur propose l'instant où la page a été rendue — pas l'instant où
 * il répond : une ressource parue entre les deux n'a pas été vue. On ne le
 * croit pas pour autant : une date illisible ne s'écrit pas, une date future
 * est ramenée à maintenant, et la marque ne recule jamais (deux onglets).
 */
export function avancerVuJusquA(propose: Date, actuel: Date | null, maintenant: Date): Date | null {
  if (Number.isNaN(propose.getTime())) return null;
  const borne = propose > maintenant ? maintenant : propose;
  if (actuel !== null && borne <= actuel) return null;
  return borne;
}
