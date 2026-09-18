import { peut, type RolePlateforme } from "@/lib/auth/administration";

/**
 * Qui voit quoi dans une communauté, et qui peut y agir.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * C'EST LE FICHIER LE PLUS RISQUÉ DU MODULE
 *
 * Une erreur ici ne casse rien : elle **fuit**. Des conversations privées
 * deviennent lisibles, et personne ne s'en aperçoit — ni l'écran, ni les
 * journaux, ni un test qui ne l'aurait pas demandé.
 *
 * D'où un module pur, écrit avant les écrans et avant les requêtes : la règle
 * s'éprouve sans base, et chaque combinaison a son test.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TROIS VISIBILITÉS, ET ELLES NE DIFFÈRENT PAS SUR LE MÊME AXE
 *
 * La pente naturelle est de les croire graduées — « publique, moins publique,
 * pas publique ». Elles répondent en fait à **deux questions distinctes** :
 *
 *                    apparaît dans l'annuaire ?   contenu lisible sans être membre ?
 *   PUBLIC                    oui                            oui
 *   PRIVATE                   oui                            non
 *   INVITE_ONLY               non                            non
 *
 * `PRIVATE` est listée exprès : c'est ce qui permet de demander à entrer. Une
 * communauté qu'on ne peut pas trouver ne recrute personne.
 *
 * `INVITE_ONLY` n'apparaît nulle part — et c'est une garantie, pas un réglage
 * de confort : son existence même est une information. Un espace d'entraide
 * entre créateurs qui traversent un litige n'a pas à figurer dans une liste.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN MODÉRATEUR DE LA PLATEFORME NE SE PROMÈNE PAS
 *
 * La tentation serait de donner à `moderer_le_contenu` le droit de tout lire
 * « au cas où ». C'est le dessin de la surveillance, et il ne sert pas la
 * modération : on ne modère pas ce qu'on n'a pas été appelé à voir.
 *
 * Ce module ne lui ouvre donc **rien** de plus qu'à un visiteur. Son chemin
 * passe par le signalement : un contenu signalé remonte dans la file avec son
 * contexte, et c'est là qu'il le lit. Le droit d'y accéder est attaché au
 * signalement, pas à la personne.
 *
 * La seule exception est `SUPER_ADMIN`, et elle est nommée pour ce qu'elle
 * est : une porte de secours d'exploitation, pas un usage courant.
 */

export type Visibilite = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";

/** Le rôle **dans la communauté**, sans rapport avec `RolePlateforme`. */
export type RoleForum = "MEMBER" | "MODERATOR" | "ADMIN";

export interface Communaute {
  id: string;
  visibilite: Visibilite;
  /** Qui l'a ouverte. Toujours administrateur de son espace. */
  createurId: string;
  /** Une communauté close ne se lit plus et ne s'écrit plus. */
  active: boolean;
}

/**
 * Ce qu'on sait de la personne au moment de décider.
 *
 * `null` veut dire « personne » — un visiteur non connecté. C'est un cas à
 * part entière : il peut lire une communauté publique.
 */
export interface Visiteur {
  id: string;
  role: RolePlateforme;
  /** Son rôle dans CETTE communauté, ou `null` si elle n'en est pas membre. */
  appartenance: RoleForum | null;
}

/**
 * Ce qu'une personne peut faire dans une communauté.
 *
 * Un objet plutôt que six fonctions : les écrans en ont besoin ensemble — on
 * n'affiche pas un bouton « écrire » sans savoir si l'on peut lire. Les
 * calculer d'un coup évite aussi qu'un écran en oublie un.
 */
export interface Droits {
  /** Voir la communauté exister : son nom, sa description, son effectif. */
  voir: boolean;
  /** Lire les sujets et les messages. */
  lire: boolean;
  /** Ouvrir un sujet, répondre. */
  ecrire: boolean;
  /** Épingler, verrouiller, retirer le message d'un autre. */
  moderer: boolean;
  /** Changer la communauté elle-même : nom, visibilité, catégories. */
  administrer: boolean;
  /** Demander à rejoindre. Faux quand on est déjà membre. */
  demanderAAdherer: boolean;
}

const RIEN: Droits = {
  voir: false,
  lire: false,
  ecrire: false,
  moderer: false,
  administrer: false,
  demanderAAdherer: false,
};

export function droitsSur(
  communaute: Communaute,
  visiteur: Visiteur | null,
): Droits {
  // ── Une communauté close est fermée à tout le monde ──────────────────────
  //
  // Y compris à son créateur, et y compris en lecture. Fermer veut dire
  // fermer : laisser la porte entrouverte pour son propriétaire ferait
  // « close » vouloir dire « cachée », et personne ne saurait plus lequel des
  // deux on a demandé.
  //
  // Le `SUPER_ADMIN` passe outre — il faut bien que quelqu'un puisse constater
  // ce qu'on a fermé, et éventuellement le rouvrir.
  if (!communaute.active) {
    return visiteur && peut(visiteur.role, "agir_sur_l_exploitation")
      ? { ...RIEN, voir: true, lire: true, administrer: true }
      : RIEN;
  }

  const membre = visiteur?.appartenance ?? null;
  const estCreateur = visiteur?.id === communaute.createurId;

  // Le créateur administre son espace, qu'il ait ou non une ligne
  // d'appartenance. Dépendre de la ligne ferait qu'une adhésion supprimée par
  // erreur le mettrait dehors de chez lui.
  const administrer = estCreateur || membre === "ADMIN";
  const moderer = administrer || membre === "MODERATOR";

  const voir =
    communaute.visibilite !== "INVITE_ONLY" || membre !== null || estCreateur;

  const lire =
    communaute.visibilite === "PUBLIC" || membre !== null || estCreateur;

  // ── Écrire demande TOUJOURS d'être membre ────────────────────────────────
  //
  // Même dans une communauté publique. C'est ce qui distingue une communauté
  // d'un espace de commentaires : on y entre, et l'on peut en sortir quelqu'un.
  // Sans appartenance, il n'y a rien à retirer à qui se comporte mal.
  const ecrire = membre !== null || estCreateur;

  return {
    voir,
    lire,
    ecrire,
    moderer,
    administrer,
    // On ne demande pas à entrer là où l'on est déjà, ni là qu'on ne voit pas.
    demanderAAdherer:
      visiteur !== null && membre === null && !estCreateur && voir,
  };
}

/**
 * Les communautés qu'on peut faire figurer dans une liste.
 *
 * Rendu comme un fragment de `where` Prisma, sur le même principe que
 * `clauseDePortee` pour les événements : la règle traverse la requête au lieu
 * d'être rejouée après coup.
 *
 * Filtrer après la lecture marcherait aussi — et ferait rapatrier des lignes
 * qu'on n'a pas le droit de voir, ce qui est exactement ce qu'on cherche à
 * éviter. La pagination, elle, ne marcherait plus du tout.
 */
export type ClauseAnnuaire = {
  status: "active";
  OR: Array<
    | { visibility: Visibilite }
    | { members: { some: { userId: string } } }
    | { creatorId: string }
  >;
};

export function clauseAnnuaire(visiteurId: string | null): ClauseAnnuaire {
  const ouvertes: ClauseAnnuaire["OR"] = [
    { visibility: "PUBLIC" },
    { visibility: "PRIVATE" },
  ];

  return {
    status: "active",
    OR:
      visiteurId === null
        ? ouvertes
        : [
            ...ouvertes,
            // Les espaces sur invitation n'apparaissent qu'à ceux qui en sont.
            { members: { some: { userId: visiteurId } } },
            { creatorId: visiteurId },
          ],
  };
}

/**
 * Le rôle qui permet de retirer le message de quelqu'un d'autre.
 *
 * Son propre message se retire toujours — c'est traité à part, parce que ça ne
 * dépend pas du rôle mais de la paternité.
 */
export function peutRetirerLeMessageDUnAutre(droits: Droits): boolean {
  return droits.moderer;
}
