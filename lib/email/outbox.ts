import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { ChargeInvalide, rendre, type Modele } from "@/lib/email/modeles";
import { adressePlausible, piloteCourant } from "@/lib/email/pilotes";
import {
  RECLAMATION_PERIMEE_MS,
  suiteApresEchec,
  TENTATIVES_MAX,
} from "@/lib/email/reprise";
import { journal } from "@/lib/observabilite/journal";

/**
 * La file d'attente des messages transactionnels.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DÉPOSER DANS LA MÊME TRANSACTION QUE LE FAIT
 *
 * `deposer()` accepte un client Prisma : appelée depuis un `$transaction`,
 * l'intention d'envoi s'inscrit avec la commande qui la justifie. Si la
 * commande est annulée, l'intention disparaît avec elle. C'est tout l'intérêt
 * du procédé — sans quoi on choisit entre envoyer un reçu pour une commande
 * qui n'existera pas et perdre celui d'une commande qui existe.
 */

type ClientPrisma = Pick<typeof db, "emailOutbox">;

export interface Depot {
  /**
   * Dérivée du fait, jamais du hasard.
   *
   * « courriel:recu-<orderItemId> » et non un identifiant tiré au sort : un
   * webhook rejoué par l'opérateur doit retomber sur la même clé et se faire
   * refuser, plutôt qu'envoyer un second reçu.
   *
   * Le préfixe de canal vient de l'aiguilleur, qui pose « courriel: » devant
   * la clé du fait — la cloche pose « in-app: » devant la même. Les trois
   * appelants directs qui restent (jeton de connexion, réinitialisation,
   * Ndank) n'en portent pas : ils ne passent par aucun canal alternatif.
   */
  cle: string;
  destinataire: string;
  modele: Modele;
  charge: Record<string, unknown>;
}

export type ResultatDepot =
  | { depose: true; id: string }
  | { depose: false; motif: "doublon" | "adresse_invalide" | "charge_invalide" };

export async function deposer(
  depot: Depot,
  client: ClientPrisma = db,
): Promise<ResultatDepot> {
  if (!adressePlausible(depot.destinataire)) {
    return { depose: false, motif: "adresse_invalide" };
  }

  // Le rendu est éprouvé au dépôt, pas seulement à l'envoi : une charge
  // incomplète découverte trois jours plus tard, dans un passage de nuit,
  // n'est plus rattachable à ce qui l'a produite.
  try {
    rendre(depot.modele, depot.charge);
  } catch (cause) {
    if (cause instanceof ChargeInvalide) {
      journal.erreur("charge de courriel refusée au dépôt", {
        modele: depot.modele,
        cle: depot.cle,
        cause,
      });
      return { depose: false, motif: "charge_invalide" };
    }
    throw cause;
  }

  try {
    const ligne = await client.emailOutbox.create({
      data: {
        idempotencyKey: depot.cle,
        recipient: depot.destinataire,
        template: depot.modele,
        payload: depot.charge as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    return { depose: true, id: ligne.id };
  } catch (cause) {
    // P2002 : la clé existe déjà. Ce n'est pas une erreur — c'est exactement
    // ce que la clé sert à provoquer.
    if (
      cause instanceof Prisma.PrismaClientKnownRequestError &&
      cause.code === "P2002"
    ) {
      return { depose: false, motif: "doublon" };
    }
    throw cause;
  }
}

interface LigneReclamee {
  id: string;
  recipient: string;
  template: Modele;
  payload: unknown;
  attempts: number;
}

/**
 * Réclame un lot, sans qu'un autre passage puisse prendre les mêmes lignes.
 *
 * `FOR UPDATE SKIP LOCKED` est le cœur du procédé : chaque passage verrouille
 * les lignes qu'il prend, et les concurrents **sautent** celles déjà tenues au
 * lieu d'attendre. Sans cela, deux passages simultanés liraient la même page
 * de résultats et enverraient chacun le même message.
 *
 * Un `updateMany` conditionnel ne suffirait pas : il ne rend pas les lignes
 * touchées, et sans elles il n'y a rien à envoyer.
 */
async function reclamer(lot: number): Promise<LigneReclamee[]> {
  const maintenant = new Date();
  const perime = new Date(maintenant.getTime() - RECLAMATION_PERIMEE_MS);

  return db.$queryRaw<LigneReclamee[]>`
    UPDATE "EmailOutbox" AS cible
    SET "status" = 'SENDING',
        "claimedAt" = ${maintenant},
        "attempts" = cible."attempts" + 1,
        "updatedAt" = ${maintenant}
    WHERE cible."id" IN (
      SELECT "id" FROM "EmailOutbox"
      WHERE ("status" = 'PENDING' AND "nextAttemptAt" <= ${maintenant})
         OR ("status" = 'SENDING' AND "claimedAt" < ${perime})
      ORDER BY "nextAttemptAt" ASC
      LIMIT ${lot}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING cible."id", cible."recipient", cible."template",
              cible."payload", cible."attempts"
  `;
}

async function conclure(
  id: string,
  reference: string | null,
): Promise<void> {
  await db.emailOutbox.update({
    where: { id },
    data: {
      status: "SENT",
      sentAt: new Date(),
      claimedAt: null,
      lastError: reference ? `référence ${reference}` : null,
    },
  });
}

async function echouer(
  ligne: LigneReclamee,
  message: string,
  definitif: boolean,
): Promise<void> {
  const suite = suiteApresEchec({ tentatives: ligne.attempts, definitif });

  if (suite.sort === "RENONCER") {
    await db.emailOutbox.update({
      where: { id: ligne.id },
      data: { status: "FAILED", claimedAt: null, lastError: message },
    });
    journal.erreur("courriel abandonné", {
      id: ligne.id,
      modele: ligne.template,
      tentatives: ligne.attempts,
      motif: suite.motif,
      // Le message d'erreur du fournisseur, pas la charge : celle-ci porte des
      // liens personnels.
      erreur: message,
    });
    return;
  }

  await db.emailOutbox.update({
    where: { id: ligne.id },
    data: {
      status: "PENDING",
      claimedAt: null,
      lastError: message,
      nextAttemptAt: new Date(Date.now() + suite.dansMs),
    },
  });
}

export interface Passage {
  pilote: string;
  traites: number;
  envoyes: number;
  reportes: number;
  abandonnes: number;
}

/**
 * Vide la file, dans la limite d'un lot.
 *
 * Chaque message est isolé : une erreur sur l'un ne doit pas emporter les
 * autres. Un lot bloqué par le premier destinataire au domaine expiré serait
 * une panne totale déguisée en incident isolé.
 */
export async function vider(lot = 20): Promise<Passage> {
  const pilote = piloteCourant();
  const lignes = await reclamer(lot);

  const passage: Passage = {
    pilote: pilote.nom,
    traites: lignes.length,
    envoyes: 0,
    reportes: 0,
    abandonnes: 0,
  };

  for (const ligne of lignes) {
    try {
      const message = rendre(ligne.template, ligne.payload);
      const verdict = await pilote.envoyer(ligne.recipient, message);

      if (verdict.ok) {
        await conclure(ligne.id, verdict.reference);
        passage.envoyes += 1;
        continue;
      }

      await echouer(ligne, verdict.message, verdict.definitif);
      if (
        verdict.definitif ||
        ligne.attempts >= TENTATIVES_MAX
      ) {
        passage.abandonnes += 1;
      } else {
        passage.reportes += 1;
      }
    } catch (cause) {
      // Une charge devenue illisible ne guérira pas : c'est le code qui a
      // changé, pas le réseau.
      const definitif = cause instanceof ChargeInvalide;
      const message =
        cause instanceof Error ? cause.message : "échec inconnu à l'envoi";
      await echouer(ligne, message, definitif);
      if (definitif || ligne.attempts >= TENTATIVES_MAX) {
        passage.abandonnes += 1;
      } else {
        passage.reportes += 1;
      }
    }
  }

  return passage;
}

/** Remet un message abandonné en file, immédiatement. Action d'exploitation. */
export async function relancer(id: string): Promise<boolean> {
  const { count } = await db.emailOutbox.updateMany({
    // Seulement depuis FAILED : relancer un message déjà parti l'enverrait
    // deux fois, et relancer un PENDING ne ferait que court-circuiter son recul.
    where: { id, status: "FAILED" },
    data: {
      status: "PENDING",
      attempts: 0,
      nextAttemptAt: new Date(),
      claimedAt: null,
    },
  });
  return count === 1;
}

/** Ferme définitivement, sans prétendre que le message est parti. */
export async function abandonner(id: string): Promise<boolean> {
  const { count } = await db.emailOutbox.updateMany({
    where: { id, status: { in: ["FAILED", "PENDING"] } },
    data: { status: "ABANDONED", claimedAt: null },
  });
  return count === 1;
}
