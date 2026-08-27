import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import {
  applyRiskEvent,
  estSuspendu,
  SuspensionNonAutoriseeError,
  TransitionInterditeError,
  type RiskEffect,
  type RiskEvent,
  type RiskState,
} from "@/lib/domain/trust";
import { journal } from "@/lib/observabilite/journal";

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
 * Trois sont exécutables aujourd'hui ; les autres sont journalisés sans être
 * faits, parce que la brique correspondante n'existe pas. Les exécuter à
 * moitié en silence serait pire : on croirait un compte bloqué alors que son
 * adresse IP passe toujours.
 */
async function executerEffets(
  tx: Prisma.TransactionClient,
  userId: string,
  effets: RiskEffect[],
): Promise<void> {
  for (const effet of effets) {
    switch (effet) {
      case "INVALIDER_SESSIONS":
        // Une suspension qui laisse une session ouverte n'est pas une
        // suspension : le compte continue de vendre jusqu'à l'expiration.
        await tx.session.deleteMany({ where: { userId } });
        break;

      case "DESACTIVER_PRODUITS":
        await tx.product.updateMany({
          where: { sellerId: userId, status: "PUBLISHED" },
          data: { status: "ARCHIVED" },
        });
        break;

      case "REACTIVER_PRODUITS":
        // Volontairement non fait : on ne sait pas lesquels étaient publiés
        // avant la sanction, et tout republier remettrait en vente ce que le
        // créateur avait lui-même retiré.
        journal.info("effet de risque non exécuté : réactivation des produits", {
          userId,
          raison: "l'état d'avant sanction n'est pas conservé",
        });
        break;

      case "JOURNALISER":
        break;

      default:
        // Blocage d'IP, retrait d'abonnés, suspension des autres comptes,
        // filtre anti-abus : aucune de ces briques n'existe.
        journal.info("effet de risque non exécuté : brique absente", {
          userId,
          effet,
        });
    }
  }
}
