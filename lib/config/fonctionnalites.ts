/**
 * Les interrupteurs d'exploitation.
 *
 * Quand le stockage se met à répondre de travers un dimanche soir, il faut
 * pouvoir fermer l'envoi de fichiers sans attendre un redéploiement. C'est tout
 * ce que fait ce module : offrir une poignée, par variable d'environnement.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UN DRAPEAU NE PEUT QUE FERMER
 *
 * La tentation, avec ce genre de table, est d'écrire `FEATURE_CHECKOUT=1` et de
 * croire le passage en caisse ouvert. Il ne le serait pas : le code n'existe
 * pas. Un interrupteur qui prétend allumer une pièce sans ampoule fait perdre
 * une heure à celui qui le croit.
 *
 * D'où la règle tenue ici : chaque fonctionnalité déclare si son code est
 * **livré**, et la variable d'environnement ne peut que la refermer. Demander
 * l'ouverture de ce qui n'est pas écrit ne produit rien — sinon un motif qui
 * dit pourquoi.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QUI N'A DÉLIBÉRÉMENT PAS DE DRAPEAU
 *
 * La livraison des fichiers achetés. Un interrupteur qui la coupe retirerait à
 * des gens ce qu'ils ont déjà payé — la panne qu'on croit contenir devient un
 * manquement au contrat. Si la livraison doit s'arrêter, que ce soit par une
 * décision explicite dans le code, relue, pas par une variable qu'on pousse à
 * deux heures du matin.
 */

/** Les fonctionnalités qu'un exploitant peut fermer. */
export type IdFonctionnalite = "envoi_fichiers" | "versements";

interface Declaration {
  id: IdFonctionnalite;
  libelle: string;
  variable: string;
  /**
   * Le code existe-t-il ? Passe à `true` le jour où le module est livré, pas
   * le jour où on décide de l'écrire.
   */
  livree: boolean;
  /** Ce qui manque encore, quand ce n'est pas livré. */
  manque?: string;
}

const DECLARATIONS: Declaration[] = [
  {
    id: "envoi_fichiers",
    libelle: "Envoi de fichiers",
    variable: "FEATURE_ENVOI_FICHIERS",
    livree: true,
  },
  {
    id: "versements",
    libelle: "Préparation des versements",
    variable: "FEATURE_VERSEMENTS",
    livree: true,
  },
];

export interface EtatFonctionnalite {
  id: IdFonctionnalite;
  libelle: string;
  ouverte: boolean;
  /** Pourquoi elle est dans cet état — destiné aux journaux, pas à l'acheteur. */
  motif: string;
}

/**
 * Une variable absente laisse ouvert.
 *
 * L'inverse serait un piège : oublier une variable dans un environnement
 * couperait la fonctionnalité en silence, et la panne se chercherait dans le
 * code. Fermer doit être un geste, jamais un oubli.
 */
function fermeePar(valeur: string | undefined): boolean {
  if (valeur === undefined) return false;
  const v = valeur.trim().toLowerCase();
  return v === "0" || v === "false" || v === "off" || v === "non";
}

/** Le cœur, pur : on lui passe l'environnement plutôt qu'il n'aille le lire. */
export function etatDes(
  env: Record<string, string | undefined>,
): EtatFonctionnalite[] {
  return DECLARATIONS.map((d) => {
    if (!d.livree) {
      return {
        id: d.id,
        libelle: d.libelle,
        ouverte: false,
        motif: d.manque
          ? `pas encore écrite : ${d.manque}`
          : "pas encore écrite",
      };
    }

    if (fermeePar(env[d.variable])) {
      return {
        id: d.id,
        libelle: d.libelle,
        ouverte: false,
        motif: `fermée par ${d.variable}`,
      };
    }

    return { id: d.id, libelle: d.libelle, ouverte: true, motif: "ouverte" };
  });
}

/** La question qu'un appelant se pose vraiment. */
export function estOuverte(
  id: IdFonctionnalite,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return etatDes(env).find((e) => e.id === id)?.ouverte ?? false;
}
