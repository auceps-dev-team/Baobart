import { z } from "zod";

/**
 * Le texte des messages transactionnels, et rien d'autre.
 *
 * Module pur : il transforme une charge utile en sujet et corps. Aucune base,
 * aucun réseau — ce qui rend le contenu des messages éprouvable, et c'est
 * précieux : une faute dans un reçu d'achat part chez tous les acheteurs à la
 * fois, sans possibilité de rappel.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI VALIDER LA CHARGE
 *
 * Elle vient de la base, en JSON, écrite parfois des jours plus tôt par une
 * version antérieure du code. Sans contrôle, un champ renommé produit
 * « Bonjour undefined » — et l'erreur ne se voit qu'une fois le message parti.
 * Mieux vaut un envoi qui échoue bruyamment qu'un message absurde délivré.
 */

export const MODELES = [
  "BIENVENUE",
  "REINITIALISATION_MOT_DE_PASSE",
  "RECU_ACHAT",
  "LIEN_TELECHARGEMENT",
  "AVIS_VERSEMENT",
  "RELANCE_ABONNEMENT",
  "RECU_ABONNEMENT",
  // ── Ajoutés en v1.52.2, pour les avis qui n'avaient que l'in-app ────────
  //
  // Ils étaient déclarés `modele: null` au catalogue des notifications : les
  // événements existaient, se rangeaient dans la cloche, et ne partaient
  // jamais par courriel. L'écran de réglages l'annonçait en toutes lettres
  // plutôt que d'offrir un interrupteur inerte — c'est cet aveu qu'on retire.
  "COMMANDE_REMBOURSEE",
  "EVENEMENT_ANNULE",
  "VENTE_REALISEE",
  "CONTENU_PUBLIE",
  "CONTENU_REFUSE",
  "CANDIDATURE_RECUE",
  "INSCRIPTION_EVENEMENT",
  "NOUVEL_ABONNE",

  // ── Ajouté en v1.57.0 avec les notifications juridiques ─────────────────
  //
  // Le seul avis de cette liste qui ouvre un DÉLAI : la personne a dix jours
  // pour contester, et passé ce terme le contenu ne revient pas. L'in-app ne
  // suffisait pas — une cloche qu'on n'ouvre pas ferait courir ce délai dans
  // le vide, et le retrait deviendrait définitif par silence.
  "RETRAIT_JURIDIQUE",

  // ── Ajouté en v1.64.0 avec la relance de paiement ───────────────────────
  //
  // Le seul modèle de cette liste qui ne rende compte de rien : les autres
  // annoncent un fait accompli — une vente, un remboursement, un retrait.
  // Celui-ci demande quelque chose, et c'est ce qui le rend délicat.
  //
  // D'où une seule relance par commande, garantie par une contrainte
  // d'unicité en base et non par une précaution de code : relancer deux fois
  // quelqu'un qui a renoncé est le genre de détail qui fait classer un
  // expéditeur en indésirable, et la délivrabilité ne revient pas.
  "PAIEMENT_ABANDONNE",

  // ── Ajouté en v1.69.12 : la levée d'une annulation ──────────────────────
  //
  // Le pendant d'EVENEMENT_ANNULE. Qui a lu « annulé » a pu renoncer à un
  // déplacement ; lui laisser découvrir seul que l'événement revient, c'est
  // le faire manquer ce qu'il avait prévu (mesuré le 25/09, Qualitytest S6).
  "EVENEMENT_MAINTENU",

  // ── Ajouté le 04/10 avec la lettre d'information ────────────────────────
  //
  // Le seul modèle adressé à quelqu'un qui n'a peut-être pas de compte :
  // d'où l'absence de `nom`. Et le seul dont le destinataire n'a peut-être
  // rien demandé — quelqu'un a pu taper son adresse. Le texte le dit, et le
  // lien de désinscription est déjà là.
  "INFOLETTRE_CONFIRMATION",

  // ── Ajoutés le 08/10 avec les demandes de remboursement ─────────────────
  "DEMANDE_REMBOURSEMENT",
  "REMBOURSEMENT_REFUSE",

  // ── Ajouté le 08/10 : un numéro de la lettre d'information ──────────────
  //
  // Le seul modèle dont le texte n'est pas écrit ici : l'équipe l'écrit. Le
  // pied, lui, l'est — et il porte toujours le lien de désinscription.
  "INFOLETTRE",
] as const;

export type Modele = (typeof MODELES)[number];

export interface Message {
  sujet: string;
  texte: string;
}

/**
 * Un sujet ne contient jamais de retour à la ligne.
 *
 * Historiquement, un saut de ligne dans un sujet permet d'injecter des en-têtes
 * — un `Bcc:` ajouté par l'appelant, et le message part à des inconnus. Les API
 * modernes en JSON ferment cette porte, mais la donnée traverse aussi des
 * journaux et des écrans, et un sujet sur trois lignes y casse tout. On coupe à
 * la source plutôt que de faire confiance au transport.
 */
function sujetSur(brut: string): string {
  return brut.replace(/[\r\n]+/g, " ").trim().slice(0, 200);
}

const nom = z.string().min(1).max(120);
/**
 * Un lien, et seulement en http(s).
 *
 * `z.string().url()` s'appuie sur `new URL()`, qui accepte tout schéma —
 * `javascript:`, `data:`, `file:`. Un tel lien dans un courriel est au mieux
 * mort, au pire un hameçonnage signé de notre nom. On restreint donc.
 */
const lien = z
  .string()
  .url()
  .refine(
    (v) => {
      try {
        const p = new URL(v).protocol;
        return p === "http:" || p === "https:";
      } catch {
        return false;
      }
    },
    { message: "doit être une adresse http(s)" },
  );

const SCHEMAS = {
  BIENVENUE: z.object({ nom }),
  REINITIALISATION_MOT_DE_PASSE: z.object({ nom, lien, heures: z.number().int().positive() }),
  RECU_ACHAT: z.object({
    nom,
    ressource: z.string().min(1).max(200),
    montant: z.string().min(1).max(40),
    /**
     * Vers l'espace de l'acheteur, jamais vers le fichier.
     *
     * Facultatif : sans `APP_URL`, le reçu part quand même — il vaut preuve de
     * paiement, et c'est ce qui compte le jour d'une contestation.
     */
    lien: lien.optional(),
  }),
  /**
   * ────────────────────────────────────────────────────────────────────────
   * CE MODÈLE N'EST DÉLIBÉRÉMENT DÉPOSÉ PAR PERSONNE
   *
   * Son texte annonce un lien « valable un temps limité » : une URL signée,
   * donc. Or une URL signée est un laissez-passer au porteur. Envoyée par
   * courriel, elle contourne tout ce que `app/api/telechargement` vérifie au
   * moment du clic — commande remboursée, paiement contesté, accès retiré par
   * le créateur, abonnement échu, quota épuisé. Le message dormirait dans une
   * boîte, réexpédiable, encore valide après le remboursement.
   *
   * Le reçu d'achat porte donc un lien vers l'espace de l'acheteur, où ces
   * vérifications ont lieu à chaque fois. Ce modèle-ci attend un usage où le
   * porteur n'a pas de compte — un cadeau, un achat pour un tiers — et il
   * faudra alors lui donner sa propre péremption courte.
   */
  LIEN_TELECHARGEMENT: z.object({
    nom,
    ressource: z.string().min(1).max(200),
    lien,
  }),
  RELANCE_ABONNEMENT: z.object({
    nom,
    offre: z.string().min(1).max(120),
    montant: z.string().min(1).max(40),
    lien,
    /** Jours restants avant que l'accès ne s'arrête. Négatif s'il est coupé. */
    jours: z.number().int(),
  }),
  AVIS_VERSEMENT: z.object({
    nom,
    montant: z.string().min(1).max(40),
    compte: z.string().min(1).max(60),
  }),
  RECU_ABONNEMENT: z.object({
    nom,
    offre: z.string().min(1).max(120),
    montant: z.string().min(1).max(40),
    /** La prochaine échéance, déjà mise en forme : le modèle ne sait pas dater. */
    prochaine: z.string().min(1).max(40),
    lien: lien.optional(),
  }),

  // ══════════════════════════════════════════════════════════════════════════
  // LES HUIT DE v1.52.2
  //
  // Chaque schéma décrit EXACTEMENT ce que son appelant passe déjà — pas un
  // champ de plus. Un schéma plus riche que la charge réelle ferait échouer le
  // rendu au dépôt, et l'aiguilleur le compterait en `echecs` sans que
  // personne ne l'ait demandé.
  //
  // `nom` figure partout sans qu'aucun appelant ne le passe : c'est
  // l'aiguilleur qui l'ajoute, depuis le compte qu'il vient de lire.
  COMMANDE_REMBOURSEE: z.object({
    nom,
    ressource: z.string().min(1).max(160),
    montant: z.string().min(1).max(40),
    /** Le motif, quand il y en a un. Beaucoup de remboursements n'en ont pas. */
    raison: z.string().max(400).optional(),
  }),
  EVENEMENT_ANNULE: z.object({
    nom,
    titre: z.string().min(1).max(160),
    raison: z.string().min(1).max(1000),
  }),
  VENTE_REALISEE: z.object({
    nom,
    ressource: z.string().min(1).max(160),
    montant: z.string().min(1).max(40),
  }),
  CONTENU_PUBLIE: z.object({ nom, titre: z.string().min(1).max(160) }),
  CONTENU_REFUSE: z.object({
    nom,
    titre: z.string().min(1).max(160),
    motif: z.string().min(1).max(1000),
  }),
  CANDIDATURE_RECUE: z.object({ nom, offre: z.string().min(1).max(160) }),
  INSCRIPTION_EVENEMENT: z.object({ nom, titre: z.string().min(1).max(160) }),
  NOUVEL_ABONNE: z.object({ nom }),
  RETRAIT_JURIDIQUE: z.object({
    nom,
    reference: z.string().min(1).max(40),
    // Le motif invoqué par le notifiant, tel qu'il l'a écrit. Repris et non
    // résumé : la personne doit pouvoir répondre à ce qui lui est reproché,
    // pas à notre reformulation.
    motif: z.string().min(1).max(2000),
    echeance: z.string().min(1).max(40),
    lien: z.string().url().optional(),
  }),
  PAIEMENT_ABANDONNE: z.object({
    nom,
    ressource: z.string().min(1).max(200),
    montant: z.string().min(1).max(40),
    /**
     * Vers la fiche, pour reprendre l'achat.
     *
     * Obligatoire, contrairement au reçu : un reçu sans lien vaut encore
     * preuve de paiement, une relance sans lien ne sert à rien. Sans
     * `APP_URL`, mieux vaut ne pas relancer du tout.
     */
    lien,
    /** Combien d'heures il reste avant que la commande ne se referme. */
    heures: z.number().int().positive(),
  }),
  EVENEMENT_MAINTENU: z.object({ nom, titre: z.string().min(1).max(160) }),
  INFOLETTRE_CONFIRMATION: z.object({ confirmer: lien, desinscrire: lien, jours: z.number().int().positive() }),
  DEMANDE_REMBOURSEMENT: z.object({
    nom,
    ressource: z.string().min(1).max(200),
    montant: z.string().min(1).max(40),
    motif: z.string().min(1).max(500),
    jours: z.number().int().positive(),
  }),
  REMBOURSEMENT_REFUSE: z.object({
    nom,
    ressource: z.string().min(1).max(200),
    motif: z.string().min(1).max(2000),
    par: z.string().min(1).max(40),
  }),
  INFOLETTRE: z.object({
    sujet: z.string().min(1).max(160),
    corps: z.string().min(1).max(20_000),
    desinscrire: lien,
  }),
} satisfies Record<Modele, z.ZodTypeAny>;

export type ChargeDe<M extends Modele> = z.infer<(typeof SCHEMAS)[M]>;

const SIGNATURE = "\n\n— L'équipe Baobart\n";

const TEXTES: {
  [M in Modele]: (c: ChargeDe<M>) => Message;
} = {
  BIENVENUE: (c) => ({
    sujet: `Bienvenue sur Baobart, ${c.nom}`,
    texte:
      `Bonjour ${c.nom},\n\n` +
      `Ton compte est ouvert. Tu peux déjà parcourir le catalogue et ` +
      `télécharger ce qui est offert.\n\n` +
      `Quand tu voudras vendre, dépose une ressource : la boutique s'ouvre ` +
      `toute seule au premier dépôt.` +
      SIGNATURE,
  }),

  REINITIALISATION_MOT_DE_PASSE: (c) => ({
    sujet: "Réinitialiser ton mot de passe Baobart",
    texte:
      `Bonjour ${c.nom},\n\n` +
      `Voici le lien pour choisir un nouveau mot de passe :\n${c.lien}\n\n` +
      `Il expire dans ${c.heures} heure(s).\n\n` +
      `Si tu n'as rien demandé, ignore ce message : ton mot de passe actuel ` +
      `reste valable.` +
      SIGNATURE,
  }),

  RECU_ACHAT: (c) => ({
    sujet: `Ton achat : ${c.ressource}`,
    texte:
      `Bonjour ${c.nom},\n\n` +
      `Merci pour ton achat.\n\n` +
      `  ${c.ressource}\n  ${c.montant}\n\n` +
      `Retrouve le fichier dans ton espace, rubrique « Mes achats ». Il y ` +
      `reste disponible.` +
      (c.lien ? `

${c.lien}` : "") +
      SIGNATURE,
  }),

  LIEN_TELECHARGEMENT: (c) => ({
    sujet: `Ton téléchargement : ${c.ressource}`,
    texte:
      `Bonjour ${c.nom},\n\n` +
      `Voici ton lien pour « ${c.ressource} » :\n${c.lien}\n\n` +
      `Ce lien est personnel et n'est valable qu'un temps limité. Passé ce ` +
      `délai, reprends-le depuis ton espace.` +
      SIGNATURE,
  }),

  /**
   * La relance d'abonnement.
   *
   * ──────────────────────────────────────────────────────────────────────────
   * ELLE DIT CE QUI VA SE PASSER, PAS CE QU'ON ATTEND
   *
   * « Pense à renouveler » se remet à demain. « Ton accès s'arrête dans deux
   * jours » agit. Le nombre de jours restants est donc dans le sujet, là où il
   * se lit sans ouvrir.
   *
   * Et la phrase qui compte : **rien n'est prélevé sans validation**. C'est
   * vrai — le mobile money ne sait pas prélever — et c'est ce qui distingue un
   * abonnement Ndank d'un abonnement à carte dont on a peur.
   */
  RELANCE_ABONNEMENT: (c) => ({
    sujet:
      c.jours <= 0
        ? `Ton accès à ${c.offre} est suspendu`
        : `${c.offre} — ${c.jours} jour${c.jours > 1 ? "s" : ""} avant la coupure`,
    texte:
      `Bonjour ${c.nom},\n\n` +
      (c.jours <= 0
        ? `Ton accès à « ${c.offre} » est suspendu faute de renouvellement.\n\n`
        : `Ton abonnement « ${c.offre} » arrive à échéance. Il te reste ${c.jours} jour${c.jours > 1 ? "s" : ""} d'accès.\n\n`) +
      `  ${c.montant}\n\n` +
      `Pour continuer, valide depuis ce lien :\n${c.lien}\n\n` +
      `Rien n'est prélevé sans ta validation : c'est toi qui confirmes le ` +
      `paiement sur ton téléphone, à chaque fois.` +
      SIGNATURE,
  }),

  /**
   * Le reçu d'un renouvellement.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * LA PROCHAINE ÉCHÉANCE EST LE CŒUR DU MESSAGE
   *
   * Un reçu d'achat dit ce qu'on a reçu. Un reçu d'abonnement doit surtout dire
   * **jusqu'à quand** on est tranquille : c'est la seule information qui évite
   * à l'abonné de se demander chaque semaine s'il a bien payé.
   *
   * Et il redit qu'il n'y aura pas de prélèvement. Un abonné qui vient de payer
   * est exactement celui qui se demande si on lui reprendra l'argent tout seul.
   */
  RECU_ABONNEMENT: (c) => ({
    sujet: `Abonnement renouvelé : ${c.offre}`,
    texte:
      `Bonjour ${c.nom},\n\n` +
      `Ton paiement est confirmé et ton accès continue.\n\n` +
      `  ${c.offre}\n  ${c.montant}\n\n` +
      `Prochaine échéance : ${c.prochaine}. Nous te préviendrons avant.\n\n` +
      `Rien ne sera prélevé sans ta validation — c'est toi qui confirmeras le ` +
      `paiement sur ton téléphone, comme cette fois-ci.` +
      (c.lien ? `\n\n${c.lien}` : "") +
      SIGNATURE,
  }),

  AVIS_VERSEMENT: (c) => ({
    sujet: `Versement en route : ${c.montant}`,
    texte:
      `Bonjour ${c.nom},\n\n` +
      `Un versement de ${c.montant} part vers ${c.compte}.\n\n` +
      `Le délai dépend de l'opérateur — compte un à trois jours ouvrés.` +
      SIGNATURE,
  }),

  // ══════════════════════════════════════════════════════════════════════════
  // LES HUIT DE v1.52.2
  //
  // Une règle tenue partout : le courriel dit ce qui s'est passé et où aller,
  // jamais « connecte-toi pour voir ». Un message qui oblige à ouvrir un écran
  // pour apprendre son contenu ne sert à rien à qui relève sa boîte dans le
  // bus.
  COMMANDE_REMBOURSEE: (c) => ({
    sujet: `Remboursement : ${c.ressource}`,
    texte:
      `Bonjour ${c.nom},

` +
      `${c.montant} repartent vers ton moyen de paiement, pour ` +
      `« ${c.ressource} ».

` +
      (c.raison ? `Motif : ${c.raison}

` : "") +
      `Le délai dépend de l'opérateur — compte quelques jours. L'accès à la ` +
      `ressource est retiré.` +
      SIGNATURE,
  }),

  EVENEMENT_ANNULE: (c) => ({
    // Le titre dans le sujet, et pas seulement « Annulation » : c'est ce qu'on
    // lit dans une liste de messages, et il faut savoir LEQUEL est annulé sans
    // ouvrir.
    sujet: `Annulé : ${c.titre}`,
    texte:
      `Bonjour ${c.nom},

` +
      `L'événement « ${c.titre} », auquel tu étais inscrit, n'aura pas ` +
      `lieu.

` +
      `La raison donnée par l'organisateur :
${c.raison}

` +
      `Tu n'as rien à faire : ton inscription est annulée avec l'événement.` +
      SIGNATURE,
  }),

  VENTE_REALISEE: (c) => ({
    sujet: `Vente : ${c.ressource}`,
    texte:
      `Bonjour ${c.nom},

` +
      `${c.montant} viennent d'être encaissés sur « ${c.ressource} ».

` +
      // Le brut et le net se distinguent ici, sinon le créateur croit à une
      // erreur en comparant ce message à son écran de gains.
      `C'est le prix payé par l'acheteur. Ce qui te revient, après frais, ` +
      `apparaît dans tes gains.` +
      SIGNATURE,
  }),

  CONTENU_PUBLIE: (c) => ({
    sujet: `En ligne : ${c.titre}`,
    texte:
      `Bonjour ${c.nom},

` +
      `« ${c.titre} » a été relu et publié. C'est visible de tout le monde, ` +
      `et les inscriptions sont ouvertes.` +
      SIGNATURE,
  }),

  EVENEMENT_MAINTENU: (c) => ({
    // Le titre dans le sujet, comme pour l'annulation : il faut savoir LEQUEL
    // revient sans ouvrir le message.
    sujet: `Maintenu : ${c.titre}`,
    texte:
      `Bonjour ${c.nom},

` +
      `L'annulation de « ${c.titre} » est levée : l'événement a bien lieu.

` +
      `Ton inscription tient toujours — tu n'as rien à refaire.` +
      SIGNATURE,
  }),

  INFOLETTRE_CONFIRMATION: (c) => ({
    sujet: "Confirme ton inscription à la lettre de Baobart",
    texte:
      "Bonjour,\n\n" +
      "Quelqu'un — toi, sans doute — a inscrit cette adresse à la lettre " +
      "d'information de Baobart. Pour la recevoir, confirme ici :\n" +
      `${c.confirmer}\n\n` +
      `Le lien vaut ${c.jours} jours. Sans clic, l'adresse n'est pas inscrite ` +
      "et tu ne recevras plus rien de notre part.\n\n" +
      "Si ce n'est pas toi, ou si tu changes d'avis plus tard :\n" +
      `${c.desinscrire}` +
      SIGNATURE,
  }),

  DEMANDE_REMBOURSEMENT: (c) => ({
    sujet: `Demande de remboursement : ${c.ressource}`,
    texte:
      `Bonjour ${c.nom},\n\n` +
      `Un acheteur demande le remboursement de « ${c.ressource} » (${c.montant}). Son motif :\n\n` +
      `  « ${c.motif} »\n\n` +
      `Accepte ou refuse depuis ton tableau de bord, rubrique « Demandes de remboursement ». ` +
      `Sans réponse sous ${c.jours} jours, l'équipe Baobart tranchera à ta place.` +
      SIGNATURE,
  }),

  REMBOURSEMENT_REFUSE: (c) => ({
    sujet: `Ta demande de remboursement : ${c.ressource}`,
    texte:
      `Bonjour ${c.nom},\n\n` +
      `Ta demande de remboursement pour « ${c.ressource} » a été refusée par ${c.par}. Le motif donné :\n\n` +
      `  « ${c.motif} »\n\n` +
      `Ton achat reste accessible dans tes téléchargements.` +
      SIGNATURE,
  }),

  INFOLETTRE: (c) => ({
    sujet: c.sujet,
    texte:
      `${c.corps}\n\n` +
      "—\n" +
      "Tu reçois cette lettre parce que ton adresse est inscrite à la lettre de Baobart, et que tu l'as confirmée.\n" +
      `Te désinscrire, en un clic : ${c.desinscrire}` +
      SIGNATURE,
  }),

  PAIEMENT_ABANDONNE: (c) => ({
    sujet: `Ton achat de « ${c.ressource} » attend encore`,
    texte:
      `Bonjour ${c.nom},

` +
      `Tu as lancé l'achat de « ${c.ressource} » pour ${c.montant}, et le ` +
      `paiement n'est jamais arrivé chez nous. Cela arrive souvent : une ` +
      `invite qui se perd, un téléphone hors réseau, un code qu'on remet à ` +
      `plus tard.

` +
      `Rien n'a été débité. Tu peux reprendre là où tu t'es arrêté :
` +
      `${c.lien}

` +
      `Passé ${c.heures} heures, la commande se referme d'elle-même — ` +
      `et tu pourras la relancer quand tu voudras.` +
      SIGNATURE,
  }),

  RETRAIT_JURIDIQUE: (c) => ({
    sujet: `Contenu retiré à titre provisoire — dossier ${c.reference}`,
    texte:
      `Bonjour ${c.nom},

` +
      `Une notification nous est parvenue au sujet d'un de tes contenus, et ` +
      `nous l'avons retiré le temps de l'examiner. Le retrait est ` +
      `PROVISOIRE : rien n'est supprimé, et le contenu revient si la ` +
      `notification ne tient pas.

` +
      `Dossier : ${c.reference}

` +
      `Ce qui nous est signalé, dans les termes du notifiant :
` +
      `${c.motif}

` +
      `Tu peux répondre jusqu'au ${c.echeance}. Si tu réponds, nous ` +
      `réexaminons le dossier ; si tu ne réponds pas d'ici là, le retrait ` +
      `devient définitif.

` +
      `Nous ne jugeons pas qui a raison : nous appliquons l'article 3 de la ` +
      `loi n° 2008-08 sur les transactions électroniques, qui nous oblige à ` +
      `agir promptement une fois informés. Le litige lui-même relève du juge.` +
      (c.lien ? `

Répondre : ${c.lien}` : ""),
  }),
  CONTENU_REFUSE: (c) => ({
    sujet: `Non retenu : ${c.titre}`,
    texte:
      `Bonjour ${c.nom},

` +
      `« ${c.titre} » ne paraîtra pas en l'état. Voici pourquoi :

` +
      `${c.motif}

` +
      // Le refus n'est pas une impasse, et il faut le dire : sans cette
      // phrase, on croit que c'est terminé.
      `Corrige la fiche, remets-la en brouillon, puis renvoie-la en ` +
      `relecture. Rien n'est perdu.` +
      SIGNATURE,
  }),

  CANDIDATURE_RECUE: (c) => ({
    sujet: `Candidature : ${c.offre}`,
    texte:
      `Bonjour ${c.nom},

` +
      `Quelqu'un vient de postuler à « ${c.offre} ». Le CV est joint à sa ` +
      `fiche, dans l'écran des candidatures.

` +
      // Rappel utile : le CV disparaît à la clôture de l'offre (§22).
      `Les CV sont conservés le temps de l'offre, puis supprimés.` +
      SIGNATURE,
  }),

  INSCRIPTION_EVENEMENT: (c) => ({
    sujet: `Inscription : ${c.titre}`,
    texte:
      `Bonjour ${c.nom},

` +
      `Quelqu'un vient de s'inscrire à « ${c.titre} ».

` +
      // Ce message est éteint par défaut, précisément parce qu'il peut
      // arriver cent fois. On le rappelle à qui l'a allumé.
      `Tu reçois ce message parce que tu as demandé un courriel par ` +
      `inscription. La liste complète s'exporte depuis l'écran des inscrits.` +
      SIGNATURE,
  }),

  NOUVEL_ABONNE: (c) => ({
    sujet: "Un nouvel abonné sur Baobart",
    texte:
      `Bonjour ${c.nom},

` +
      `Quelqu'un suit désormais ta boutique. Tes prochaines publications ` +
      `apparaîtront dans son fil.

` +
      `Tu reçois ce message parce que tu l'as demandé — il est éteint par ` +
      `défaut.` +
      SIGNATURE,
  }),
};

export class ChargeInvalide extends Error {
  constructor(modele: Modele, detail: string) {
    super(`Charge invalide pour ${modele} : ${detail}`);
    this.name = "ChargeInvalide";
  }
}

/**
 * Rend un message, ou lève.
 *
 * Lever plutôt que renvoyer un message dégradé est délibéré : la file
 * enregistrera l'échec, l'écran de supervision le montrera, et personne ne
 * recevra un texte à trous.
 */
export function rendre(modele: Modele, charge: unknown): Message {
  const schema = SCHEMAS[modele];
  if (!schema) throw new ChargeInvalide(modele, "modèle inconnu");

  const lu = schema.safeParse(charge);
  if (!lu.success) {
    const detail = lu.error.issues
      .map((i) => `${i.path.join(".") || "(racine)"} ${i.message}`)
      .join(" ; ");
    throw new ChargeInvalide(modele, detail);
  }

  const rendu = (TEXTES[modele] as (c: unknown) => Message)(lu.data);
  return { sujet: sujetSur(rendu.sujet), texte: rendu.texte };
}
