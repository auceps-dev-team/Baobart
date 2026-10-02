import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import {
  applyRiskEvent,
  estSuspendu,
  SuspensionNonAutoriseeError,
  IdentiteNonVerifieeError,
  TransitionInterditeError,
  type RiskEffect,
  type RiskEvent,
  type RiskState,
} from "@/lib/domain/trust";
import { journal } from "@/lib/observabilite/journal";
import {
  DUREE_BLOCAGE_IP_MS,
  bloquer,
  debloquerPourCompte,
} from "@/lib/securite/blocklist";

/**
 * Écrire les décisions de confiance.
 *
 * `lib/domain/trust.ts` contenait une machine à états complète — transitions
 * autorisées, refus de lever une suspension par mégarde, effets à exécuter —
 * dont seuls les types étaient importés. Les décisions étaient justes et
 * n'atteignaient rien : `suspendedAt` était lu par la session et par
 * l'éligibilité aux versements, et écrit par personne.
 *
 * Ce module fait le pont. Il ne décide de rien : il applique ce que la machine
 * a décidé, exécute les effets, et consigne.
 */

export type SuiteRisque =
  | { applique: true; de: RiskState; vers: RiskState; effets: RiskEffect[] }
  | {
      applique: false;
      motif:
        | "COMPTE_INTROUVABLE"
        | "NON_VERIFIE"
        | "TRANSITION_INTERDITE"
        | "SUSPENSION_NON_LEVEE"
        | "DEJA_DANS_CET_ETAT";
      message: string;
    };

/**
 * Applique un événement de risque à un compte.
 *
 * `clearSuspension` doit valoir `true` pour toute transition qui sortirait
 * d'une suspension — ce n'est pas de la paperasse : lever une suspension remet
 * les produits en vente, et une revue de routine ne doit pas défaire une
 * sanction qu'elle n'a jamais examinée.
 */
export async function appliquerEvenementRisque(input: {
  userId: string;
  event: RiskEvent;
  /** Identifiant de l'administrateur, ou nom du contrôle automatique. */
  auteur: string;
  motif?: string;
  clearSuspension?: boolean;
}): Promise<SuiteRisque> {
  const compte = await db.user.findUnique({
    where: { id: input.userId },
    select: { riskState: true, kycStatus: true, suspendedAt: true },
  });

  if (!compte) {
    return {
      applique: false,
      motif: "COMPTE_INTROUVABLE",
      message: "Ce compte n'existe pas.",
    };
  }

  const de = compte.riskState as RiskState;

  let decision;
  try {
    decision = applyRiskEvent({
      from: de,
      event: input.event,
      clearSuspension: input.clearSuspension,
      // Un compte non vérifié ne peut être ni signalé ni suspendu : il n'y a
      // encore rien à sanctionner.
      isVerified: compte.kycStatus !== "NONE",
    });
  } catch (cause) {
    if (cause instanceof SuspensionNonAutoriseeError) {
      return {
        applique: false,
        motif: "SUSPENSION_NON_LEVEE",
        message:
          "Cette transition lèverait une suspension : il faut le demander explicitement.",
      };
    }
    // Avant la transition interdite, dont elle est un cas : le message doit
    // dire que c'est l'identité qui manque.
    if (cause instanceof IdentiteNonVerifieeError) {
      return { applique: false, motif: "NON_VERIFIE", message: cause.message };
    }
    if (cause instanceof TransitionInterditeError) {
      return {
        applique: false,
        motif: "TRANSITION_INTERDITE",
        message: cause.message,
      };
    }
    throw cause;
  }

  if (decision.to === de) {
    return {
      applique: false,
      motif: "DEJA_DANS_CET_ETAT",
      message: "Le compte est déjà dans cet état.",
    };
  }

  const maintenant = new Date();
  const suspendMaintenant = estSuspendu(decision.to);

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.user.update({
      where: { id: input.userId },
      data: {
        riskState: decision.to,
        // `suspendedAt` porte la sanction ; l'état de risque porte la raison.
        // Les deux doivent bouger ensemble, sinon la session laisserait entrer
        // quelqu'un que la machine vient de suspendre.
        suspendedAt: suspendMaintenant ? (compte.suspendedAt ?? maintenant) : null,
      },
    });

    await tx.riskStateChange.create({
      data: {
        userId: input.userId,
        fromState: de,
        toState: decision.to,
        author: input.auteur,
        reason: input.motif ?? null,
      },
    });

    await executerEffets(tx, input.userId, decision.effects);
  });

  journal.avertissement("état de risque modifié", {
    userId: input.userId,
    de,
    vers: decision.to,
    par: input.auteur,
    effets: decision.effects,
  });

  return {
    applique: true,
    de,
    vers: decision.to,
    effets: decision.effects,
  };
}

/**
 * Les effets que la machine réclame.
 *
 * Cinq sont exécutables aujourd'hui ; les autres sont journalisés sans être
 * faits, parce que la brique correspondante n'existe pas. Les exécuter à
 * moitié en silence serait pire : on croirait un compte bloqué alors que son
 * adresse IP passe toujours.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES ADRESSES SE LISENT AVANT LA BOUCLE, ET CE N'EST PAS UN DÉTAIL
 *
 * `effetsPour` émet, dans cet ordre : `INVALIDER_SESSIONS`, puis
 * `DESACTIVER_PRODUITS`, puis `BLOQUER_IP`. Le premier supprime les sessions —
 * or les sessions sont **le seul endroit** où l'on sait d'où le compte se
 * connectait.
 *
 * Lire les adresses dans le `case "BLOQUER_IP"` aurait donc trouvé une table
 * vide et bloqué zéro adresse. Rien n'aurait échoué : l'effet aurait été
 * parcouru, la transaction validée, le journal aurait dit « fait ». Le seul
 * symptôme serait qu'un fraudeur suspendu se réinscrit sans être gêné — six
 * mois plus tard, quand plus personne ne fait le lien.
 *
 * On lit donc **avant**, une fois, hors de la boucle. Ainsi l'ordre des effets
 * peut changer sans rien casser ici.
 */
async function executerEffets(
  tx: Prisma.TransactionClient,
  userId: string,
  effets: RiskEffect[],
): Promise<void> {
  const adresses = effets.includes("BLOQUER_IP")
    ? await lireAdressesDeSession(tx, userId)
    : [];

  for (const effet of effets) {
    switch (effet) {
      case "INVALIDER_SESSIONS":
        // Une suspension qui laisse une session ouverte n'est pas une
        // suspension : le compte continue de vendre jusqu'à l'expiration.
        await tx.session.deleteMany({ where: { userId } });
        break;

      case "BLOQUER_IP":
        if (adresses.length === 0) {
          // Bruyant, parce que c'est le cas normal en développement et le cas
          // anormal en production. Un compte actif a des sessions ; n'en avoir
          // aucune veut dire que personne ne s'est connecté depuis la mise en
          // place de la colonne — ou que quelque chose les a effacées avant.
          journal.info("blocage d'adresse sans effet : aucune adresse connue", {
            userId,
          });
          break;
        }

        for (const adresse of adresses) {
          await bloquer(
            {
              type: "IP",
              valeur: adresse,
              raison: "suspension du compte",
              dureeMs: DUREE_BLOCAGE_IP_MS,
              userId,
            },
            tx,
          );
        }

        journal.info("adresses bloquées après suspension", {
          userId,
          combien: adresses.length,
        });
        break;

      case "DEBLOQUER_IP": {
        // Par `userId`, jamais par valeur : à ce moment-là les sessions ont
        // disparu depuis la suspension, et l'on ne saurait plus quelles
        // adresses avaient été bloquées.
        const levees = await debloquerPourCompte(userId, tx);
        journal.info("adresses débloquées après levée", { userId, levees });
        break;
      }

      case "DESACTIVER_PRODUITS":
        // La marque dit « c'est la sanction qui l'a retirée » : sans elle, la
        // levée ne saurait pas quoi rendre.
        await tx.product.updateMany({
          where: { sellerId: userId, status: "PUBLISHED" },
          data: { status: "ARCHIVED", archivedByRiskAt: new Date() },
        });
        break;

      case "REACTIVER_PRODUITS": {
        // Seules les ressources que la sanction a archivées reviennent. Celles
        // que le créateur avait archivées lui-même, ses brouillons et celles
        // sous retrait juridique ne bougent pas. Cet effet n'écrivait qu'une
        // ligne de journal : un créateur blanchi gardait une boutique vide
        // (mesuré le 25/09, Qualitytest S5 — 7 ressources sur 7).
        const { count } = await tx.product.updateMany({
          where: { sellerId: userId, status: "ARCHIVED", archivedByRiskAt: { not: null } },
          data: { status: "PUBLISHED", archivedByRiskAt: null },
        });
        journal.info("produits remis en vente après levée", { userId, combien: count });
        break;
      }

      case "JOURNALISER":
        break;

      default:
        // Retrait d'abonnés, suppression du domaine personnalisé, suspension
        // des autres comptes, filtre anti-abus : aucune de ces briques
        // n'existe. Le blocage d'adresse en faisait partie jusqu'ici.
        journal.info("effet de risque non exécuté : brique absente", {
          userId,
          effet,
        });
    }
  }
}

/**
 * Les adresses distinctes d'où ce compte s'est connecté.
 *
 * Celles qu'on connaît, pas toutes celles qui existent : une session ouverte
 * avant que la colonne n'existe porte `null`, et personne n'est passé par un
 * navigateur qui ne laisse rien. C'est une gêne posée sur ce qu'on a vu, pas
 * un filet.
 */
async function lireAdressesDeSession(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<string[]> {
  const sessions = await tx.session.findMany({
    where: { userId, ipAddress: { not: null } },
    select: { ipAddress: true },
    distinct: ["ipAddress"],
  });

  return sessions
    .map((s) => s.ipAddress)
    .filter((a): a is string => a !== null && a.trim().length > 0);
}
