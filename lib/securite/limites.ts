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
   * Dépôt d'un service. Cinq par heure et par adresse.
   *
   * ───────────────────────────────────────────────────────────────────
   * MÊME LOGIQUE QUE `job.depot`, MÊME QUOTA
   *
   * Publier un service demande davantage — vendeur, badge Freelance ou Agence,
   * abonnement — que déposer une offre d'emploi ; la limitation n'est donc
   * pas la première barrière. Elle protège la file de modération d'un compte
   * qui, une fois qualifié, publierait cinquante variantes de la même
   * prestation. Un créateur honnête en publie deux ou trois ; cinq par heure
   * laisse la porte grande ouverte.
   */
  "service.depot": { quota: 5, fenetreMs: 60 * 60_000 },

  /**
   * Inscription à un événement. Trente par heure et par adresse.
   *
   * ───────────────────────────────────────────────────────────────────
   * ELLE NE BORNE PAS L'INSCRIPTION, MAIS L'OSCILLATION
   *
   * L'unicité — une inscription par personne et par événement — empêche déjà
   * de prendre deux places. Ce qu'on borne ici est autre chose : quelqu'un qui
   * s'inscrit et se désinscrit en boucle ferait osciller le compteur de places
   * de l'événement, et chaque passage écrit deux fois en base.
   *
   * Trente gestes par heure ne gêne personne qui parcourt un calendrier —
   * même en changeant plusieurs fois d'avis.
   */
  "evenement.inscription": { quota: 30, fenetreMs: 60 * 60_000 },

  /**
   * Dépôt d'une notification juridique. Trois par heure et par adresse.
   *
   * ───────────────────────────────────────────────────────────────────
   * LA SEULE RÈGLE DE CETTE LISTE QUI PROTÈGE UNE ÉCRITURE ANONYME
   *
   * Toutes les autres bornent un geste qui exige déjà un compte : `job.depot`
   * et `service.depot` protègent la file de modération, pas la base, parce
   * qu'on sait qui dépose.
   *
   * Le dépôt d'une notification, non. Il est **ouvert sans session**, et c'est
   * voulu : l'article 47 de la loi ivoirienne n° 2013-451 parle de « la victime
   * ou d'une personne intéressée », sans autre qualité, et exiger une
   * inscription pour pouvoir se plaindre poserait une condition que la loi ne
   * pose pas. Voir `app/signalement/deposer/page.tsx`.
   *
   * Cette borne est donc la seule chose entre le formulaire et la base.
   *
   * ───────────────────────────────────────────────────────────────────
   * POURQUOI TROIS, ET PAS CINQ COMME LES DÉPÔTS
   *
   * Parce que le geste n'a pas le même effet. Une offre d'emploi en trop fait
   * une ligne de plus dans une file ; une notification en trop fait retirer le
   * travail de quelqu'un. Et parce qu'elle n'a pas la même fréquence : on
   * notifie une contrefaçon, pas dix par après-midi.
   *
   * Quelqu'un qui découvre que son portfolio entier a été recopié peut avoir
   * besoin de plusieurs dossiers — mais l'article 47 demande une
   * « localisation précise », pas un dossier par fichier : plusieurs adresses
   * tiennent dans une seule notification, une par ligne. Trois par heure
   * couvre le cas honnête et arrête le dépôt automatisé.
   *
   * Ce que ça ne règle pas : quelqu'un de patient. Une limite par adresse ne
   * borne pas un acharnement lent, et rien ici ne le fera — c'est l'article 49,
   * qui punit la mauvaise foi d'un à cinq ans, qui répond à ce cas-là.
   */
  "juridique.depot": { quota: 3, fenetreMs: 60 * 60_000 },

  /**
   * Rappel d'opérateur de paiement. Trois cents par minute.
   *
   * Volontairement large : un opérateur qui rattrape un incident peut envoyer
   * des centaines de rappels d'un coup, et les refuser coûterait des ventes.
   * La borne existe pour l'inconnu qui frappe la route sans signature, pas pour
   * l'opérateur — et les appels refusés ont déjà leur propre plafond de traces.
   */
  rappelPaiement: { quota: 300, fenetreMs: 60_000 },

  /**
   * Affichages de bannières. Cent vingt envois par minute et par adresse.
   *
   * Un envoi groupe toutes les bannières vues depuis le précédent ; un
   * visiteur qui fait défiler la mosaïque en envoie un toutes les deux
   * secondes au plus. Cent vingt laisse de la marge à un bureau entier
   * derrière une même adresse, et borne qui gonflerait les compteurs d'un
   * concurrent à coups de script.
   */
  "pub.vues": { quota: 120, fenetreMs: 60_000 },

  /**
   * Clics sur une bannière. Trente par minute et par adresse.
   *
   * Personne ne clique trente bannières en une minute ; un script qui veut
   * faire monter un taux de clic, si.
   */
  "pub.clic": { quota: 30, fenetreMs: 60_000 },

  /**
   * Vérification de clé de licence. Soixante par minute et par adresse.
   *
   * Le programme d'un créateur vérifie la clé au démarrage : un poste, une
   * vérification. Soixante couvre un bureau entier qui ouvre le logiciel le
   * même matin, et rend inutile le tâtonnement — 31^32 clés possibles.
   */
  "licence.verification": { quota: 60, fenetreMs: 60_000 },

  /**
   * Formulaires Contact et Sponsoriser. Cinq messages par heure et par
   * adresse : assez pour se reprendre, trop peu pour remplir la boîte de
   * l'équipe.
   */
  "contact.envoi": { quota: 5, fenetreMs: 60 * 60_000 },
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
    dansSecondes: Math.max(
      1,
      Math.ceil((attenteAvantPassage({ precedent, courant, regle, ecouleMs }) + 1) / 1000),
    ),
  };
}

/**
 * Combien de millisecondes attendre pour que le PROCHAIN geste passe, si
 * personne n'en fait d'autre d'ici là.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LA FIN DU SEAU N'EST PAS LA FIN DE L'ATTENTE
 *
 * On annonçait le temps restant au seau courant. Mesuré le 25/09 (Qualitytest
 * R56) : « Réessaie dans 3 minutes » pour la connexion, « dans 4 minutes » pour
 * un dépôt juridique — et à l'heure dite, toujours refusé, avec « 15 minutes »
 * puis « 60 minutes ». Au début du seau suivant, le précédent compte encore
 * presque en entier : c'est tout l'intérêt de la fenêtre glissante, et c'est
 * ce que l'annonce oubliait. Le geste refusé est lui-même compté (« on compte
 * d'abord ») ; chaque essai à l'heure annoncée allongeait donc l'attente.
 *
 * Deux moments où le prochain geste peut passer :
 *
 *   - dans ce seau, si le précédent s'efface assez vite :
 *       précédent × (1 − (écoulé + t) / F) + courant + 1 ≤ quota
 *   - dans le suivant, où le courant devient le précédent :
 *       courant × (1 − e / F) + 1 ≤ quota, e = t − (F − écoulé)
 */
export function attenteAvantPassage(input: {
  precedent: number;
  courant: number;
  regle: Regle;
  ecouleMs: number;
}): number {
  const { precedent, courant, regle, ecouleMs } = input;
  const F = regle.fenetreMs;
  const resteAuSeau = Math.max(0, F - ecouleMs);

  // Dans ce seau : seulement si le courant laisse encore une place.
  if (precedent > 0 && courant + 1 <= regle.quota) {
    const t = F * (1 - (regle.quota - courant - 1) / precedent) - ecouleMs;
    if (t < resteAuSeau) return Math.max(0, t);
  }

  // Dans le suivant : le courant y pèse, puis s'efface à son tour.
  const dansLeSuivant =
    courant + 1 <= regle.quota ? 0 : Math.min(F, F * (1 - (regle.quota - 1) / courant));
  return resteAuSeau + dansLeSuivant;
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
