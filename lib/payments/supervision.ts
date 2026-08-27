import "server-only";

import { db } from "@/lib/db";
import { masquerCompte } from "@/lib/payments/gains";
import { RAILS_BAOBART } from "@/lib/payments/payout-schedule";
import type { Gravite } from "@/lib/systeme/diagnostic";

/**
 * Superviser les versements, du premier état au dernier.
 *
 * La machine à huit états existait depuis longtemps, avec ses transitions
 * nommées et sa règle d'or — un versement annulé ou échoué rend ses soldes.
 * Personne ne pouvait la faire avancer : un versement naissait en CREATING et
 * y restait. Cet écran lui donne ses commandes.
 */

export type EtatVersement =
  | "CREATING"
  | "PROCESSING"
  | "UNCLAIMED"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED"
  | "RETURNED"
  | "REVERSED";

/**
 * Ce que chaque état raconte, et ce qu'il faut en penser.
 *
 * Un versement en cours n'est pas un incident ; un retour l'est. La gravité
 * range l'écran par ce qui demande une décision, pas par ordre alphabétique.
 */
export const ETATS: Record<
  EtatVersement,
  { libelle: string; sens: string; gravite: Gravite }
> = {
  CREATING: {
    libelle: "PRÉPARÉ",
    sens: "Soldes réservés, rien n'est encore parti chez l'opérateur.",
    gravite: "attention",
  },
  PROCESSING: {
    libelle: "ENVOYÉ",
    sens: "L'ordre est chez l'opérateur, en attente de confirmation.",
    gravite: "ok",
  },
  UNCLAIMED: {
    libelle: "NON RÉCLAMÉ",
    sens: "L'opérateur attend que le bénéficiaire retire les fonds.",
    gravite: "attention",
  },
  COMPLETED: {
    libelle: "PAYÉ",
    sens: "L'argent est arrivé.",
    gravite: "ok",
  },
  CANCELLED: {
    libelle: "ANNULÉ",
    sens: "Annulé avant envoi. Les soldes sont repartis au cycle suivant.",
    gravite: "ok",
  },
  FAILED: {
    libelle: "ÉCHOUÉ",
    sens: "L'ordre n'est pas passé. Les soldes sont redevenus versables.",
    gravite: "panne",
  },
  RETURNED: {
    libelle: "RETOURNÉ",
    sens: "L'argent est revenu — coordonnées invalides, compte fermé.",
    gravite: "panne",
  },
  REVERSED: {
    libelle: "REPRIS",
    sens: "Repris après avoir été payé.",
    gravite: "panne",
  },
};

/**
 * Les suites permises, recopiées de `versements.ts`.
 *
 * L'écran ne propose que ce que la machine accepterait : afficher un bouton
 * qui lèvera `TransitionInterditeError` fait perdre confiance à celui qui
 * clique, et il finit par ne plus rien tenter.
 */
export const SUITES_PERMISES: Record<EtatVersement, EtatVersement[]> = {
  CREATING: ["PROCESSING", "CANCELLED", "FAILED"],
  PROCESSING: ["COMPLETED", "UNCLAIMED", "FAILED"],
  UNCLAIMED: ["COMPLETED", "FAILED", "RETURNED"],
  COMPLETED: ["RETURNED", "REVERSED"],
  CANCELLED: [],
  FAILED: [],
  RETURNED: [],
  REVERSED: [],
};

export interface VersementSupervise {
  id: string;
  beneficiaire: string;
  moyen: string;
  compte: string;
  montant: number;
  devise: string;
  etat: EtatVersement;
  reference: string | null;
  motifEchec: string | null;
  creeLe: Date;
  suites: EtatVersement[];
}

export interface VueVersements {
  lignes: VersementSupervise[];
  parEtat: Array<{ etat: EtatVersement; nombre: number; montant: number }>;
  total: number;
}

const PAGE = 40;

export async function vueDesVersements(
  filtre?: EtatVersement,
): Promise<VueVersements> {
  const ou = filtre ? { status: filtre } : {};

  const [lignes, total, groupes] = await Promise.all([
    db.payout.findMany({
      where: ou,
      orderBy: { createdAt: "desc" },
      take: PAGE,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        providerRef: true,
        failureReason: true,
        createdAt: true,
        method: true,
        user: {
          select: {
            payoutRail: true,
            email: true,
            profile: { select: { displayName: true } },
            payoutAccounts: {
              where: { deletedAt: null },
              take: 1,
              select: { accountRef: true },
            },
          },
        },
      },
    }),
    db.payout.count({ where: ou }),
    db.payout.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);

  return {
    lignes: lignes.map((p) => {
      const etat = p.status as EtatVersement;
      const rail = p.user.payoutRail
        ? RAILS_BAOBART[p.user.payoutRail]?.label
        : null;

      return {
        id: p.id,
        beneficiaire: p.user.profile?.displayName ?? p.user.email,
        moyen: rail ?? p.method,
        // Jamais la référence entière, même côté administration : une capture
        // d'écran d'incident circule et reste.
        compte: p.user.payoutAccounts[0]
          ? masquerCompte(p.user.payoutAccounts[0].accountRef)
          : "aucun compte",
        montant: p.amount,
        devise: p.currency,
        etat,
        reference: p.providerRef,
        motifEchec: p.failureReason,
        creeLe: p.createdAt,
        suites: SUITES_PERMISES[etat] ?? [],
      };
    }),
    parEtat: groupes.map((g) => ({
      etat: g.status as EtatVersement,
      nombre: g._count._all,
      montant: g._sum.amount ?? 0,
    })),
    total,
  };
}
