import "server-only";

import { urlDuSite } from "@/lib/config/site";
import { db } from "@/lib/db";
import { deposer } from "@/lib/email/outbox";
import { formatMoney, type Currency } from "@/lib/i18n/money";
import { journal } from "@/lib/observabilite/journal";
import { PAYS_PAR_DEFAUT, paysValide } from "@/lib/payments/rails";
import { notifier } from "@/lib/notifications/aiguilleur";
import { lirePreferences } from "@/lib/notifications/preferences";
import { appareilsDe, envoyerA } from "@/lib/push/abonnements";
import { versE164 } from "@/lib/sms/numero";
import { envoyerSms } from "@/lib/sms/pilotes";
import { texteRelance } from "@/lib/sms/relance";
import {
  REGLAGES_PAR_DEFAUT,
  accesJusquA,
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
export function cycleDe(debut: Date, echeance: Date): Cycle {
  const acces = accesJusquA(echeance);

  return {
    debut,
    echeance,
    accesJusquA: acces,
    repriseJusquA: ajouterJours(acces, REGLAGES_PAR_DEFAUT.repriseJours),
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
        // Un forfait gratuit n'a rien à payer : pas de relance, pas de
        // suspension. Son cycle avance seul (`renouvelerLesGratuits`).
        plan: { priceMonthly: { gt: 0 } },
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
        profile: { select: { displayName: true, country: true } },
      },
    });

    // Le numéro est mis en forme ICI, pas au moment de l'envoi.
    //
    // Ndank ne connaît pas les plans de numérotation, et n'a pas à les
    // connaître : le port promet « où joindre l'abonné », donc un numéro
    // joignable. Un numéro qu'on ne sait pas mettre en forme devient `null`, et
    // le moteur voit alors franchement que le canal n'est pas disponible — il
    // essaie le suivant, et compte l'abonné parmi les injoignables s'il n'y en
    // a aucun. C'est exactement ce qu'on veut savoir avant de couper un accès.
    const telephone = u?.phone
      ? versE164(u.phone, paysValide(u.profile?.country ?? undefined))
      : null;

    // ────────────────────────────────────────────────────────────────
    // CE QUE LA PERSONNE A FERMÉ FERME AUSSI LE CANAL DE NDANK
    //
    // Le moteur choisit QUEL canal essayer ; l'hôte sait ce qu'on a accepté
    // de recevoir. Sans cette lecture, les deux décisions ne se rencontrent
    // jamais, et quelqu'un qui coupe les courriels de relance continue d'en
    // recevoir — l'écran de réglages mentirait.
    //
    // La lecture se fait ici, une fois, parce que `coordonnees()` est déjà
    // asynchrone et lit déjà le compte. C'est ce qui permet à `disponible()`
    // de rester synchrone, comme le port le demande.
    //
    // Le SMS n'a pas de réglage : il n'est pas au catalogue des
    // notifications, et il ne part qu'au dernier palier, quand l'accès est
    // sur le point de se fermer. Lui donner un interrupteur demanderait
    // d'abord de décider s'il peut se couper — ce n'est pas tranché.
    const prefs = await lirePreferences(abonneId);
    const reglage = prefs.ABONNEMENT_A_RENOUVELER ?? {};
    const refuses: Canal[] = [];
    if (reglage.COURRIEL === false) refuses.push("courriel");
    if (reglage.PUSH === false) refuses.push("push");

    return {
      abonneId,
      nom: u?.profile?.displayName ?? null,
      courriel: u?.email ?? null,
      telephone,
      refuses,
      // Les navigateurs où la personne a accepté les notifications. La liste
      // est souvent vide — c'est une réponse normale, pas une panne : le
      // moteur essaiera simplement le canal suivant.
      appareils: await appareilsDe(abonneId),
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
      // Doublon : l'autre passage a gagné. C'est le résultat voulu — et on
      // sort AVANT l'avis, sans quoi le perdant en écrirait un second.
      return;
    }

    await tracerDansLApplication(abonnementId, cle);
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
    // Fermé par son destinataire : exactement comme absent. Le moteur passera
    // au canal suivant, et le comptera injoignable s'il n'en reste aucun.
    if (ou.refuses.includes(canal)) return false;

    if (canal === "courriel") return ou.courriel !== null;
    if (canal === "sms") return ou.telephone !== null;
    return ou.appareils.length > 0;
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

    if (canal === "sms" && ou.telephone) {
      // Le numéro est déjà en E.164 (voir `coordonnees`) : `pays` ne sert alors
      // à rien, mais le point d'entrée le demande pour les appels qui partent
      // d'une saisie brute ailleurs dans Baobart.
      const verdict = await envoyerSms({
        numero: ou.telephone,
        pays: PAYS_PAR_DEFAUT,
        texte: texteRelance(message),
      });

      if (!verdict.ok) {
        // On rend `false` sans exception : le moteur essaiera le canal suivant,
        // et surtout NE NOTERA PAS une relance qui n'est jamais partie. Sans
        // cela, une panne d'un jour couperait l'accès de quelqu'un qu'on n'a
        // jamais prévenu — et le lendemain le moteur croirait l'avoir fait.
        journal.avertissement("relance SMS non partie", {
          motif: verdict.motif ?? "inconnu",
          abonnement: message.cle,
        });
      }

      return verdict.ok;
    }

    if (canal === "push" && ou.appareils.length > 0) {
      // Le titre porte l'urgence, le corps porte les faits. Une notification se
      // lit d'un œil sur un écran verrouillé : ce qui ne tient pas dans le
      // titre ne sera pas lu.
      const parti = await envoyerA(ou.appareils, {
        titre:
          message.joursRestants <= 0
            ? `${message.offre} — accès suspendu`
            : `${message.offre} — ${message.joursRestants} jour${message.joursRestants > 1 ? "s" : ""}`,
        corps:
          message.joursRestants <= 0
            ? `Réactive ton accès pour ${message.montant}.`
            : `Renouvelle pour ${message.montant} avant la coupure.`,
        lien: message.lien,
        // Deux relances pour le même abonnement se remplacent au lieu de
        // s'empiler : personne ne veut sept pastilles pour une échéance.
        etiquette: `ndank-${message.cle.split(":")[0] ?? message.cle}`,
      });

      if (!parti) {
        // Comme pour le SMS : on rend `false` sans exception. Le moteur NE
        // NOTERA PAS une relance qui n'est jamais partie, et réessaiera —
        // plutôt que de couper l'accès de quelqu'un jamais prévenu.
        journal.avertissement("relance push non partie", {
          abonnement: message.cle,
        });
      }

      return parti;
    }

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

/**
 * Garder une trace de la relance dans l'application.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ICI, ET PAS DANS `envoyer`
 *
 * `noterRelance` est appelée **une fois**, et seulement quand un canal a
 * effectivement pris le message. `envoyer`, elle, est appelée une fois par
 * canal essayé : y écrire l'avis le poserait autant de fois qu'il y a eu
 * d'échecs avant le succès.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * RESTREINTE À L'IN-APP, ET C'EST TOUT L'INTÉRÊT
 *
 * Ndank vient d'envoyer le message sur le canal qu'il a choisi. Repasser par
 * le courriel de l'aiguilleur enverrait le même message deux fois. La
 * restriction est croisée avec les préférences — elle ne peut donc pas ouvrir
 * un canal que la personne a fermé.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QU'ELLE NE COUVRE PAS
 *
 * Un abonné dont TOUS les canaux externes sont fermés ou absents est compté
 * « injoignable » par le moteur, qui n'appelle alors pas `noterRelance` — et
 * n'a donc aucun avis, pas même dans l'application. C'est discutable : il va
 * perdre son accès sans avoir rien vu. Le corriger demande un crochet que le
 * port n'a pas, et cela se décide côté Ndank.
 *
 * Rien ici ne lève : la relance est partie, et un avis raté ne doit pas la
 * faire noter deux fois demain.
 */
async function tracerDansLApplication(
  abonnementId: string,
  cle: string,
): Promise<void> {
  const abonnement = await db.subscription.findUnique({
    where: { id: abonnementId },
    select: { userId: true, plan: { select: { name: true } } },
  });

  if (!abonnement) return;

  await notifier({
    destinataireId: abonnement.userId,
    evenement: "ABONNEMENT_A_RENOUVELER",
    // La même clé que la relance : un passage rejoué retombe dessus et se
    // fait refuser, comme la ligne `SubscriptionReminder` elle-même.
    cle: `ndank-${cle}`,
    titre: `Ton abonnement ${abonnement.plan.name} arrive à échéance`,
    // Pas de nombre de jours ici : le message exact — ton, échéance, palier —
    // est celui que Ndank vient d'envoyer par courriel ou SMS. Le répéter de
    // mémoire, depuis une seconde lecture, risquerait de le contredire.
    corps: "Renouvelle pour garder ton accès. Le détail est dans le message qu'on vient de t'envoyer.",
    lien: "/dashboard/forfait",
    canaux: ["IN_APP"],
  });
}
