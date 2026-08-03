import "server-only";

import { db } from "@/lib/db";
import { soldeVersableJusqua } from "@/lib/domain/balances";
import type { RiskState } from "@/lib/domain/trust";
import { peutEtrePaye, type RefusVersement } from "@/lib/payments/eligibilite";
import {
  CONFIG_PAR_DEFAUT,
  RAILS_BAOBART,
  cycleInitial,
  finDePeriodePourVersement,
  dateVersementPourCycle,
  jour,
  memeJour,
  type PayoutConfig,
  type PayoutFrequency,
} from "@/lib/payments/payout-schedule";
import { preparerVersement } from "@/lib/payments/versements";

/**
 * Le passage hebdomadaire des versements.
 *
 * C'est la pièce qui manquait pour fermer la boucle : le calendrier savait
 * quand, les règles savaient qui, l'exécution savait comment — mais rien ne
 * parcourait les créateurs pour déclencher.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QUE CE MODULE NE FAIT PAS
 *
 * Il n'envoie pas l'argent. Il prépare des versements en état CREATING, avec
 * leurs soldes réservés ; c'est l'appel à l'opérateur — Wave, Orange Money, un
 * virement — qui les fera passer en PROCESSING, et il n'existe pas encore.
 * Préparer sans envoyer est sans danger : un versement CREATING s'annule, et
 * ses soldes redeviennent versables.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UN ÉCHEC N'ARRÊTE PAS LE LOT
 *
 * Chaque créateur est traité isolément. Un compte mal formé, une contrainte
 * heurtée, et tous les suivants seraient sautés pour la semaine — c'est
 * exactement le genre de panne qu'on ne voit qu'au moment où trente personnes
 * écrivent qu'elles n'ont pas été payées.
 */

export interface ResultatCycle {
  cycleDate: Date;
  prepares: Array<{ userId: string; payoutId: string; montant: number }>;
  ecartes: Array<{ userId: string; raison: RefusVersement | "ERREUR"; message: string }>;
}

export interface CycleInput {
  /** Date du cycle traité. Par défaut, le cycle courant. */
  cycleDate?: Date;
  config?: PayoutConfig;
  /** Rails exécutés ce jour-là. Par défaut, tous. */
  rails?: readonly string[];
  /** Ne prépare rien : renvoie ce qui serait fait. */
  simulation?: boolean;
  /** Borne de sécurité sur le nombre de créateurs traités en un passage. */
  limite?: number;
}

/**
 * Prépare les versements d'un cycle.
 *
 * Ne retient que les créateurs dont le rail tombe ce jour-là : les rails sont
 * étalés dans la semaine, et payer tout le monde le même jour ferait tomber
 * les fenêtres de compensation des opérateurs.
 */
export async function preparerLeCycle(
  input: CycleInput = {},
): Promise<ResultatCycle> {
  const {
    config = CONFIG_PAR_DEFAUT,
    rails = Object.keys(RAILS_BAOBART),
    simulation = false,
    limite = 500,
  } = input;

  const cycleDate = jour(input.cycleDate ?? cycleInitial(new Date(), "WEEKLY", config));

  const resultat: ResultatCycle = {
    cycleDate,
    prepares: [],
    ecartes: [],
  };

  const candidats = await db.user.findMany({
    where: {
      // Un compte sans moyen de versement n'a rien à faire dans le lot : le
      // filtre est en base plutôt qu'en mémoire, sinon on lirait tous les
      // comptes de la plateforme chaque semaine.
      payoutAccounts: { some: { deletedAt: null } },
    },
    take: limite,
    select: {
      id: true,
      riskState: true,
      suspendedAt: true,
      payoutsPausedAt: true,
      payoutFrequency: true,
      defaultCurrency: true,
      payoutAccounts: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { method: true, provider: true, accountRef: true },
      },
    },
  });

  for (const candidat of candidats) {
    const compte = candidat.payoutAccounts[0] ?? null;
    const rail = compte ? RAILS_BAOBART[compte.provider] : undefined;

    // Le rail de ce créateur tombe-t-il sur ce cycle ? Un créateur payé le
    // mardi n'a rien à faire dans le passage du jeudi.
    if (rail && !rails.includes(rail.id)) continue;

    // La cadence décide si ce cycle est le sien : un créateur mensuel n'est
    // pas payé chaque semaine.
    if (rail && !cycleLuiRevient(cycleDate, candidat.payoutFrequency, config)) {
      continue;
    }

    const periodEnd = rail
      ? finDePeriodePourVersement(
          dateVersementPourCycle(cycleDate, rail, config),
          rail,
          config,
        )
      : cycleDate;

    const solde = await soldeVersableJusqua(
      db,
      candidat.id,
      periodEnd,
      candidat.defaultCurrency,
    );

    const decision = peutEtrePaye({
      riskState: candidat.riskState as RiskState,
      suspenduLe: candidat.suspendedAt,
      versementsSuspendusLe: candidat.payoutsPausedAt,
      compte,
      railsConnus: Object.keys(RAILS_BAOBART),
      soldeVersable: solde,
      minimum: config.minimumAmount,
    });

    if (!decision.payable) {
      resultat.ecartes.push({
        userId: candidat.id,
        raison: decision.raison,
        message: decision.message,
      });
      continue;
    }

    if (simulation) {
      resultat.prepares.push({
        userId: candidat.id,
        payoutId: "(simulation)",
        montant: solde,
      });
      continue;
    }

    try {
      const { versement } = await preparerVersement({
        userId: candidat.id,
        cycleDate,
        rail: rail!,
        method: compte!.method,
        accountRef: compte!.accountRef,
        holdingCurrency: candidat.defaultCurrency,
        config,
      });

      resultat.prepares.push({
        userId: candidat.id,
        payoutId: versement.id,
        montant: versement.amount,
      });
    } catch (erreur) {
      // Un créateur qui échoue n'emporte pas les suivants. Sans ça, un compte
      // mal formé priverait de paie tous ceux qui viennent après lui dans la
      // liste, et on ne l'apprendrait qu'en lisant leurs messages.
      resultat.ecartes.push({
        userId: candidat.id,
        raison: "ERREUR",
        message: erreur instanceof Error ? erreur.message : String(erreur),
      });
    }
  }

  return resultat;
}

/**
 * Ce cycle est-il celui de ce créateur ?
 *
 * Un créateur hebdomadaire est payé à chaque cycle ; un mensuel seulement au
 * dernier cycle de son mois, un trimestriel au dernier de son trimestre. On
 * pose la question à `cycleInitial`, qui connaît déjà ces règles, plutôt que
 * de les réécrire ici — deux exemplaires d'une même règle finissent toujours
 * par diverger.
 */
function cycleLuiRevient(
  cycleDate: Date,
  frequency: PayoutFrequency,
  config: PayoutConfig,
): boolean {
  if (frequency === "WEEKLY" || frequency === "DAILY") return true;
  return memeJour(cycleInitial(cycleDate, frequency, config), cycleDate);
}
