import type { Modele } from "@/lib/email/modeles";

/**
 * Ce dont on prévient les gens, et par où.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI UN CATALOGUE, ET NON UN APPEL À `deposer` PAR ENDROIT
 *
 * Aujourd'hui, chaque module décide seul s'il envoie un courriel. Le résultat
 * n'est pas une politique de notification : c'est une collection d'oublis. Un
 * reçu d'achat part, une fiche refusée ne dit rien, une vente ne se sait que
 * si l'on ouvre son tableau de bord.
 *
 * Ce fichier est la **liste** — pas le mécanisme. Ajouter un événement se fait
 * ici, en une entrée, et l'aiguilleur (`lib/notifications/aiguilleur.ts`) le
 * livre sur tous les canaux ouverts sans qu'on ait à y penser.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'UNITÉ DE PRÉFÉRENCE EST LE COUPLE (ÉVÉNEMENT × CANAL)
 *
 * C'est la leçon prise chez Gumroad, qui porte pour chaque type d'événement
 * deux réglages distincts — `enable_payment_email` et
 * `enable_payment_push_notification`. La raison tient en un exemple : quelqu'un
 * veut la sonnerie de sa vente sur son téléphone, et pas un courriel de plus.
 * Un interrupteur global ne sait pas exprimer ça, et devient donc un
 * interrupteur « tout couper ».
 *
 * Ce qu'on ne reprend PAS de Gumroad : le rangement. Chez lui, ce sont des bits
 * dans une seule colonne entière (`has_flags`), et le flag 54 est atteint.
 * Illisible en base, non requêtable — « qui reçoit encore les reçus ? » devient
 * un parcours de table. Baobart range une ligne par couple.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CERTAINES NE SE COUPENT PAS
 *
 * Un avis de versement, un remboursement, un refus de publication : ce ne sont
 * pas des nouvelles, ce sont des **actes** qui engagent quelqu'un. Les rendre
 * optionnels reviendrait à permettre de ne pas être prévenu qu'on a été payé —
 * ou qu'on ne le sera pas.
 *
 * Gumroad n'a pas cette notion, et c'est un manque : tous ses réglages se
 * coupent. On l'ajoute, en la réservant à ce qui la mérite — une liste
 * d'impératifs qui s'allonge est une liste dont plus personne ne tient compte.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE MODULE EST PUR
 *
 * Aucune requête, aucune session. Il reçoit des préférences déjà lues et rend
 * la liste des canaux. C'est ce qui permet d'éprouver « un impératif ignore la
 * préférence » sans monter une base.
 */

/**
 * Les canaux, y compris celui qu'on ne livre pas encore.
 *
 * `PUSH` est déclaré parce que l'infrastructure existe (`lib/push/`, chiffrement
 * RFC 8291, VAPID, purge des abonnements morts) et qu'elle ne sert aujourd'hui
 * qu'aux relances Ndank. Le déclarer maintenant permet de ranger la préférence
 * dès le premier jour ; l'allumer plus tard ne demandera pas de migration.
 *
 * Ce que ça coûte : une valeur qui ne fait rien. Ce que ça évite : une colonne
 * à ajouter sur une table de préférences déjà remplie.
 */
export const CANAUX = ["COURRIEL", "IN_APP", "PUSH"] as const;
export type Canal = (typeof CANAUX)[number];

/**
 * Ceux que l'aiguilleur livre réellement.
 *
 * La séparation est volontaire : un canal déclaré mais non livré doit être
 * visible **dans le code**, pas découvert en se demandant pourquoi personne ne
 * reçoit rien.
 */
export const CANAUX_LIVRES: readonly Canal[] = ["COURRIEL", "IN_APP"];

export type Audience = "acheteur" | "vendeur" | "tous";

export interface Reglage {
  /** Pour qui, sur l'écran de préférences. Un vendeur ne veut pas relire les
   *  réglages d'acheteur qui ne le concernent pas. */
  audience: Audience;
  /** Ce qu'on écrit dans la liste des réglages. */
  libelle: string;
  /** Ce que la notification annonce, en une phrase. */
  explication: string;
  /**
   * Ne se coupe pas. La préférence est alors ignorée, et l'écran l'affiche
   * grisée avec sa raison plutôt que de la cacher : on doit pouvoir constater
   * qu'on la recevra.
   */
  imperatif?: true;
  /**
   * Le modèle de courriel, quand il existe.
   *
   * `null` veut dire « pas encore de courriel pour cet événement » — il n'est
   * alors livré qu'en in-app. C'est un état transitoire assumé plutôt qu'un
   * modèle vide : un courriel sans texte est pire que pas de courriel.
   */
  modele: Modele | null;
  /** Ce qui s'applique quand la personne n'a rien réglé. */
  defauts: Record<Canal, boolean>;
}

export type EvenementNotifiable =
  // ── Acheteur ────────────────────────────────────────────────────────────
  | "ACHAT_CONFIRME"
  | "TELECHARGEMENT_PRET"
  | "COMMANDE_REMBOURSEE"
  | "ABONNEMENT_A_RENOUVELER"
  | "ABONNEMENT_RECU"
  | "EVENEMENT_ANNULE"
  // ── Vendeur, créateur, organisateur ─────────────────────────────────────
  | "VENTE_REALISEE"
  | "VERSEMENT_ENVOYE"
  | "CONTENU_PUBLIE"
  | "CONTENU_REFUSE"
  | "CANDIDATURE_RECUE"
  | "INSCRIPTION_EVENEMENT"
  | "NOUVEL_ABONNE";

/**
 * Tout, en un seul endroit.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LE DÉFAUT IN-APP EST VRAI PARTOUT, ET CE N'EST PAS DE LA PARESSE
 *
 * Une ligne dans une liste qu'on consulte ne dérange personne : elle attend
 * qu'on vienne. C'est le courriel qui s'impose, parce qu'il arrive chez vous.
 *
 * Les défauts courriel sont donc choisis un par un, et deux sont à `false` :
 * « nouvel abonné » et « inscription à un événement ». Ce sont les deux seuls
 * qui peuvent survenir cent fois par jour, et cent courriels par jour font
 * marquer l'expéditeur comme indésirable — ce qui coûte ensuite les reçus.
 *
 * PUSH est à `false` partout tant qu'il n'est pas livré. Le laisser à `true`
 * ferait croire, à la lecture de ce tableau, que les gens le reçoivent.
 */
export const CATALOGUE: Record<EvenementNotifiable, Reglage> = {
  // ══════════════════════════════════════════════════════ acheteur ══
  ACHAT_CONFIRME: {
    audience: "acheteur",
    libelle: "Reçu d'achat",
    explication: "Ce que tu viens d'acheter, et comment y accéder.",
    // Un reçu est une preuve d'achat. Permettre de le couper, c'est permettre
    // de ne plus pouvoir prouver ce qu'on a payé.
    imperatif: true,
    modele: "RECU_ACHAT",
    defauts: { COURRIEL: true, IN_APP: true, PUSH: false },
  },
  TELECHARGEMENT_PRET: {
    audience: "acheteur",
    libelle: "Lien de téléchargement",
    explication: "Le fichier est prêt, avec son lien.",
    modele: "LIEN_TELECHARGEMENT",
    defauts: { COURRIEL: true, IN_APP: true, PUSH: false },
  },
  COMMANDE_REMBOURSEE: {
    audience: "acheteur",
    libelle: "Remboursement",
    explication: "L'argent repart vers ton moyen de paiement.",
    // Un mouvement d'argent dans l'autre sens. Même raison que le reçu.
    imperatif: true,
    modele: null,
    defauts: { COURRIEL: true, IN_APP: true, PUSH: false },
  },
  ABONNEMENT_A_RENOUVELER: {
    audience: "acheteur",
    libelle: "Abonnement à renouveler",
    explication: "Avant que l'accès ne se ferme.",
    modele: "RELANCE_ABONNEMENT",
    defauts: { COURRIEL: true, IN_APP: true, PUSH: false },
  },
  ABONNEMENT_RECU: {
    audience: "acheteur",
    libelle: "Reçu d'abonnement",
    explication: "Ton abonnement a été renouvelé, avec la prochaine échéance.",
    // Même raison que le reçu d'achat : c'est une preuve de paiement. Un
    // abonnement se conteste, et sans reçu on ne conteste rien.
    imperatif: true,
    modele: "RECU_ABONNEMENT",
    defauts: { COURRIEL: true, IN_APP: true, PUSH: false },
  },
  EVENEMENT_ANNULE: {
    audience: "acheteur",
    libelle: "Événement annulé",
    explication: "Un événement où tu étais inscrit n'aura pas lieu.",
    // Quelqu'un a noté la date et prévu un déplacement. Ne pas le prévenir,
    // c'est le laisser venir devant une porte fermée.
    imperatif: true,
    modele: null,
    defauts: { COURRIEL: true, IN_APP: true, PUSH: false },
  },

  // ══════════════════════════════════════ vendeur, créateur, organisateur ══
  VENTE_REALISEE: {
    audience: "vendeur",
    libelle: "Nouvelle vente",
    explication: "Quelqu'un vient d'acheter une de tes ressources.",
    modele: null,
    defauts: { COURRIEL: true, IN_APP: true, PUSH: false },
  },
  VERSEMENT_ENVOYE: {
    audience: "vendeur",
    libelle: "Versement envoyé",
    explication: "Tes gains sont partis vers ton compte.",
    imperatif: true,
    modele: "AVIS_VERSEMENT",
    defauts: { COURRIEL: true, IN_APP: true, PUSH: false },
  },
  CONTENU_PUBLIE: {
    audience: "vendeur",
    libelle: "Publication acceptée",
    explication: "Ce que tu as soumis est en ligne.",
    modele: null,
    defauts: { COURRIEL: true, IN_APP: true, PUSH: false },
  },
  CONTENU_REFUSE: {
    audience: "vendeur",
    libelle: "Publication refusée",
    explication: "Ce que tu as soumis ne paraîtra pas, et pourquoi.",
    // L'événement qui a lancé ce chantier. Sans lui, un refus est un mur :
    // la fiche disparaît, et son auteur n'a aucun moyen d'apprendre pourquoi.
    // Le rendre optionnel reviendrait à rendre le refus muet à nouveau.
    imperatif: true,
    modele: null,
    defauts: { COURRIEL: true, IN_APP: true, PUSH: false },
  },
  CANDIDATURE_RECUE: {
    audience: "vendeur",
    libelle: "Candidature reçue",
    explication: "Quelqu'un a postulé à ton offre.",
    modele: null,
    defauts: { COURRIEL: true, IN_APP: true, PUSH: false },
  },
  INSCRIPTION_EVENEMENT: {
    audience: "vendeur",
    libelle: "Inscription à ton événement",
    explication: "Quelqu'un vient de s'inscrire.",
    modele: null,
    // Courriel éteint : un atelier de cent places ferait cent courriels. La
    // liste des inscrits est déjà consultable, et elle s'exporte.
    defauts: { COURRIEL: false, IN_APP: true, PUSH: false },
  },
  NOUVEL_ABONNE: {
    audience: "vendeur",
    libelle: "Nouvel abonné",
    explication: "Quelqu'un suit désormais ta boutique.",
    modele: null,
    // Même raison : c'est l'événement le plus fréquent et le moins actionnable.
    defauts: { COURRIEL: false, IN_APP: true, PUSH: false },
  },
};

/** La liste, pour parcourir sans oublier un cas. */
export const EVENEMENTS = Object.keys(CATALOGUE) as EvenementNotifiable[];

/**
 * Ce que la personne a réglé — seulement ce qu'elle a **changé**.
 *
 * L'absence d'une entrée veut dire « le défaut du code s'applique ». C'est ce
 * qui permet de changer un défaut sans migrer une table : personne ne porte une
 * copie figée de ce qu'on avait décidé le jour de son inscription.
 */
export type Preferences = Partial<
  Record<EvenementNotifiable, Partial<Record<Canal, boolean>>>
>;

/**
 * Par où livrer cet événement à cette personne.
 *
 * L'ordre des décisions est le cœur du module :
 *
 *   1. le canal est-il livré du tout ? (`PUSH` ne l'est pas encore)
 *   2. l'événement est-il impératif ? alors on ne demande pas son avis ;
 *   3. la personne a-t-elle réglé ce couple ? sinon, le défaut.
 *
 * Mettre l'impératif AVANT la préférence est ce qui garantit qu'un réglage
 * enregistré autrefois — ou posé par erreur en base — ne puisse pas faire taire
 * un avis de versement.
 */
export function canauxPour(
  evenement: EvenementNotifiable,
  preferences: Preferences = {},
): Canal[] {
  const reglage = CATALOGUE[evenement];

  return CANAUX_LIVRES.filter((canal) => {
    if (reglage.imperatif) return true;

    const choisi = preferences[evenement]?.[canal];
    return choisi ?? reglage.defauts[canal];
  });
}

/**
 * Ce réglage peut-il être modifié ?
 *
 * L'écran de préférences s'en sert pour afficher l'interrupteur grisé plutôt
 * que de masquer la ligne : quelqu'un doit pouvoir constater qu'il recevra les
 * avis de versement, et comprendre qu'il n'y peut rien.
 */
export function estModifiable(evenement: EvenementNotifiable): boolean {
  return CATALOGUE[evenement].imperatif !== true;
}

/** Les événements qui concernent cette audience, pour l'écran de réglages. */
export function evenementsPour(audience: Audience): EvenementNotifiable[] {
  return EVENEMENTS.filter((e) => {
    const a = CATALOGUE[e].audience;
    return a === "tous" || a === audience;
  });
}
