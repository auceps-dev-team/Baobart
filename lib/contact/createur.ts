/**
 * Le bouton « Contact » d'une vitrine — ce qu'un message doit porter, et qui
 * a le droit de l'envoyer.
 *
 * Module pur : l'action, la page et les tests lisent les mêmes bornes.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'ADRESSE DU CRÉATEUR NE SORT PAS
 *
 * Baobart relaie : le message part par courriel à l'adresse du compte du
 * créateur, avec celle de l'expéditeur en « Répondre à ». Le créateur voit à
 * qui il répond ; l'expéditeur ne voit l'adresse du créateur que si celui-ci
 * répond. Aucune page, aucune réponse d'action ne la porte.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL FAUT UN COMPTE POUR ÉCRIRE
 *
 * Décidé le 18/10. Le formulaire Contact de l'équipe s'ouvre sans compte —
 * on écrit souvent au support parce qu'on n'arrive plus à se connecter. Ici,
 * non : le message arrive dans la boîte personnelle de quelqu'un. Avec un
 * compte, l'adresse de réponse est celle qu'on a donnée en s'inscrivant (pas
 * une adresse tapée au hasard, qui ferait répondre le créateur à un tiers),
 * un abus se rattache à quelqu'un, et une suspension y met fin.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX PLAFONDS, COMPTÉS EN BASE
 *
 * Par expéditeur et par jour, et par paire expéditeur-créateur. Comptés sur
 * la table des messages plutôt qu'en mémoire : le plafond survit à un
 * redémarrage, et ne dépend pas du pilote de limitation choisi. Le plafond par
 * adresse (`contact.createur`, lib/securite/limites.ts) arrête seulement les
 * rafales avant qu'elles n'atteignent la base.
 */

export const SUJET_MIN = 3;
export const SUJET_MAX = 120;
export const CORPS_MIN = 20;
export const CORPS_MAX = 4000;

/** Messages qu'un même compte peut laisser en vingt-quatre heures, tous créateurs confondus. */
export const PLAFOND_PAR_JOUR = 10;
/** Messages qu'un même compte peut laisser au même créateur en vingt-quatre heures. */
export const PLAFOND_PAR_CREATEUR = 3;
export const FENETRE_MS = 24 * 60 * 60_000;

export type ChampMessage = "sujet" | "corps";

export type Lecture =
  | { ok: true; sujet: string; corps: string }
  | { ok: false; champ: ChampMessage; message: string };

export function lireMessage(brut: { sujet: string; corps: string }): Lecture {
  // Le sujet finit dans l'objet du courriel : une ligne, sans retour.
  const sujet = brut.sujet.replace(/\s+/g, " ").trim();
  const corps = brut.corps.replace(/\r\n?/g, "\n").trim();

  if (sujet.length < SUJET_MIN || sujet.length > SUJET_MAX) {
    return { ok: false, champ: "sujet", message: `Un sujet, entre ${SUJET_MIN} et ${SUJET_MAX} caractères.` };
  }
  if (corps.length < CORPS_MIN) {
    return { ok: false, champ: "corps", message: `Présente ta demande — ${CORPS_MIN} caractères au moins.` };
  }
  if (corps.length > CORPS_MAX) {
    return { ok: false, champ: "corps", message: `${CORPS_MAX} caractères au plus.` };
  }
  return { ok: true, sujet, corps };
}

export type Refus = "SOI_MEME" | "FERME" | "PLAFOND_JOUR" | "PLAFOND_CREATEUR";

/**
 * Peut-on écrire à ce créateur ?
 *
 * Le créateur introuvable ou suspendu n'est pas un cas d'ici : l'appelant ne
 * le trouve pas, et répond comme pour une vitrine qui n'existe pas.
 */
export function decider(entree: {
  expediteurId: string;
  destinataireId: string;
  ouvert: boolean;
  envoyesAujourdhui: number;
  envoyesAuCreateur: number;
}): { ok: true } | { ok: false; refus: Refus } {
  if (entree.expediteurId === entree.destinataireId) return { ok: false, refus: "SOI_MEME" };
  if (!entree.ouvert) return { ok: false, refus: "FERME" };
  if (entree.envoyesAuCreateur >= PLAFOND_PAR_CREATEUR) return { ok: false, refus: "PLAFOND_CREATEUR" };
  if (entree.envoyesAujourdhui >= PLAFOND_PAR_JOUR) return { ok: false, refus: "PLAFOND_JOUR" };
  return { ok: true };
}

export const MESSAGES_DE_REFUS: Record<Refus, string> = {
  SOI_MEME: "C'est ta propre vitrine.",
  FERME: "Ce créateur ne reçoit pas de messages pour le moment.",
  PLAFOND_CREATEUR: `Tu lui as déjà écrit ${PLAFOND_PAR_CREATEUR} fois aujourd'hui : laisse-lui le temps de répondre.`,
  PLAFOND_JOUR: `Tu as déjà envoyé ${PLAFOND_PAR_JOUR} messages aujourd'hui. Réessaie demain.`,
};
