import "server-only";

import { urlDuSite } from "@/lib/config/site";
import { FENETRE_MS, decider, type Refus } from "@/lib/contact/createur";
import { db } from "@/lib/db";
import { deposer } from "@/lib/email/outbox";
import { journal } from "@/lib/observabilite/journal";

/**
 * Relaie un message laissé depuis le bouton « Contact » d'une vitrine.
 *
 * Les règles — qui peut écrire, combien de fois — sont dans
 * `lib/contact/createur.ts`. Ici, on lit ce qu'elles demandent, puis on
 * enregistre le message et l'intention d'envoi dans une même transaction : un
 * message gardé sans courriel serait une demande que le créateur ne verra
 * jamais, un courriel sans message, un abus qu'on ne retrouverait pas.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * COMPTER ET ÉCRIRE SOUS LE MÊME VERROU
 *
 * Première version : les deux comptes lus avant la transaction, hors verrou.
 * Deux envois simultanés du même compte lisaient tous deux « 2 », passaient
 * tous deux, et le plafond de trois laissait passer un quatrième message. Le
 * commentaire d'alors l'acceptait (« le plafond borne un débit ») ; décidé le
 * 27/10 de ne plus l'accepter : un plafond qu'on dépasse en cliquant deux fois
 * n'est pas un plafond.
 *
 * Un verrou consultatif par expéditeur (`pg_advisory_xact_lock`, comme
 * `lib/abonnements/souscription.ts`) : ses envois passent l'un après l'autre,
 * ceux des autres ne l'attendent pas. Un seul suffit — les deux plafonds se
 * comptent par expéditeur. Il tombe avec la transaction, levée comprise.
 */

export type Issue =
  | { ok: true; id: string }
  | { ok: false; refus: Refus | "INTROUVABLE" | "INDISPONIBLE" };

export async function ecrireAuCreateur(entree: {
  expediteurId: string;
  username: string;
  sujet: string;
  corps: string;
}): Promise<Issue> {
  const destinataire = await db.profile.findUnique({
    where: { username: entree.username },
    select: {
      displayName: true,
      acceptsMessages: true,
      user: { select: { id: true, email: true, suspendedAt: true } },
    },
  });
  // Une vitrine suspendue n'existe pas pour le public (`profilPublic`) : on
  // répond de même, sans dire pourquoi.
  if (!destinataire || destinataire.user.suspendedAt) return { ok: false, refus: "INTROUVABLE" };

  const expediteur = await db.user.findUnique({
    where: { id: entree.expediteurId },
    select: { email: true, profile: { select: { displayName: true, username: true } } },
  });
  if (!expediteur) return { ok: false, refus: "INTROUVABLE" };

  // Le pied du courriel porte deux liens. Sans adresse du site, on refuse
  // plutôt que d'envoyer des liens morts — c'est un réglage à corriger, pas
  // un cas à contourner (voir `lib/config/site.ts`).
  const base = urlDuSite();
  if (!base) {
    journal.erreur("message à un créateur refusé : APP_URL absente", {});
    return { ok: false, refus: "INDISPONIBLE" };
  }

  try {
    return await db.$transaction(async (tx): Promise<Issue> => {
      // Voir l'en-tête : les envois de CET expéditeur passent un par un.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`message-createur:${entree.expediteurId}`}))`;

      const depuis = new Date(Date.now() - FENETRE_MS);
      const envoyesAujourdhui = await tx.creatorMessage.count({
        where: { senderId: entree.expediteurId, createdAt: { gte: depuis } },
      });
      const envoyesAuCreateur = await tx.creatorMessage.count({
        where: { senderId: entree.expediteurId, recipientId: destinataire.user.id, createdAt: { gte: depuis } },
      });

      const verdict = decider({
        expediteurId: entree.expediteurId,
        destinataireId: destinataire.user.id,
        ouvert: destinataire.acceptsMessages,
        envoyesAujourdhui,
        envoyesAuCreateur,
      });
      if (!verdict.ok) return verdict;

      const message = await tx.creatorMessage.create({
        data: {
          senderId: entree.expediteurId,
          recipientId: destinataire.user.id,
          subject: entree.sujet,
          body: entree.corps,
        },
        select: { id: true },
      });

      const depot = await deposer(
        {
          cle: `courriel:message-createur-${message.id}`,
          destinataire: destinataire.user.email,
          modele: "MESSAGE_CREATEUR",
          charge: {
            nom: destinataire.displayName,
            expediteur: expediteur.profile?.displayName ?? "Un membre de Baobart",
            profil: expediteur.profile?.username ? `${base}/@${expediteur.profile.username}` : null,
            sujet: entree.sujet,
            corps: entree.corps,
            repondreA: expediteur.email,
            reference: message.id,
            contact: `${base}/contact`,
            reglages: `${base}/dashboard/profil`,
          },
        },
        tx,
      );
      // Lever annule la transaction : pas de message gardé sans son envoi.
      if (!depot.depose) throw new DepotRefuse(depot.motif);
      return { ok: true, id: message.id };
    }, {
      // Le défaut de Prisma est de cinq secondes : des envois mis en file
      // derrière le verrou peuvent l'atteindre sans rien avoir de cassé.
      timeout: 15_000,
      maxWait: 10_000,
    });
  } catch (cause) {
    if (cause instanceof DepotRefuse) {
      journal.erreur("message à un créateur refusé au dépôt", { motif: cause.motif });
      return { ok: false, refus: "INDISPONIBLE" };
    }
    throw cause;
  }
}

/**
 * Ouvre ou ferme le bouton « Contact » de sa vitrine.
 *
 * Un état posé, pas une bascule : deux clics sur « Fermer » laissent le bouton
 * fermé, au lieu de le rouvrir au second. Rend `false` sans profil — il n'y a
 * alors pas de vitrine où le bouton apparaîtrait.
 */
export async function reglerLesMessages(userId: string, ouvert: boolean): Promise<boolean> {
  const { count } = await db.profile.updateMany({ where: { userId }, data: { acceptsMessages: ouvert } });
  return count === 1;
}

class DepotRefuse extends Error {
  constructor(readonly motif: string) {
    super(`dépôt refusé : ${motif}`);
  }
}
