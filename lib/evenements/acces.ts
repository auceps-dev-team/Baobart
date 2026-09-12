import { peut, type RolePlateforme } from "@/lib/auth/administration";
import type { Geste } from "@/lib/cms/cycle";

/**
 * Qui voit quels événements, et ce qu'il a le droit d'en faire.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE PROBLÈME QU'ON RÉSOUT ICI
 *
 * Jusqu'à v1.50.0, les événements étaient écrits par l'administration et par
 * elle seule (§18.1). Une seule question se posait — « as-tu le pouvoir
 * `publier_du_contenu` ? » — et une seule réponse suffisait : oui, tu vois
 * tout.
 *
 * Ouvrir les événements aux agences badgées en ajoute une seconde, et c'est
 * elle qui est dangereuse : **jusqu'où va ce qu'on voit ?** Une agence qui
 * ouvre `/dashboard/evenements` ne doit pas y lire les brouillons de Baobart,
 * ni la liste des inscrits d'un concours qu'elle n'organise pas.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE PORTÉE, PAS UN BOOLÉEN
 *
 * La tentation serait `estOrganisateur: boolean`, et les écrans feraient le
 * tri eux-mêmes. C'est la faute qu'on a déjà payée dans `lib/dashboard/nav.ts`
 * (v1.48.8) : quand la règle vit dans chaque écran, il suffit d'en écrire un
 * neuvième en oubliant le filtre.
 *
 * Ici, la règle rend un objet que les requêtes **traversent** :
 * `clauseDePortee` produit le `where` Prisma. Un écran qui oublie de filtrer
 * n'oublie pas un `if` — il oublie un argument, et le compilateur le dit.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE MODULE EST PUR
 *
 * Aucune requête, aucune session. On lui donne des faits déjà lus, il rend une
 * décision. C'est ce qui permet d'éprouver « une agence ne peut pas publier
 * elle-même » sans monter une base ni un navigateur.
 *
 * La lecture des faits, elle, vit dans `lib/evenements/garde.ts`.
 */

/** Ce qu'on sait de la personne au moment de décider. */
export interface Candidat {
  id: string;
  role: RolePlateforme;
  /** Porte le badge Freelance ou Agence, accordé par l'administration. */
  badgeProfessionnel: boolean;
  /** Abonnement `ACTIVE` ou dans la grâce — au sens de Ndank. */
  abonnementOuvert: boolean;
}

/**
 * Jusqu'où porte le regard.
 *
 * Deux valeurs, et pas de troisième : soit on administre les événements de la
 * plateforme, soit on gère les siens. « Ceux de mon organisation » n'existe
 * pas — il n'y a pas d'organisation dans le modèle, seulement des comptes.
 */
export type Portee =
  /** L'administration : tous les événements, quel que soit leur auteur. */
  | { etendue: "TOUT" }
  /** Une agence : les siens, et rien d'autre. */
  | { etendue: "LES_MIENS"; moi: string };

/**
 * La portée de cette personne, ou `null` si elle n'a rien à faire ici.
 *
 * `null` plutôt qu'une portée vide : une portée vide se filtre et rend une
 * liste vide, ce qui ressemble à « tu n'as pas encore d'événement » alors que
 * la vraie réponse est « cet écran n'est pas pour toi ». Les deux méritent des
 * pages différentes — l'une invite à créer, l'autre répond 404.
 *
 * L'ordre des conditions compte : l'administration est testée **avant** le
 * badge. Un administrateur qui porterait aussi le badge Agence doit voir tout,
 * pas seulement ses propres événements.
 */
export function porteeDe(qui: Candidat | null): Portee | null {
  if (qui === null) return null;

  if (peut(qui.role, "publier_du_contenu")) return { etendue: "TOUT" };

  // Les deux conditions de §18.3, relues à chaque passage : le badge dit que
  // le compte a été vérifié, l'abonnement qu'il l'est encore aujourd'hui.
  if (!qui.badgeProfessionnel || !qui.abonnementOuvert) return null;

  return { etendue: "LES_MIENS", moi: qui.id };
}

/**
 * Le fragment de `where` qui borne une requête à sa portée.
 *
 * Rendre un objet plutôt que d'exposer un booléen est ce qui rend l'oubli
 * difficile : on l'étale dans le `where`, et une requête qui ne l'étale pas se
 * repère à l'œil nu.
 *
 * `{}` pour l'administration — l'absence de contrainte, écrite. C'est le seul
 * endroit du module où « ne rien filtrer » est une décision, et non un oubli.
 */
export function clauseDePortee(portee: Portee): { organizerId?: string } {
  return portee.etendue === "TOUT" ? {} : { organizerId: portee.moi };
}

/**
 * Cet événement-là tombe-t-il dans la portée ?
 *
 * Sert quand la ligne est déjà lue — un écran qui a chargé l'événement avant
 * de décider. Les requêtes, elles, passent par `clauseDePortee` : filtrer dans
 * le `WHERE` évite de rapatrier ce qu'on n'a pas le droit de lire.
 */
export function couvre(portee: Portee, organisateurId: string): boolean {
  return portee.etendue === "TOUT" || portee.moi === organisateurId;
}

/**
 * Les gestes qu'un organisateur peut poser sur son propre événement.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * `publier` N'Y EST PAS, ET C'EST TOUTE LA SÛRETÉ DE L'OUVERTURE
 *
 * Une agence badgée écrit son atelier, puis l'**envoie en relecture**. Quelqu'un
 * de l'équipe le lit et le publie. C'est le même régime que les services et
 * les offres d'emploi, et il repose sur une idée simple : le badge dit que le
 * compte est réel, pas que tout ce qu'il écrira sera juste.
 *
 * Sans cette liste, l'ouverture donnerait à n'importe quelle agence badgée le
 * droit de mettre en ligne une page qui collecte des noms et des adresses,
 * sans que personne ne l'ait lue.
 *
 * `refuser` n'y est pas non plus, pour la raison inverse : on ne se refuse pas
 * à soi-même. C'est un geste de relecteur.
 *
 * `retirer` et `reprendre` y sont : dépublier son propre événement et le
 * remettre en brouillon sont des corrections, pas des mises en ligne. Un
 * organisateur qui s'aperçoit d'une erreur doit pouvoir retirer sa fiche
 * **tout de suite**, sans attendre qu'on lui réponde.
 */
export const GESTES_ORGANISATEUR: readonly Geste[] = [
  "soumettre",
  "retirer",
  "reprendre",
];

/** Ce geste-là est-il permis à cette portée ? */
export function gestePermis(portee: Portee, geste: Geste): boolean {
  return portee.etendue === "TOUT" || GESTES_ORGANISATEUR.includes(geste);
}

/**
 * Le vocabulaire de l'écran change avec la portée.
 *
 * Parler d'« administration des événements » à une agence lui ferait croire
 * qu'elle voit ceux des autres ; parler de « mes événements » à l'équipe lui
 * ferait croire l'inverse. Le titre est une garde de plus — celle qui dit à
 * qui lit ce qu'il est en train de regarder.
 */
export function intitule(portee: Portee): {
  titre: string;
  description: string;
} {
  return portee.etendue === "TOUT"
    ? {
        titre: "Événements",
        description:
          "Concours, ateliers, conférences, expositions — les tiens et ceux des agences. Rien ne paraît tant que c'est un brouillon.",
      }
    : {
        titre: "Mes événements",
        description:
          "Ceux que tu organises, et eux seuls. Tu les écris, l'équipe Baobart les relit avant leur mise en ligne.",
      };
}
