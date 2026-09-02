import "server-only";

import { urlDuSite } from "@/lib/config/site";
import { db } from "@/lib/db";
import { deposer } from "@/lib/email/outbox";
import { formatMoney, type Currency } from "@/lib/i18n/money";
import { journal } from "@/lib/observabilite/journal";
import {
  REGLAGES_PAR_DEFAUT,
  ajouterJours,
  type Cadence,
  type Cycle,
} from "@/lib/ndank/cycle";
import type {
  AbonnementLu,
  Canal,
  Coordonnees,
  Ecriture,
  Envoi,
  Lecture,
  Message,
  Ports,
} from "@/lib/ndank/ports";

/**
 * Ndank branché sur Baobart — le niveau 1.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TOUT LE BAOBART DE NDANK TIENT DANS CE FICHIER
 *
 * Le moteur, les états et le rythme ne connaissent ni Prisma, ni la file
 * d'e-mails, ni les routes de ce projet. C'est ici, et seulement ici, que les
 * ports rencontrent nos tables.
 *
 * La conséquence pratique : ce fichier est **le seul** qui ne partira pas quand
 * Ndank sortira dans son propre dépôt. Un autre projet écrira le sien, de la
 * même taille, contre sa propre base — c'est exactement ce que « réutilisable
 * dans tout projet JavaScript » veut dire.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'ÉTAT N'EST PAS RELU DEPUIS LA BASE
 *
 * `Subscription.status` existe et sert au reste de Baobart, mais Ndank ne s'en
 * sert PAS pour décider : il recalcule l'état depuis les dates. Un statut rangé
 * en base se désynchronise dès qu'un passage rate son tour, et l'on se retrouve
 * à couper l'accès de quelqu'un qui a payé.
 *
 * Le statut est donc une **conséquence** qu'on écrit, jamais une prémisse qu'on
 * lit.
 */

/**
 * Reconstruit le cycle complet à partir des deux dates rangées.
 *
 * La grâce et la fenêtre de reprise ne sont pas stockées : elles se déduisent
 * de l'échéance et des réglages. Les ranger en base créerait deux colonnes de
 * plus qui pourraient dériver — et le jour où l'on rallonge la grâce, les
 * abonnements existants garderaient l'ancienne sans qu'on le voie.
 */
function cycleDe(debut: Date, echeance: Date): Cycle {
  const accesJusquA = ajouterJours(echeance, REGLAGES_PAR_DEFAUT.graceJours);

  return {
    debut,
    echeance,
    accesJusquA,
    repriseJusquA: ajouterJours(accesJusquA, REGLAGES_PAR_DEFAUT.repriseJours),
  };
}

const lecture: Lecture = {
  /**
   * Les abonnements qu'un passage pourrait avoir à toucher.
   *
   * On ne remonte PAS tout le fichier. Sur cent mille abonnés, en parcourir
   * cent mille chaque matin pour en relancer trente finit en délai d'attente —
   * et l'index sur `(status, cycleEnd)` existe précisément pour cela.
   *
   * On prend large volontairement : le moteur écarte lui-même ce qui n'a rien à
   * faire. Rendre trop d'abonnements ne casse rien ; en rendre trop peu, si.
   */
  async aRelancer(avant, limite) {
    const lignes = await db.subscription.findMany({
      where: {
        // CANCELLED et EXPIRED sont clos : rien ne doit plus partir.
        status: { in: ["ACTIVE", "PENDING_CANCELLATION"] },
        cycleEnd: { lte: avant },
      },
      orderBy: { cycleEnd: "asc" },
      take: limite,
      select: {
        id: true,
        userId: true,
        cadence: true,
        cycleStart: true,
        cycleEnd: true,
        cancelledAt: true,
        plan: { select: { name: true, priceMonthly: true } },
      },
    });

    return lignes.map((l) => ({
      id: l.id,
      abonneId: l.userId,
      cadence: l.cadence as Cadence,
      cycle: cycleDe(l.cycleStart, l.cycleEnd),
      resilieeLe: l.cancelledAt,
      montant: l.plan.priceMonthly,
      devise: "XOF",
      libelle: l.plan.name,
    })) satisfies AbonnementLu[];
  },

  async relancesEnvoyees(abonnementId) {
    const lignes = await db.subscriptionReminder.findMany({
      where: { subscriptionId: abonnementId },
      select: { cle: true },
    });
    return lignes.map((l) => l.cle);
  },

  async coordonnees(abonneId): Promise<Coordonnees> {
    const u = await db.user.findUnique({
      where: { id: abonneId },
      select: {
        email: true,
        phone: true,
        profile: { select: { displayName: true } },
      },
    });

    return {
      nom: u?.profile?.displayName ?? null,
      courriel: u?.email ?? null,
      telephone: u?.phone ?? null,
      // Aucune application installée tant que la PWA n'existe pas. On le dit
      // plutôt que d'inventer un jeton : le moteur essaiera le canal suivant.
      jetonPush: null,
    };
  },
};

const ecriture: Ecriture = {
  /**
   * Note la relance, une fois.
   *
   * La clé unique en base double la garde du moteur. Deux passages lancés en
   * même temps — ce qui arrive quand un ordonnanceur rejoue — liraient tous
   * deux « pas encore envoyée » ; seul l'un des deux écrira.
   */
  async noterRelance(abonnementId, cle, canaux) {
    try {
      await db.subscriptionReminder.create({
        data: { subscriptionId: abonnementId, cle, canaux },
      });
    } catch {
      // Doublon : l'autre passage a gagné. C'est le résultat voulu.
    }
  },

  async suspendre(abonnementId) {
    // La condition est dans le `WHERE` : un abonnement déjà résilié par son
    // abonné ne doit pas être réécrit en « expiré » par un passage.
    await db.subscription.updateMany({
      where: { id: abonnementId, status: { in: ["ACTIVE", "PENDING_CANCELLATION"] } },
      data: { status: "EXPIRED" },
    });
  },

  async clore(abonnementId) {
    await db.subscription.updateMany({
      where: { id: abonnementId, status: { not: "CANCELLED" } },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
  },

  async renouveler(abonnementId, cycle) {
    await db.subscription.update({
      where: { id: abonnementId },
      data: {
        cycleStart: cycle.debut,
        cycleEnd: cycle.echeance,
        status: "ACTIVE",
      },
    });
  },
};

const envoi: Envoi = {
  disponible(canal, ou) {
    if (canal === "courriel") return ou.courriel !== null;
    if (canal === "sms") return ou.telephone !== null;
    return ou.jetonPush !== null;
  },

  async envoyer(canal: Canal, ou: Coordonnees, message: Message) {
    if (canal === "courriel" && ou.courriel) {
      const suite = await deposer({
        // La clé porte le cycle et le palier : deux relances distinctes
        // produisent deux courriels, la même rejouée n'en produit qu'un.
        cle: `ndank-${message.cle}`,
        destinataire: ou.courriel,
        modele: "RELANCE_ABONNEMENT",
        charge: {
          nom: message.destinataire,
          offre: message.offre,
          montant: message.montant,
          lien: message.lien,
          jours: message.joursRestants,
        },
      });
      return suite.depose;
    }

    if (canal === "sms") {
      // Aucun opérateur de SMS n'est branché. On le dit franchement : rendre
      // `true` ferait noter une relance jamais partie, et l'abonné perdrait
      // son accès sans avoir été prévenu.
      journal.avertissement("relance SMS impossible : aucun opérateur branché", {});
      return false;
    }

    // Notification : l'application n'existe pas encore.
    return false;
  },
};

export const PORTS_BAOBART: Ports = { lecture, ecriture, envoi };

/** Où l'abonné va valider son renouvellement. */
export function lienDeValidation(abonnement: AbonnementLu): string {
  const base = urlDuSite() ?? "";
  return `${base}/abonnement/${abonnement.id}/renouveler`;
}

/** Le montant, écrit comme Baobart l'écrit partout ailleurs. */
export function montantLisible(abonnement: AbonnementLu): string {
  return formatMoney(abonnement.montant, abonnement.devise as Currency);
}
