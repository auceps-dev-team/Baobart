import "server-only";

import { db } from "@/lib/db";
import type { EtatContenu } from "@/lib/cms/cycle";
import type { EventKind } from "@/lib/evenements/enums";
import { phaseDe, type Phase } from "@/lib/evenements/phases";

/**
 * Ce que l'administration lit des événements.
 *
 * La lecture **publique** vit ailleurs (E3) et ne montrera que `PUBLIE`. Ici on
 * voit tout — brouillons compris — parce que c'est l'écran depuis lequel on
 * travaille.
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
 * Tous les événements, du plus proche au plus lointain.
 *
 * Trié par date de début **décroissante** : l'écran d'administration sert à
 * préparer ce qui vient, et ce qui vient est en haut. Trier par date de
 * création mettrait un brouillon d'il y a six mois avant l'atelier de la
 * semaine prochaine.
 */
export async function listerPourAdministration(
  limite = 100,
  maintenant = new Date(),
): Promise<LigneAdmin[]> {
  const lignes = await db.event.findMany({
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

/** Un événement, pour l'écran d'édition. `null` s'il n'existe plus. */
export async function evenementAEditer(
  id: string,
): Promise<EvenementAEditer | null> {
  const e = await db.event.findUnique({
    where: { id },
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
