import "server-only";

import { db } from "@/lib/db";
import { peutEtrePaye } from "@/lib/payments/eligibilite";
import { RAILS_BAOBART } from "@/lib/payments/payout-schedule";
import { preparerVersement, RienAVerserError } from "@/lib/payments/versements";
import type { RiskState } from "@/lib/domain/trust";
import { journal } from "@/lib/observabilite/journal";

/**
 * Verser à nouveau, sans attendre le cycle.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE N'EST PAS UNE TRANSITION
 *
 * On pourrait croire qu'un versement échoué doit pouvoir « repartir ». Il le
 * fait déjà : `transiter()` rend ses soldes exacts en UNPAID, et le passage
 * hebdomadaire les reprend. Le rejeu existe — il est automatique, pas immédiat.
 *
 * Ajouter ECHOUE → A_ENVOYER à la machine coûterait cher pour rien : chaque
 * `Payout` est une **tentative réelle auprès d'un opérateur**, avec sa
 * référence et son motif d'échec. Recycler la ligne effacerait l'historique de
 * la première tentative, et c'est précisément ce qu'on montre à l'opérateur le
 * jour où il conteste.
 *
 * Ce module ne fait donc pas repartir l'ancien versement : il en prépare un
 * **nouveau**, tout de suite, sur les soldes que l'échec a rendus.
 */

export type SuiteReprise =
  | { prepare: true; payoutId: string; montant: number }
  | {
      prepare: false;
      motif: "PAS_TERMINE" | "INTROUVABLE" | "PAS_DE_COMPTE" | "RIEN_A_VERSER" | "REFUSE";
      message: string;
    };

/** Les états depuis lesquels un nouvel essai a du sens. */
const REJOUABLES = ["FAILED", "RETURNED", "CANCELLED"] as const;

export async function verserANouveau(input: {
  payoutId: string;
  /** Qui déclenche — pour la trace, jamais pour l'autorisation. */
  auteur: string;
  maintenant?: Date;
}): Promise<SuiteReprise> {
  const maintenant = input.maintenant ?? new Date();

  const ancien = await db.payout.findUnique({
    where: { id: input.payoutId },
    select: {
      id: true,
      status: true,
      userId: true,
      user: {
        select: {
          riskState: true,
          suspendedAt: true,
          payoutsPausedAt: true,
          payoutRail: true,
          defaultCurrency: true,
          payoutAccounts: {
            where: { deletedAt: null },
            take: 1,
            select: { provider: true, method: true, accountRef: true },
          },
        },
      },
    },
  });

  if (!ancien) {
    return { prepare: false, motif: "INTROUVABLE", message: "Versement introuvable." };
  }

  if (!REJOUABLES.includes(ancien.status as (typeof REJOUABLES)[number])) {
    return {
      prepare: false,
      motif: "PAS_TERMINE",
      message:
        "Ce versement n'est pas dans un état où un nouvel essai a du sens.",
    };
  }

  const compte = ancien.user.payoutAccounts[0];
  if (!compte) {
    return {
      prepare: false,
      motif: "PAS_DE_COMPTE",
      message: "Ce créateur n'a plus de compte de versement enregistré.",
    };
  }

  // ────────────────────────────────────────────────────────────────
  // LE GEL SE VÉRIFIE ICI, ET NON DANS `peutEtrePaye`
  //
  // `parAdministrateur` lève délibérément VERSEMENTS_SUSPENDUS : la permission a
  // été écrite quand le gel était une décision humaine, qu'un autre humain
  // pouvait donc défaire en connaissance de cause.
  //
  // Depuis, un litige pose ce gel **tout seul** (`lib/domain/litiges.ts`).
  // Laisser un clic le contourner rouvrirait exactement le trou qu'on vient de
  // fermer dans `transiter()` : l'argent d'un compte dont l'opérateur vient de
  // reprendre des fonds repartirait quand même.
  if (ancien.user.payoutsPausedAt !== null) {
    return {
      prepare: false,
      motif: "REFUSE",
      message:
        "Les versements de ce compte sont suspendus. Lever la suspension d'abord.",
    };
  }

  // Pour le reste, la même décision que le cycle, en mode administrateur :
  // rejouer à la main lève le seuil minimum et le contrôle en cours — un
  // versement décidé par quelqu'un l'est en connaissance de cause.
  const decision = peutEtrePaye({
    riskState: ancien.user.riskState as RiskState,
    suspenduLe: ancien.user.suspendedAt,
    versementsSuspendusLe: ancien.user.payoutsPausedAt,
    compte: { provider: compte.provider, accountRef: compte.accountRef },
    railsConnus: Object.keys(RAILS_BAOBART),
    soldeVersable: 1,
    minimum: 0,
    parAdministrateur: true,
  });

  if (!decision.payable) {
    return { prepare: false, motif: "REFUSE", message: decision.message };
  }

  const rail = RAILS_BAOBART[compte.provider];
  if (!rail) {
    return {
      prepare: false,
      motif: "PAS_DE_COMPTE",
      message: "Le moyen de versement de ce créateur n'est plus reconnu.",
    };
  }

  try {
    const { versement } = await preparerVersement({
      userId: ancien.userId,
      cycleDate: maintenant,
      rail,
      method: compte.method,
      accountRef: compte.accountRef,
      holdingCurrency: ancien.user.defaultCurrency,
      // Un essai déclenché à la main ignore le seuil : si un humain décide de
      // repayer, ce n'est pas au minimum de cycle de l'en empêcher.
      forcer: true,
    });

    journal.info("versement rejoué à la main", {
      ancienId: ancien.id,
      nouveauId: versement.id,
      montant: versement.amount,
      par: input.auteur,
    });

    return { prepare: true, payoutId: versement.id, montant: versement.amount };
  } catch (cause) {
    if (cause instanceof RienAVerserError) {
      return {
        prepare: false,
        motif: "RIEN_A_VERSER",
        message:
          "Rien à verser : les soldes ont déjà été repris par un autre versement.",
      };
    }
    throw cause;
  }
}
