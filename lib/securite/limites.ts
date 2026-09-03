/**
 * Les règles de limitation, et le calcul qui les applique.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE MODULE EST PUR
 *
 * Décider « ce compteur dépasse-t-il la limite ? » n'a besoin ni de Redis ni du
 * réseau. Le séparer permet d'éprouver la fenêtre glissante — la seule partie
 * où l'on peut se tromper silencieusement — sans monter d'infrastructure.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI UNE FENÊTRE GLISSANTE ET PAS UN SIMPLE COMPTEUR
 *
 * Un compteur remis à zéro toutes les minutes laisse passer **deux fois la
 * limite** : dix tentatives à 59 secondes, dix autres à 61. Pour une page de
 * connexion, cela double la vitesse d'une attaque par dictionnaire sans qu'on
 * s'en aperçoive.
 *
 * La fenêtre glissante pondère le seau précédent par ce qu'il en reste :
 *
 *     estimation = precedent × (part du seau précédent encore couverte) + courant
 *
 * Ce n'est pas exact — on suppose les requêtes réparties uniformément dans le
 * seau précédent — mais l'erreur est bornée et va toujours dans le sens de la
 * prudence près de la bascule. Un journal horodaté serait exact et coûterait
 * une entrée par requête ; on refuse ce prix pour une précision dont personne
 * n'a besoin.
 */

export interface Regle {
  /** Nombre de gestes autorisés sur la fenêtre. */
  quota: number;
  /** Largeur de la fenêtre, en millisecondes. */
  fenetreMs: number;
}

/**
 * Ce que chaque route s'autorise.
 *
 * Les valeurs ne sont pas des devinettes : chacune part de ce qu'un usage
 * légitime demande, avec de la marge, puis on regarde ce que cela laisse à un
 * attaquant.
 */
export const REGLES = {
  /**
   * Connexion. Dix essais par quart d'heure et par adresse.
   *
   * Quelqu'un qui hésite entre deux mots de passe en fait trois ou quatre. Dix
   * couvre largement, et ramène une attaque par dictionnaire à moins de mille
   * essais par jour — assez lent pour que le compte soit protégé par la seule
   * longueur du mot de passe.
   */
  connexion: { quota: 10, fenetreMs: 15 * 60_000 },

  /**
   * Inscription. Cinq comptes par heure et par adresse.
   *
   * Une famille derrière un même routeur peut en créer plusieurs le même jour ;
   * cinq par heure ne gêne personne et arrête la création en masse.
   */
  inscription: { quota: 5, fenetreMs: 60 * 60_000 },

  /**
   * Oubli de mot de passe. Cinq demandes par quart d'heure et par adresse.
   *
   * Il existe déjà un plafond **par compte** (trois par quart d'heure, cf.
   * `lib/auth/reinitialisation.ts`). Celui-ci est par adresse, et il couvre
   * autre chose : quelqu'un qui essaie cent adresses différentes pour savoir
   * lesquelles sont chez nous. Le silence de la réponse ne suffit pas si l'on
   * peut poser la question mille fois.
   */
  oubli: { quota: 5, fenetreMs: 15 * 60_000 },

  /**
   * Dépôt d'une offre d'emploi. Cinq par heure et par adresse.
   *
   * ───────────────────────────────────────────────────────────────────
   * ELLE PROTÈGE LA FILE DE MODÉRATION, PAS LA BASE
   *
   * Déposer exige un compte (§18.2 de la spec admin), donc l'écriture n'est pas
   * anonyme. Ce qu'on borne ici est autre chose : quelqu'un qui déposerait
   * quarante offres en dix minutes noierait la file de relecture, et les vraies
   * offres attendraient derrière.
   *
   * Un recruteur honnête publie une offre, parfois deux. Cinq par heure ne gêne
   * personne.
   */
  "job.depot": { quota: 5, fenetreMs: 60 * 60_000 },

  /**
   * Candidature. Vingt par heure et par adresse.
   *
   * Postuler beaucoup est normal quand on cherche du travail — c'est même le
   * comportement qu'on veut encourager. La borne n'existe que contre l'envoi
   * automatisé : l'unicité (une candidature par offre et par personne) fait
   * déjà le gros du travail.
   */
  "job.candidature": { quota: 20, fenetreMs: 60 * 60_000 },

  /**
   * Rappel d'opérateur de paiement. Trois cents par minute.
   *
   * Volontairement large : un opérateur qui rattrape un incident peut envoyer
   * des centaines de rappels d'un coup, et les refuser coûterait des ventes.
   * La borne existe pour l'inconnu qui frappe la route sans signature, pas pour
   * l'opérateur — et les appels refusés ont déjà leur propre plafond de traces.
   */
  rappelPaiement: { quota: 300, fenetreMs: 60_000 },
} as const satisfies Record<string, Regle>;

export type NomRegle = keyof typeof REGLES;

export interface Verdict {
  /** Le geste est-il autorisé ? */
  autorise: boolean;
  /** Ce qu'il reste, une fois celui-ci compté. Jamais négatif. */
  restant: number;
  /** Dans combien de temps la fenêtre libère de la place, en secondes. */
  dansSecondes: number;
}

/**
 * Applique la fenêtre glissante à deux compteurs déjà lus.
 *
 * `courant` inclut le geste qu'on est en train d'évaluer : on compte d'abord,
 * on décide ensuite. L'inverse laisserait passer deux requêtes simultanées qui
 * liraient toutes deux la valeur d'avant.
 */
export function juger(input: {
  precedent: number;
  courant: number;
  regle: Regle;
  /** Millisecondes écoulées depuis le début du seau courant. */
  ecouleMs: number;
}): Verdict {
  const { precedent, courant, regle, ecouleMs } = input;

  // Part du seau précédent encore couverte par la fenêtre. À l'instant où un
  // seau commence, le précédent compte pour presque tout ; à sa fin, pour rien.
  const part = Math.max(0, 1 - ecouleMs / regle.fenetreMs);
  const estimation = precedent * part + courant;

  const restant = Math.max(0, regle.quota - Math.ceil(estimation));

  return {
    autorise: estimation <= regle.quota,
    restant,
    // Le temps qu'il reste au seau courant : c'est le moment où l'estimation
    // baissera pour de bon.
    dansSecondes: Math.max(1, Math.ceil((regle.fenetreMs - ecouleMs) / 1000)),
  };
}

/**
 * La clé d'un compteur.
 *
 * Le nom de la règle y figure : sans lui, les tentatives de connexion et les
 * demandes d'oubli d'une même adresse se compteraient ensemble, et l'une
 * fermerait l'autre.
 *
 * Le numéro de seau y figure aussi, ce qui fait qu'un seau périmé n'est jamais
 * relu — il expire tout seul et personne ne le nettoie.
 */
export function cleDe(regle: NomRegle, sujet: string, seau: number): string {
  return `lim:${regle}:${sujet}:${seau}`;
}

/** Le numéro du seau courant, et l'avancée dedans. */
export function seauDe(
  maintenantMs: number,
  regle: Regle,
): { seau: number; ecouleMs: number } {
  const seau = Math.floor(maintenantMs / regle.fenetreMs);
  return { seau, ecouleMs: maintenantMs - seau * regle.fenetreMs };
}
