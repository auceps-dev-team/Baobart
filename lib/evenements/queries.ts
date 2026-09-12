import "server-only";

import { db } from "@/lib/db";
import type { EtatContenu } from "@/lib/cms/cycle";
import { clauseDePortee, type Portee } from "@/lib/evenements/acces";
import type { EventKind } from "@/lib/evenements/enums";
import { phaseDe, type Phase } from "@/lib/evenements/phases";

/**
 * Ce que le tableau de bord lit des événements.
 *
 * La lecture **publique** vit plus bas dans ce fichier et ne montre que
 * `PUBLIE`. Ici on voit tout — brouillons compris — parce que c'est l'écran
 * depuis lequel on travaille.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CHAQUE LECTURE PREND UNE PORTÉE, ET C'EST OBLIGATOIRE
 *
 * Depuis v1.51.0, ces écrans ne servent plus la seule administration : une
 * agence badgée y gère ses propres événements. La question « jusqu'où vois-tu ? »
 * se pose donc à chaque requête.
 *
 * `Portee` est un paramètre **requis**, jamais une option avec un défaut
 * permissif. Un défaut à « tout » serait exactement le défaut qu'on a payé
 * dans `lib/dashboard/nav.ts` : l'oubli ouvrirait au lieu de fermer. Ici,
 * l'oubli ne compile pas.
 */

export interface LigneAdmin {
  id: string;
  titre: string;
  genre: EventKind;
  etat: EtatContenu;
  /** Calculée, jamais lue d'une colonne. Voir `lib/evenements/phases.ts`. */
  phase: Phase;
  debut: Date;
  fin: Date;
  lieu: string | null;
  enLigne: boolean;
  capacite: number | null;
  inscrits: number;
  annuleLe: Date | null;
  organisateur: string;
}

/** Ce qu'il faut pour préremplir le formulaire d'édition. */
export interface EvenementAEditer {
  id: string;
  titre: string;
  description: string;
  genre: EventKind;
  etat: EtatContenu;
  debut: Date;
  fin: Date;
  lieu: string | null;
  enLigne: boolean;
  capacite: number | null;
  prixBillet: number | null;
  dotation: number | null;
  annuleLe: Date | null;
  raisonAnnulation: string | null;
  inscrits: number;
}

/**
 * Les événements de cette portée, du plus proche au plus lointain.
 *
 * Trié par date de début **décroissante** : l'écran sert à préparer ce qui
 * vient, et ce qui vient est en haut. Trier par date de création mettrait un
 * brouillon d'il y a six mois avant l'atelier de la semaine prochaine.
 */
export async function listerDansLaPortee(
  portee: Portee,
  limite = 100,
  maintenant = new Date(),
): Promise<LigneAdmin[]> {
  const lignes = await db.event.findMany({
    where: clauseDePortee(portee),
    orderBy: { startsAt: "desc" },
    take: Math.min(limite, 300),
    select: {
      id: true,
      title: true,
      kind: true,
      state: true,
      startsAt: true,
      endsAt: true,
      location: true,
      isOnline: true,
      capacity: true,
      participantsCount: true,
      cancelledAt: true,
      organizer: {
        select: { email: true, profile: { select: { displayName: true } } },
      },
    },
  });

  return lignes.map((e) => ({
    id: e.id,
    titre: e.title,
    genre: e.kind as EventKind,
    etat: e.state,
    phase: phaseDe(e.startsAt, e.endsAt, maintenant),
    debut: e.startsAt,
    fin: e.endsAt,
    lieu: e.location,
    enLigne: e.isOnline,
    capacite: e.capacity,
    inscrits: e.participantsCount,
    annuleLe: e.cancelledAt,
    organisateur: e.organizer.profile?.displayName ?? e.organizer.email,
  }));
}

/**
 * Un événement, pour l'écran d'édition.
 *
 * `null` s'il n'existe plus **ou s'il sort de la portée** — les deux se
 * confondent volontairement. L'écran répond 404 dans les deux cas, et une
 * agence qui tape l'identifiant d'un concours qu'elle n'organise pas
 * n'apprend pas qu'il existe.
 *
 * `findFirst` et non `findUnique` : on ajoute une condition à la clé primaire,
 * ce que `findUnique` n'accepte pas.
 */
export async function evenementAEditer(
  id: string,
  portee: Portee,
): Promise<EvenementAEditer | null> {
  const e = await db.event.findFirst({
    where: { id, ...clauseDePortee(portee) },
    select: {
      id: true,
      title: true,
      description: true,
      kind: true,
      state: true,
      startsAt: true,
      endsAt: true,
      location: true,
      isOnline: true,
      capacity: true,
      ticketPrice: true,
      prizeAmount: true,
      cancelledAt: true,
      cancelReason: true,
      participantsCount: true,
    },
  });

  if (!e) return null;

  return {
    id: e.id,
    titre: e.title,
    description: e.description,
    genre: e.kind as EventKind,
    etat: e.state,
    debut: e.startsAt,
    fin: e.endsAt,
    lieu: e.location,
    enLigne: e.isOnline,
    capacite: e.capacity,
    prixBillet: e.ticketPrice,
    dotation: e.prizeAmount,
    annuleLe: e.cancelledAt,
    raisonAnnulation: e.cancelReason,
    inscrits: e.participantsCount,
  };
}

// ════════════════════════════════════════════════════════════════ les inscrits ══

export interface Inscrit {
  id: string;
  nom: string;
  courriel: string;
  username: string | null;
  ville: string | null;
  billetPaye: number | null;
  inscritLe: Date;
}

/**
 * Qui s'est inscrit — pour l'organisateur, et pour lui seul.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * C'EST UNE LISTE DE DONNÉES PERSONNELLES
 *
 * Des noms, des adresses de courriel, et le fait que ces personnes seront
 * quelque part à une date donnée. Elle ne sort pas de l'écran qui la sert, et
 * l'export n'est pas public.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CETTE FONCTION NE GARDE RIEN, ET C'EST DIT ICI POUR QU'ON NE S'Y TROMPE PAS
 *
 * Elle rend les inscrits de l'événement qu'on lui nomme, sans poser de
 * question. La garde vit **avant** elle, chez ses deux appelants — l'écran
 * `/dashboard/evenements/<id>/inscrits` et la route d'export CSV — et elle a
 * la même forme aux deux endroits : on charge d'abord l'événement avec
 * `clauseDePortee(portee)` dans le `where` ; s'il ne revient rien, on répond
 * 404 et l'on n'arrive jamais ici.
 *
 * Jusqu'à v1.50.0 la garde était `publier_du_contenu`, et ce commentaire
 * expliquait pourquoi l'identité de l'organisateur ne décidait pas — les
 * événements étaient écrits par l'équipe, à plusieurs. Depuis que les agences
 * y écrivent, elle décide : une liste de noms, d'adresses et de présences à
 * une date n'appartient qu'à qui organise.
 *
 * L'administration, elle, garde l'accès à toutes — c'est `Portee.TOUT` qui le
 * dit, et il faut bien que quelqu'un puisse prévenir les inscrits d'un
 * événement qu'on vient d'annuler.
 */
export async function inscritsDe(evenementId: string): Promise<Inscrit[]> {
  const lignes = await db.eventRegistration.findMany({
    where: { eventId: evenementId },
    // Le plus ancien d'abord : c'est l'ordre d'arrivée, et c'est celui qu'on
    // suit pour une liste d'attente ou un émargement.
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      ticketPaid: true,
      createdAt: true,
      user: {
        select: {
          email: true,
          profile: { select: { displayName: true, username: true, city: true } },
        },
      },
    },
  });

  return lignes.map((l) => ({
    id: l.id,
    nom: l.user.profile?.displayName ?? l.user.email,
    courriel: l.user.email,
    username: l.user.profile?.username ?? null,
    ville: l.user.profile?.city ?? null,
    billetPaye: l.ticketPaid,
    inscritLe: l.createdAt,
  }));
}

// ══════════════════════════════════════════════════════════════ lecture publique ══

export interface EvenementPublic {
  id: string;
  titre: string;
  description: string;
  genre: EventKind;
  phase: Phase;
  debut: Date;
  fin: Date;
  lieu: string | null;
  enLigne: boolean;
  capacite: number | null;
  inscrits: number;
  prixBillet: number | null;
  devise: string;
  dotation: number | null;
  annuleLe: Date | null;
  raisonAnnulation: string | null;
  organisateur: string;
  organisateurUsername: string | null;
  coverUrl: string | null;
}

/**
 * La seule clause de visibilité publique, et elle vit ici.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UNE SEULE CONDITION, ET C'EST VOULU
 *
 * Jobs en porte deux — état **et** échéance — parce qu'une offre périmée
 * n'aide personne. Événements n'en porte qu'une : l'état. Un événement passé
 * reste consultable, on vient y lire ce qui s'est produit (§24.3).
 *
 * Un annulé reste visible lui aussi : ses inscrits ont noté la date, et les
 * envoyer sur une page absente les laisserait chercher (§24.4).
 */
const CLAUSE_PUBLIQUE = { state: "PUBLIE" } as const;

const SELECTION_PUBLIQUE = {
  id: true,
  title: true,
  description: true,
  kind: true,
  startsAt: true,
  endsAt: true,
  location: true,
  isOnline: true,
  capacity: true,
  participantsCount: true,
  ticketPrice: true,
  currency: true,
  prizeAmount: true,
  cancelledAt: true,
  cancelReason: true,
  coverUrl: true,
  organizer: {
    select: {
      email: true,
      profile: { select: { displayName: true, username: true } },
    },
  },
} as const;

type LignePublique = {
  id: string;
  title: string;
  description: string;
  kind: string;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  isOnline: boolean;
  capacity: number | null;
  participantsCount: number;
  ticketPrice: number | null;
  currency: string;
  prizeAmount: number | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  coverUrl: string | null;
  organizer: {
    email: string;
    profile: { displayName: string; username: string | null } | null;
  };
};

function versPublic(e: LignePublique, maintenant: Date): EvenementPublic {
  return {
    id: e.id,
    titre: e.title,
    description: e.description,
    genre: e.kind as EventKind,
    phase: phaseDe(e.startsAt, e.endsAt, maintenant),
    debut: e.startsAt,
    fin: e.endsAt,
    lieu: e.location,
    enLigne: e.isOnline,
    capacite: e.capacity,
    inscrits: e.participantsCount,
    prixBillet: e.ticketPrice,
    devise: e.currency,
    dotation: e.prizeAmount,
    annuleLe: e.cancelledAt,
    raisonAnnulation: e.cancelReason,
    organisateur: e.organizer.profile?.displayName ?? e.organizer.email,
    organisateurUsername: e.organizer.profile?.username ?? null,
    coverUrl: e.coverUrl,
  };
}

/**
 * Les événements visibles — à venir d'abord, passés ensuite.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DEUX REQUÊTES, ET C'EST PLUS HONNÊTE QU'UN TRI UNIQUE
 *
 * Un seul `orderBy` ne sait pas exprimer « les prochains du plus proche au
 * plus lointain, puis les passés du plus récent au plus ancien » — les deux
 * moitiés se trient dans des sens opposés autour d'un pivot qui est l'instant
 * présent.
 *
 * On aurait pu tout rapatrier et trier en mémoire ; sur un catalogue qui
 * grandit, ce serait charger des années d'archives pour afficher quarante
 * lignes. Deux requêtes bornées disent exactement ce qu'on veut.
 */
export async function listerPublics(input: {
  genre?: EventKind;
  limite?: number;
  maintenant?: Date;
} = {}): Promise<EvenementPublic[]> {
  const maintenant = input.maintenant ?? new Date();
  const limite = Math.min(input.limite ?? 40, 100);
  const filtreGenre = input.genre ? { kind: input.genre } : {};

  const [aVenir, passes] = await Promise.all([
    db.event.findMany({
      // `endsAt` et non `startsAt` : un événement commencé est encore d'actualité
      // — c'est même celui qu'on veut voir en premier.
      where: { ...CLAUSE_PUBLIQUE, ...filtreGenre, endsAt: { gt: maintenant } },
      orderBy: { startsAt: "asc" },
      take: limite,
      select: SELECTION_PUBLIQUE,
    }),
    db.event.findMany({
      where: { ...CLAUSE_PUBLIQUE, ...filtreGenre, endsAt: { lte: maintenant } },
      orderBy: { startsAt: "desc" },
      take: limite,
      select: SELECTION_PUBLIQUE,
    }),
  ]);

  return [...aVenir, ...passes]
    .slice(0, limite)
    .map((e) => versPublic(e, maintenant));
}

/**
 * Celui qu'on met en tête de page : le prochain à commencer.
 *
 * La maquette réserve cet encart à « l'édition en cours » d'un concours. On
 * élargit aux quatre genres, faute de quoi la page serait vide les semaines
 * sans concours — et un bandeau vide vaut moins qu'un bandeau qui annonce
 * l'atelier de jeudi.
 *
 * Un événement annulé n'y a pas sa place : on met en avant ce à quoi on peut
 * encore venir.
 */
export async function prochainEvenement(
  maintenant = new Date(),
): Promise<EvenementPublic | null> {
  const e = await db.event.findFirst({
    where: {
      ...CLAUSE_PUBLIQUE,
      cancelledAt: null,
      endsAt: { gt: maintenant },
    },
    orderBy: { startsAt: "asc" },
    select: SELECTION_PUBLIQUE,
  });

  return e ? versPublic(e, maintenant) : null;
}

/** Une fiche, si elle est publique. `null` autrement. */
export async function evenementPublic(
  id: string,
  maintenant = new Date(),
): Promise<EvenementPublic | null> {
  const e = await db.event.findFirst({
    where: { id, ...CLAUSE_PUBLIQUE },
    select: SELECTION_PUBLIQUE,
  });

  return e ? versPublic(e, maintenant) : null;
}

/**
 * Une date au format qu'attend `<input type="datetime-local">`.
 *
 * On coupe l'ISO à la minute : « 2026-10-10T14:00 ». Les secondes feraient
 * refuser la valeur par certains navigateurs, et le `Z` aussi.
 *
 * L'ISO est en GMT, et c'est exactement ce que la validation relira — voir
 * l'en-tête de `lib/evenements/validation.ts`. Passer par l'heure locale ici
 * décalerait la valeur affichée d'un aller-retour à l'autre.
 */
export function pourChampDateHeure(quand: Date): string {
  return quand.toISOString().slice(0, 16);
}
