/**
 * Qui a la main sur la plateforme, et jusqu'où.
 *
 * À ne pas confondre avec `lib/auth/roles.ts`, qui décrit le chemin acheteur →
 * créateur. Celui-là se **déduit** de l'activité : publier une ressource ouvre
 * l'atelier. Celui-ci ne se déduit de rien — l'administration s'accorde, et
 * seulement depuis la base.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI DEUX NIVEAUX
 *
 * La maquette les distingue déjà (« dont 2 super admins »), et la distinction
 * tient : consulter l'état de la plateforme et distribuer les pouvoirs ne
 * demandent pas la même confiance. Un compte d'astreinte doit pouvoir lire un
 * diagnostic à trois heures du matin sans pouvoir, du même geste, se nommer
 * super administrateur.
 *
 * Ce module est pur : il décide à partir d'un rôle qu'on lui donne, il ne va
 * pas le chercher. La lecture de la session vit dans `acces-administration.ts`,
 * ce qui rend ces règles-ci exerçables par un test.
 */

export type RolePlateforme =
  | "MEMBER"
  | "CONTENT_MANAGER"
  | "MARKETING"
  | "MODERATOR"
  | "SUPPORT"
  | "ACCOUNTANT"
  | "COMPLIANCE"
  | "ADMIN"
  | "SUPER_ADMIN";

export type Pouvoir =
  /** Lire l'état technique : base, stockage, fournisseurs, interrupteurs. */
  | "consulter_le_systeme"
  /** Agir sur l'exploitation : rejouer un envoi, marquer un incident revu. */
  | "agir_sur_l_exploitation"
  /** Nommer et révoquer des administrateurs. */
  | "gerer_les_roles"
  /** Écrire et publier : articles, événements. */
  | "publier_du_contenu"
  /** Mettre en avant : sponsoring, sélections, infolettres. */
  | "promouvoir_du_contenu"
  /** Approuver ou refuser ce que les autres publient. */
  | "moderer_le_contenu"
  /** Lire les versements, les soldes et les rapports. */
  | "consulter_l_argent"
  /** Rejouer un versement, en déclencher un à la main. */
  | "agir_sur_l_argent"
  /** Rembourser, trancher un litige, répondre à un ticket. */
  | "traiter_les_litiges"
  /** KYC, états de risque, suspension d'un compte. */
  | "gerer_la_conformite"
  /** Lire le journal d'audit. */
  | "consulter_l_audit";

/**
 * Chaque rôle porte ses pouvoirs en entier, sans héritage implicite.
 *
 * Écrire « SUPER_ADMIN hérite d'ADMIN » économiserait trois lignes et coûterait
 * la relecture : pour savoir ce qu'un rôle peut faire, il faudrait remonter une
 * chaîne. Ici la réponse tient sur une ligne, et retirer un pouvoir à un rôle
 * ne peut pas en déshabiller un autre par surprise.
 */
const POUVOIRS: Record<RolePlateforme, readonly Pouvoir[]> = {
  MEMBER: [],

  CONTENT_MANAGER: ["publier_du_contenu"],
  MARKETING: ["promouvoir_du_contenu"],
  MODERATOR: ["moderer_le_contenu"],
  SUPPORT: ["traiter_les_litiges"],
  ACCOUNTANT: ["consulter_l_argent", "agir_sur_l_argent"],
  // La conformité lit l'audit : c'est là qu'on retrouve qui a changé quoi sur
  // un dossier contesté, et c'est son métier de le savoir.
  COMPLIANCE: ["gerer_la_conformite", "consulter_l_audit"],

  // ADMIN est le généraliste : toutes les fonctions, jamais la distribution des
  // pouvoirs. Un compte d'astreinte doit pouvoir tout réparer à trois heures du
  // matin sans pouvoir, du même geste, se nommer super administrateur.
  ADMIN: [
    "consulter_le_systeme",
    "agir_sur_l_exploitation",
    "publier_du_contenu",
    "promouvoir_du_contenu",
    "moderer_le_contenu",
    "consulter_l_argent",
    "agir_sur_l_argent",
    "traiter_les_litiges",
    "gerer_la_conformite",
    "consulter_l_audit",
  ],

  SUPER_ADMIN: [
    "consulter_le_systeme",
    "agir_sur_l_exploitation",
    "gerer_les_roles",
    "publier_du_contenu",
    "promouvoir_du_contenu",
    "moderer_le_contenu",
    "consulter_l_argent",
    "agir_sur_l_argent",
    "traiter_les_litiges",
    "gerer_la_conformite",
    "consulter_l_audit",
  ],
};

export function peut(role: RolePlateforme, pouvoir: Pouvoir): boolean {
  return POUVOIRS[role]?.includes(pouvoir) ?? false;
}

/**
 * Le seuil des écrans **Système**.
 *
 * ───────────────────────────────────────────────────────────────────────
 * CE N'EST PAS « A ACCÈS AU BACK-OFFICE »
 *
 * Un modérateur entre dans le back-office et n'a rien à faire dans les écrans
 * techniques — base de données, stockage, interrupteurs. Confondre les deux
 * élargirait les droits de six rôles d'un seul coup, sans qu'aucun écran ne
 * change d'apparence.
 *
 * Le seuil du back-office, lui, est `aAccesAuBackOffice`.
 */
export function estAdministrateur(role: RolePlateforme): boolean {
  return peut(role, "consulter_le_systeme");
}

/**
 * A-t-on quelque chose à faire dans le back-office ?
 *
 * Dérivé de la matrice plutôt qu'énuméré : ajouter un rôle sans pouvoir le
 * laisserait dehors, ce qui est le bon défaut. Un rôle sans pouvoir n'est pas
 * un administrateur, c'est une ligne oubliée.
 */
export function aAccesAuBackOffice(role: RolePlateforme): boolean {
  return (POUVOIRS[role]?.length ?? 0) > 0;
}

/** Tous les pouvoirs d'un rôle, pour afficher ce que quelqu'un peut faire. */
export function pouvoirsDe(role: RolePlateforme): readonly Pouvoir[] {
  return POUVOIRS[role] ?? [];
}

/** Libellé affichable — la maquette dit « Super admin », pas « SUPER_ADMIN ». */
export const LIBELLE_ROLE: Record<RolePlateforme, string> = {
  MEMBER: "Membre",
  CONTENT_MANAGER: "Éditorial",
  MARKETING: "Marketing",
  MODERATOR: "Modération",
  SUPPORT: "Support",
  ACCOUNTANT: "Comptabilité",
  COMPLIANCE: "Conformité",
  ADMIN: "Administrateur",
  SUPER_ADMIN: "Super admin",
};

/** Ce que chaque pouvoir permet, dit à quelqu'un qui distribue les rôles. */
export const LIBELLE_POUVOIR: Record<Pouvoir, string> = {
  consulter_le_systeme: "Lire l'état technique de la plateforme",
  agir_sur_l_exploitation: "Rejouer un envoi, marquer un incident revu",
  gerer_les_roles: "Nommer et révoquer des administrateurs",
  publier_du_contenu: "Écrire et publier articles et événements",
  promouvoir_du_contenu: "Mettre en avant, sponsoriser, envoyer une infolettre",
  moderer_le_contenu: "Approuver ou refuser ce que publient les autres",
  consulter_l_argent: "Lire les versements, les soldes et les rapports",
  agir_sur_l_argent: "Rejouer ou déclencher un versement",
  traiter_les_litiges: "Rembourser, trancher un litige, répondre à un ticket",
  gerer_la_conformite: "KYC, états de risque, suspension d'un compte",
  consulter_l_audit: "Lire le journal d'audit",
};
