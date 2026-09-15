import type { Cadence, Cycle } from "@/lib/ndank/cycle";

/**
 * Ndank — ce que l'application hôte doit fournir.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * NIVEAU 1 : LES PORTS
 *
 * Ndank se consomme de trois façons, par ordre d'exigence :
 *
 *   1. **les ports** — ce fichier. Ndank ne connaît aucune base : l'hôte
 *      implémente ces quelques méthodes et branche ce qu'il veut derrière.
 *      C'est ce qui le rend utilisable dans n'importe quel projet JavaScript,
 *      au prix d'un peu de câblage ;
 *   2. **le schéma fourni** — Ndank apporte ses tables et une implémentation
 *      toute faite. Dix minutes, mais impose Prisma et PostgreSQL ;
 *   3. **le service hébergé** — Ndank tourne à part, on l'appelle par HTTP.
 *      Aucune compétence requise, une infrastructure de plus à tenir.
 *
 * Les trois partagent ce fichier. Les niveaux 2 et 3 ne sont que des
 * implémentations de ces mêmes ports — c'est pour cela qu'ils peuvent exister
 * sans dupliquer une ligne de la logique.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUE LES PORTS NE FONT PAS
 *
 * Aucun ne décide. Ils lisent, ils écrivent, ils envoient. Toute la règle — quand
 * relancer, quand couper, quand clore — vit dans `etats.ts` et `cycle.ts`, qui
 * sont purs et testables sans rien monter.
 *
 * C'est la séparation qui permet d'éprouver « un passage qui a raté trois jours
 * n'envoie qu'une relance » sans base, sans réseau, et en une milliseconde.
 */

/** Un abonnement, tel que Ndank a besoin de le voir. */
export interface AbonnementLu {
  id: string;
  /** L'abonné, dans les termes de l'hôte. */
  abonneId: string;
  cadence: Cadence;
  cycle: Cycle;
  resilieeLe: Date | null;
  /** Ce qu'il faudra payer au prochain renouvellement, en unités mineures. */
  montant: number;
  devise: string;
  /** De quoi écrire le message : nom de l'offre, du service. */
  libelle: string;
}

/** Où joindre l'abonné. Chaque champ peut manquer. */
export interface Coordonnees {
  /**
   * Qui c'est, du point de vue de l'hôte.
   *
   * ────────────────────────────────────────────────────────────────────────
   * POURQUOI UN IDENTIFIANT DANS UN OBJET « OÙ JOINDRE »
   *
   * Le port promet « où joindre l'abonné », et un identifiant n'est pas une
   * adresse. Il est là quand même, pour une raison précise : l'hôte doit
   * pouvoir, après un envoi réussi, rattacher la relance à un compte — chez
   * Baobart, pour en garder une trace dans l'application.
   *
   * L'alternative était de le faire ressortir d'une seconde lecture depuis
   * l'identifiant d'abonnement. Cela marcherait, et cela ferait une requête
   * de plus pour une donnée que `coordonnees()` avait déjà en main.
   */
  abonneId: string;
  /** Comment l'appeler. `null` quand on ne sait pas — on dira « Bonjour ». */
  nom: string | null;
  courriel: string | null;
  telephone: string | null;
  /**
   * Les appareils où la notification peut arriver.
   *
   * ─────────────────────────────────────────────────────────────────────
   * UNE LISTE, ET NON UN JETON
   *
   * Une adresse de courriel est unique, un numéro aussi. Les appareils, non :
   * quelqu'un installe l'application sur son téléphone ET sur son ordinateur.
   * N'en garder qu'un ferait arriver la relance sur celui resté dans un tiroir.
   *
   * ─────────────────────────────────────────────────────────────────────
   * DES POIGNÉES OPAQUES, PAS DES IDENTIFIANTS D'APPAREIL
   *
   * Ndank ne les interprète jamais : il les passe à `Envoi`. C'est délibéré —
   * un abonnement push réel porte des clés de chiffrement, et elles n'ont
   * aucune raison de traverser un module qui ne décide que de qui relancer.
   * L'hôte met ce qu'il veut derrière la poignée.
   */
  appareils: string[];
  /**
   * Les canaux que l'abonné a fermés, et qu'il ne faut donc pas essayer.
   *
   * ─────────────────────────────────────────────────────────────────────
   * DEUX DÉCIDEURS DE CANAL, UN SEUL ARBITRE
   *
   * Le moteur choisit **quel** canal essayer, dans l'ordre du palier. L'hôte,
   * lui, sait ce que la personne a accepté de recevoir. Sans ce champ, les
   * deux décisions ne se rencontrent jamais : quelqu'un qui coupe les
   * courriels de relance continue d'en recevoir, parce que le moteur ne
   * connaît pas ses réglages.
   *
   * Le renseigner ici plutôt que d'interroger l'hôte à chaque essai est ce
   * qui garde `disponible()` **synchrone** : la lecture se fait une fois,
   * dans `coordonnees()`, qui est déjà asynchrone et lit déjà le compte.
   *
   * Un canal fermé se comporte exactement comme un canal absent : le moteur
   * passe au suivant, et compte l'abonné parmi les injoignables s'il n'en
   * reste aucun. C'est juste — quelqu'un qui a tout coupé est quelqu'un
   * qu'on ne peut plus prévenir, et cela doit se voir avant de couper un
   * accès.
   */
  refuses: readonly Canal[];
}

/**
 * Lire ce dont le moteur a besoin.
 *
 * `aRelancer` ne rend PAS tous les abonnements : seulement ceux qu'un passage
 * pourrait avoir à toucher. Sur cent mille abonnés, en parcourir cent mille
 * chaque matin pour en relancer trente est un gâchis qui finit par tomber en
 * délai d'attente.
 */
export interface Lecture {
  /**
   * Les abonnements dont l'échéance ou la fin d'accès tombe dans la fenêtre.
   *
   * L'hôte filtre comme il peut — un index sur l'échéance suffit. Rendre trop
   * d'abonnements ne casse rien : le moteur dira « rien à faire ». En rendre
   * trop peu, si.
   */
  aRelancer(avant: Date, limite: number): Promise<AbonnementLu[]>;

  /** Les clés de relance déjà parties pour cet abonnement. */
  relancesEnvoyees(abonnementId: string): Promise<string[]>;

  coordonnees(abonneId: string): Promise<Coordonnees>;
}

/**
 * Écrire ce que le moteur décide.
 *
 * Toutes ces méthodes doivent être **idempotentes**. Le moteur dit ce qui doit
 * être vrai, pas ce qui a changé : suspendre un abonnement déjà suspendu est un
 * geste normal, pas une erreur. Un passage rejoué ne doit rien casser.
 */
export interface Ecriture {
  /** Note qu'une relance est partie, pour ne pas la renvoyer demain. */
  noterRelance(abonnementId: string, cle: string, canaux: string[]): Promise<void>;

  /** Coupe l'accès. Appelée tant que l'abonnement reste suspendu. */
  suspendre(abonnementId: string): Promise<void>;

  /** Clôt définitivement. Appelée tant que l'abonnement reste clos. */
  clore(abonnementId: string): Promise<void>;

  /** Enregistre le nouveau cycle après un paiement confirmé. */
  renouveler(abonnementId: string, cycle: Cycle): Promise<void>;
}

export type Canal = "courriel" | "sms" | "push";

/**
 * Ce qu'il faut dire à l'abonné — en faits, pas en phrases toutes faites.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI PAS UNE CHAÎNE DÉJÀ RENDUE
 *
 * Un SMS coûte au caractère et n'a pas de mise en forme ; un courriel peut
 * s'étendre ; une notification tient en une ligne et doit pouvoir porter un
 * bouton. Rendre le texte ici obligerait chaque canal à découper la prose d'un
 * autre — et le SMS finirait coupé au milieu d'un mot.
 *
 * Le moteur transmet donc les faits, et chaque canal les met en forme comme il
 * doit. C'est aussi ce qui permet de traduire sans toucher au moteur.
 */
export interface Message {
  /** La clé de la relance : cycle et palier. Sert à ne pas doubler l'envoi. */
  cle: string;
  /** Le nom de l'abonné, tel qu'on l'appelle. */
  destinataire: string;
  /** Le nom de l'offre. */
  offre: string;
  /** Le montant, déjà formaté par l'hôte — lui seul connaît sa devise. */
  montant: string;
  /** Où l'abonné va valider. */
  lien: string;
  /** Jours d'accès restants. Négatif si l'accès est déjà coupé. */
  joursRestants: number;
  /** Dernier palier : le ton change, et le sujet aussi. */
  dernier: boolean;
}

/**
 * Envoyer, et dire franchement si c'est parti.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UN CANAL ABSENT N'EST PAS UNE PANNE
 *
 * Beaucoup d'abonnés n'auront ni jeton de notification ni numéro vérifié. Le
 * moteur essaie les canaux du palier dans l'ordre et se contente du premier qui
 * part : rendre `false` est une réponse normale, pas une erreur à journaliser.
 *
 * En revanche, **aucun canal disponible** en est une : cela veut dire qu'on ne
 * peut plus joindre quelqu'un dont on va couper l'accès.
 */
export interface Envoi {
  disponible(canal: Canal, ou: Coordonnees): boolean;
  envoyer(canal: Canal, ou: Coordonnees, message: Message): Promise<boolean>;
}

export interface Ports {
  lecture: Lecture;
  ecriture: Ecriture;
  envoi: Envoi;
}
