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

export type RolePlateforme = "MEMBER" | "ADMIN" | "SUPER_ADMIN";

export type Pouvoir =
  /** Lire l'état technique : base, stockage, fournisseurs, interrupteurs. */
  | "consulter_le_systeme"
  /** Agir sur l'exploitation : rejouer un envoi, marquer un incident revu. */
  | "agir_sur_l_exploitation"
  /** Nommer et révoquer des administrateurs. */
  | "gerer_les_roles";

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
  ADMIN: ["consulter_le_systeme", "agir_sur_l_exploitation"],
  SUPER_ADMIN: [
    "consulter_le_systeme",
    "agir_sur_l_exploitation",
    "gerer_les_roles",
  ],
};

export function peut(role: RolePlateforme, pouvoir: Pouvoir): boolean {
  return POUVOIRS[role]?.includes(pouvoir) ?? false;
}

/** Le seuil d'entrée de l'espace d'administration. */
export function estAdministrateur(role: RolePlateforme): boolean {
  return peut(role, "consulter_le_systeme");
}

/** Libellé affichable — la maquette dit « Super admin », pas « SUPER_ADMIN ». */
export const LIBELLE_ROLE: Record<RolePlateforme, string> = {
  MEMBER: "Membre",
  ADMIN: "Administrateur",
  SUPER_ADMIN: "Super admin",
};
