/**
 * Le cycle de vie d'un contenu, quel qu'il soit.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN SEUL CYCLE POUR LES QUATRE CMS
 *
 * Offres d'emploi, services, événements, articles : ce sont quatre contenus
 * très différents qui traversent exactement les mêmes états. Leur écrire quatre
 * machines jumelles garantirait qu'elles divergent — et le jour où l'une oublie
 * un cas, ce sera celle qu'on relit le moins.
 *
 * Les quatre n'empruntent pas tout le chemin, et c'est voulu : un article écrit
 * par l'administration saute la soumission, parce que son auteur avait déjà le
 * droit de publier. Un état non emprunté ne coûte rien ; un état manquant coûte
 * une réécriture.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE MODULE NE SAIT PAS QUI DEMANDE
 *
 * Il dit quelles transitions existent, jamais qui a le droit de les faire. Le
 * droit vit dans `lib/cms/droits.ts`, qui croise rôle, badge et abonnement.
 *
 * Les séparer permet d'éprouver la machine sans monter une session — et évite
 * la faute classique : une garde écrite dans la transition, donc invisible
 * depuis l'écran qui l'appelle.
 */

export type EtatContenu =
  /** Écrit, pas encore envoyé. Visible de son seul auteur. */
  | "BROUILLON"
  /** Envoyé à la relecture. Visible de personne d'autre que l'administration. */
  | "SOUMIS"
  /** En ligne. */
  | "PUBLIE"
  /** Refusé à la relecture, avec un motif. Son auteur peut le reprendre. */
  | "REFUSE"
  /** Était en ligne, ne l'est plus. Ne se supprime pas. */
  | "RETIRE";

/**
 * Ce qu'on fait à un contenu.
 *
 * Nommé du point de vue de l'acte, pas de l'état d'arrivée : « refuser » dit ce
 * qu'un modérateur fait, « REFUSE » dit où le contenu atterrit. Les deux
 * existent, et les confondre rend les écrans illisibles.
 */
export type Geste =
  | "soumettre"
  | "publier"
  | "refuser"
  | "retirer"
  | "reprendre";

/**
 * Les transitions permises, et elles seules.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TROIS CHOIX QUI MÉRITENT D'ÊTRE DITS
 *
 * **`BROUILLON → PUBLIE` existe.** C'est le chemin du blog et des événements,
 * dont l'auteur a déjà le droit de publier. Le lui interdire l'obligerait à
 * s'auto-approuver, c'est-à-dire à faire semblant.
 *
 * **`REFUSE → SOUMIS` n'existe pas.** Un contenu refusé repasse par
 * `BROUILLON` : on le corrige avant de le renvoyer. Permettre de resoumettre
 * tel quel offrirait de saturer la file en cliquant.
 *
 * **Rien ne mène à une suppression.** `RETIRE` est terminal côté public et
 * réversible côté administration. Une offre d'emploi frauduleuse effacée
 * emporte la preuve de la fraude, et il n'y a rien à montrer au plaignant.
 */
const TRANSITIONS: Record<EtatContenu, Partial<Record<Geste, EtatContenu>>> = {
  BROUILLON: {
    soumettre: "SOUMIS",
    // Pour ceux qui portent déjà le droit de publier : blog, événements.
    publier: "PUBLIE",
  },
  SOUMIS: {
    publier: "PUBLIE",
    refuser: "REFUSE",
    // On peut retirer une soumission qu'on n'a pas encore lue — un compte
    // suspendu, par exemple : ses contenus en attente ne doivent plus paraître.
    retirer: "RETIRE",
  },
  PUBLIE: {
    retirer: "RETIRE",
  },
  REFUSE: {
    // Corriger, puis renvoyer. Jamais renvoyer tel quel.
    reprendre: "BROUILLON",
  },
  RETIRE: {
    // Remettre en ligne sans repasser par la relecture : ce qui a été retiré
    // par erreur se répare d'un geste, et l'audit garde les deux.
    publier: "PUBLIE",
    reprendre: "BROUILLON",
  },
};

export type Suite =
  | { ok: true; vers: EtatContenu }
  | { ok: false; motif: "TRANSITION_INTERDITE" };

/** La transition, ou un refus franc. Ne lève jamais. */
export function appliquer(depuis: EtatContenu, geste: Geste): Suite {
  const vers = TRANSITIONS[depuis]?.[geste];
  return vers ? { ok: true, vers } : { ok: false, motif: "TRANSITION_INTERDITE" };
}

/** Les gestes possibles depuis cet état — pour n'afficher que des boutons vivants. */
export function gestesDepuis(depuis: EtatContenu): Geste[] {
  return Object.keys(TRANSITIONS[depuis] ?? {}) as Geste[];
}

/**
 * Ce contenu est-il visible du public ?
 *
 * ───────────────────────────────────────────────────────────────────────
 * UNE SEULE PORTE, ET ELLE CONNAÎT L'ÉCHÉANCE
 *
 * Écrire `status === "PUBLIE"` à la main dans une requête est exactement ce qui,
 * un jour, laissera fuir une soumission non relue — ou affichera une offre
 * périmée depuis six mois.
 *
 * ───────────────────────────────────────────────────────────────────────
 * L'EXPIRATION SE DÉDUIT, ELLE NE S'ÉCRIT PAS
 *
 * Une offre expire à son échéance. La tentation est de faire passer un
 * ordonnanceur qui bascule l'état à minuit : ce serait une **seconde vérité**,
 * qui se désynchronise dès que le passage rate son tour — et l'offre resterait
 * en ligne jusqu'au lendemain, ou disparaîtrait sans que personne ne l'ait
 * décidé.
 *
 * C'est la même leçon que Ndank, qui déduit l'état d'un abonnement de ses dates
 * plutôt que de le ranger.
 *
 * `expireLe` est un instant. Le formulaire de dépôt range **la fin du jour**
 * choisi : « jusqu'au 31 octobre » veut dire que le 31 compte encore. Mettre
 * cette interprétation à la saisie plutôt qu'ici évite qu'elle se disperse.
 */
export function estPublic(
  etat: EtatContenu,
  expireLe?: Date | null,
  maintenant: Date = new Date(),
): boolean {
  if (etat !== "PUBLIE") return false;
  if (!expireLe) return true;
  return maintenant < expireLe;
}

/**
 * L'échéance est-elle passée ?
 *
 * Séparé de `estPublic` parce que les deux répondent à des questions
 * différentes : le public ne voit pas une offre périmée, mais son auteur doit
 * comprendre POURQUOI elle a disparu — et le dire « expirée » plutôt que
 * « retirée » lui évite de croire qu'on la lui a refusée.
 */
export function estExpire(
  expireLe: Date | null | undefined,
  maintenant: Date = new Date(),
): boolean {
  return expireLe !== null && expireLe !== undefined && maintenant >= expireLe;
}

/**
 * Attend-il une décision de l'administration ?
 *
 * C'est ce qui alimente la file de modération, et ce qui doit rester vrai quand
 * un quatrième CMS arrivera.
 */
export function attendUneRelecture(etat: EtatContenu): boolean {
  return etat === "SOUMIS";
}

// Il n'y a pas de `visiblePourSonAuteur` : un auteur voit TOUS ses contenus,
// quel que soit leur état. Une fonction qui rend toujours vrai laisse croire
// qu'il existe un cas où elle rend faux, et quelqu'un finira par l'appeler en
// pensant se protéger.

/** Libellés, pour les écrans. Le vocabulaire est celui de l'auteur, pas du code. */
export const LIBELLE_ETAT: Record<EtatContenu, string> = {
  BROUILLON: "Brouillon",
  SOUMIS: "En relecture",
  PUBLIE: "En ligne",
  REFUSE: "Refusé",
  RETIRE: "Retiré",
};

export const LIBELLE_GESTE: Record<Geste, string> = {
  soumettre: "Envoyer en relecture",
  publier: "Publier",
  refuser: "Refuser",
  retirer: "Retirer",
  reprendre: "Remettre en brouillon",
};
