import "server-only";

import { consigner, ressource } from "@/lib/admin/audit";
import { appliquer, type Geste } from "@/lib/cms/cycle";
import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";
import { valider, type Refus, type Saisie } from "@/lib/evenements/validation";

/**
 * Écrire un événement — créer, corriger, publier, retirer, annuler.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * PAS DE FILE, ET DONC PAS DE `SOUMIS`
 *
 * §18.1 : le blog et les événements sont publiés par l'administration, et par
 * personne d'autre. L'auteur porte déjà le droit de publier — lui faire
 * traverser une file l'obligerait à s'auto-approuver, c'est-à-dire à faire
 * semblant.
 *
 * Le chemin est donc `BROUILLON → PUBLIE`, que `lib/cms/cycle.ts` prévoit
 * explicitement pour ces deux-là. `SOUMIS` et `REFUSE` restent inatteignables
 * ici, et c'est très bien : un état non atteint ne coûte rien, un état
 * manquant coûte une réécriture.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'AUTEUR N'EST PAS UN PARAMÈTRE LIBRE
 *
 * Comme pour Jobs et Services : il est lu de la session par l'action qui
 * appelle ce module. Le recevoir ici suffirait à publier au nom de quelqu'un
 * d'autre — et c'est ce nom qui apparaîtrait à l'audit.
 */

export type Echec =
  | { motif: "REFUS"; refus: Refus }
  /** L'événement n'existe pas, ou plus. */
  | { motif: "INTROUVABLE" }
  /** La machine à états n'autorise pas ce geste depuis cet état. */
  | { motif: "TRANSITION_INTERDITE" }
  /** Annuler demande de dire pourquoi. */
  | { motif: "RAISON_REQUISE" }
  /** Déjà annulé — rien à faire, et ce n'est pas une erreur. */
  | { motif: "DEJA_ANNULE" };

/**
 * `object` et non `void` comme défaut : `{ ok: true } & void` s'effondre en
 * `never`, et le compilateur refuse alors le succès lui-même — une erreur qui
 * se lit comme un défaut de l'appelant alors qu'elle vient d'ici.
 */
export type Suite<T = object> = ({ ok: true } & T) | ({ ok: false } & Echec);

const RAISON_MIN = 8;

export const MESSAGES_ECHEC: Record<Echec["motif"], string> = {
  REFUS: "",
  INTROUVABLE: "Cet événement n'existe plus.",
  TRANSITION_INTERDITE:
    "Quelqu'un vient de changer l'état de cet événement. Rafraîchis la page.",
  RAISON_REQUISE:
    "Écris pourquoi l'événement est annulé : c'est ce que liront les inscrits.",
  DEJA_ANNULE: "Cet événement est déjà annulé.",
};

/** Crée un événement, en brouillon. */
export async function creer(input: {
  auteurId: string;
  saisie: Saisie;
}): Promise<Suite<{ evenementId: string }>> {
  const verdict = valider(input.saisie);
  if (!verdict.ok) return { ok: false, motif: "REFUS", refus: verdict.refus };

  const e = verdict.evenement;

  const cree = await db.event.create({
    data: {
      organizerId: input.auteurId,
      title: e.titre,
      description: e.description,
      kind: e.genre,
      startsAt: e.debut,
      endsAt: e.fin,
      location: e.lieu,
      isOnline: e.enLigne,
      capacity: e.capacite,
      ticketPrice: e.prixBillet,
      prizeAmount: e.dotation,
      // Le schéma le pose déjà, on l'écrit quand même : c'est la ligne qu'on
      // relira le jour où quelqu'un se demandera pourquoi rien ne paraît.
      state: "BROUILLON",
    },
    select: { id: true },
  });

  journal.info("événement créé", { evenement: cree.id, genre: e.genre });

  return { ok: true, evenementId: cree.id };
}

/**
 * Corrige un événement, quel que soit son état.
 *
 * On ne verrouille pas l'édition d'un événement publié ni même terminé : une
 * faute dans une adresse se corrige surtout quand la fiche est en ligne, et
 * une date de concours passée peut demander une précision sur les résultats.
 */
export async function modifier(input: {
  evenementId: string;
  saisie: Saisie;
}): Promise<Suite> {
  const verdict = valider(input.saisie);
  if (!verdict.ok) return { ok: false, motif: "REFUS", refus: verdict.refus };

  const e = verdict.evenement;

  const ecrit = await db.event.updateMany({
    where: { id: input.evenementId },
    data: {
      title: e.titre,
      description: e.description,
      kind: e.genre,
      startsAt: e.debut,
      endsAt: e.fin,
      location: e.lieu,
      isOnline: e.enLigne,
      capacity: e.capacite,
      ticketPrice: e.prixBillet,
      prizeAmount: e.dotation,
    },
  });

  if (ecrit.count !== 1) return { ok: false, motif: "INTROUVABLE" };

  return { ok: true };
}

/**
 * Publie, retire, ou remet en brouillon.
 *
 * La condition d'état vit dans le `WHERE` : deux personnes peuvent avoir
 * ouvert la même fiche, et seule la première doit trancher. La seconde repart
 * sans rien casser, et sa page se rafraîchira.
 */
export async function trancher(input: {
  evenementId: string;
  geste: Geste;
  acteurId: string;
}): Promise<Suite<{ vers: string }>> {
  const evenement = await db.event.findUnique({
    where: { id: input.evenementId },
    select: { id: true, state: true, title: true },
  });

  if (!evenement) return { ok: false, motif: "INTROUVABLE" };

  const transition = appliquer(evenement.state, input.geste);
  if (!transition.ok) return { ok: false, motif: "TRANSITION_INTERDITE" };

  const ecrit = await db.event.updateMany({
    where: { id: evenement.id, state: evenement.state },
    data: { state: transition.vers },
  });

  if (ecrit.count !== 1) return { ok: false, motif: "TRANSITION_INTERDITE" };

  // Consigné après l'acte, et seulement s'il a eu lieu.
  await consigner({
    acteurId: input.acteurId,
    action: input.geste === "publier" ? "contenu.publier" : "contenu.retirer",
    ressource: ressource("evenement", evenement.id),
    details: { de: evenement.state, vers: transition.vers, titre: evenement.title },
  });

  journal.info("événement tranché", {
    evenement: evenement.id,
    de: evenement.state,
    vers: transition.vers,
  });

  return { ok: true, vers: transition.vers };
}

/**
 * Annule un événement — sans le faire disparaître.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IL RESTE VISIBLE, ET C'EST TOUT L'INTÉRÊT
 *
 * Les inscrits ont noté la date, prévu un déplacement, peut-être payé un
 * billet. Les envoyer sur une page absente les laisserait chercher — et
 * écrire, un par un. La fiche reste donc en ligne, marquée annulée, avec la
 * raison.
 *
 * C'est pourquoi ce n'est pas un `retirer` : `RETIRE` est pour ce qui
 * n'aurait pas dû paraître, `cancelledAt` pour ce qui n'aura pas lieu.
 */
export async function annuler(input: {
  evenementId: string;
  raison: string;
  acteurId: string;
}): Promise<Suite> {
  const raison = input.raison.trim();
  if (raison.length < RAISON_MIN) return { ok: false, motif: "RAISON_REQUISE" };

  const evenement = await db.event.findUnique({
    where: { id: input.evenementId },
    select: { id: true, title: true, cancelledAt: true },
  });

  if (!evenement) return { ok: false, motif: "INTROUVABLE" };
  if (evenement.cancelledAt !== null) return { ok: false, motif: "DEJA_ANNULE" };

  // `cancelledAt: null` dans le WHERE : deux annulations simultanées ne
  // doivent pas écraser la première raison par la seconde.
  const ecrit = await db.event.updateMany({
    where: { id: evenement.id, cancelledAt: null },
    data: { cancelledAt: new Date(), cancelReason: raison },
  });

  if (ecrit.count !== 1) return { ok: false, motif: "DEJA_ANNULE" };

  await consigner({
    acteurId: input.acteurId,
    action: "contenu.retirer",
    ressource: ressource("evenement", evenement.id),
    details: { geste: "annulation", titre: evenement.title, raison },
  });

  journal.info("événement annulé", { evenement: evenement.id });

  return { ok: true };
}

/**
 * Lève une annulation.
 *
 * Une annulation posée par erreur se répare — et la raison s'efface avec elle,
 * sans quoi la fiche afficherait « annulé pour X » sur un événement qui a bien
 * lieu. L'audit garde les deux gestes.
 */
export async function retablir(input: {
  evenementId: string;
  acteurId: string;
}): Promise<Suite> {
  const ecrit = await db.event.updateMany({
    where: { id: input.evenementId, cancelledAt: { not: null } },
    data: { cancelledAt: null, cancelReason: null },
  });

  if (ecrit.count !== 1) return { ok: false, motif: "INTROUVABLE" };

  await consigner({
    acteurId: input.acteurId,
    action: "contenu.publier",
    ressource: ressource("evenement", input.evenementId),
    details: { geste: "annulation levée" },
  });

  return { ok: true };
}
