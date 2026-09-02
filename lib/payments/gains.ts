import "server-only";

import { db } from "@/lib/db";
import { soldeVersableJusqua } from "@/lib/domain/balances";
import { BAREME_XOF } from "@/lib/domain/fees";
import type { RiskState } from "@/lib/domain/trust";
import { peutEtrePaye, type DecisionVersement } from "@/lib/payments/eligibilite";
import {
  CONFIG_PAR_DEFAUT,
  RAILS_BAOBART,
  jour,
  prochaineDateVersement,
  type PayoutFrequency,
  type PayoutRail,
} from "@/lib/payments/payout-schedule";

/**
 * Ce que le créateur lit sur son écran « Gains ».
 *
 * Le PLAN désigne l'incertitude de paiement comme LE frein des créateurs
 * africains. Cet écran est la réponse : il répond à « combien » et « quand »
 * avec des chiffres qui viennent du grand livre, jamais d'une estimation.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TROIS SOMMES QU'IL NE FAUT PAS CONFONDRE
 *
 *   DISPONIBLE   ce qui est sorti de la période de rétention et partira au
 *                prochain versement.
 *   EN ATTENTE   encaissé, mais encore dans les sept jours de rétention. C'est
 *                de l'argent acquis, pas encore versable.
 *   VERSÉ        ce qui est déjà parti. Cumul de l'année en cours.
 *
 * Les additionner donnerait un total flatteur et faux. Un créateur qui lit
 * « 96 800 F » doit pouvoir compter dessus le jour dit.
 */

export interface Versement {
  id: string;
  montant: number;
  statut: string;
  /** Jour où le créateur reçoit — ou devait recevoir. */
  date: Date | null;
  /** Dernière vente incluse. */
  periodEnd: Date | null;
  rail: string;
  compte: string;
  motifEchec: string | null;
}

export interface MoisDeVersement {
  /** « juil. » — abrégé, comme le graphique de la maquette. */
  libelle: string;
  montant: number;
}

export interface Gains {
  devise: string;
  /** Versable au prochain cycle. */
  disponible: number;
  /** Encaissé, encore en rétention. */
  enAttente: number;
  /** Cumul versé depuis le 1er janvier. */
  cumulAnnee: number;
  /** Part du prix qui revient au créateur, dérivée du barème réel. */
  partCreateur: string;
  /** Prochaine date de versement, ou `null` si rien ne part. */
  prochainVersement: Date | null;
  /** Pourquoi rien ne part, le cas échéant. */
  blocage: DecisionVersement;
  compte: {
    id: string;
    provider: string;
    label: string;
    /** Masqué : on n'affiche jamais un numéro entier à l'écran. */
    apercu: string;
    verifie: boolean;
  } | null;
  versements: Versement[];
  parMois: MoisDeVersement[];
}

const MOIS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

/**
 * Masque une référence de compte.
 *
 * « ···· 4821 » comme la maquette. Afficher un numéro mobile money entier sur
 * un écran qu'on montre à quelqu'un par-dessus l'épaule est une fuite gratuite.
 */
export function masquerCompte(reference: string): string {
  const propre = reference.replace(/\s+/g, "");
  if (propre.length <= 4) return `···· ${propre}`;
  return `···· ${propre.slice(-4)}`;
}

export async function gainsDe(
  userId: string,
  maintenant: Date = new Date(),
): Promise<Gains> {
  const config = CONFIG_PAR_DEFAUT;

  const compte = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      riskState: true,
      suspendedAt: true,
      payoutsPausedAt: true,
      payoutFrequency: true,
      defaultCurrency: true,
      payoutAccounts: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          provider: true,
          accountRef: true,
          createdAt: true,
          verifiedAt: true,
        },
      },
    },
  });

  const devise = compte.defaultCurrency;
  const compteActif = compte.payoutAccounts[0] ?? null;
  const rail: PayoutRail =
    (compteActif ? RAILS_BAOBART[compteActif.provider] : undefined) ??
    RAILS_BAOBART.wave!;

  // Ce qui est sorti de rétention aujourd'hui. La borne est la même que celle
  // du versement : le créateur ne doit pas lire un chiffre que le passage
  // hebdomadaire contredira.
  const finRetention = jour(
    new Date(maintenant.getTime() - config.delayDays * 86_400_000),
  );

  const [disponible, totalNonVerse] = await Promise.all([
    soldeVersableJusqua(db, userId, finRetention, devise),
    soldeVersableJusqua(db, userId, jour(maintenant), devise),
  ]);

  // Ce qui reste dans les sept jours : la différence, jamais un second calcul
  // qui pourrait diverger du premier.
  const enAttente = Math.max(0, totalNonVerse - disponible);

  const debutAnnee = new Date(Date.UTC(maintenant.getUTCFullYear(), 0, 1));

  const lignes = await db.payout.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      amount: true,
      status: true,
      scheduledDate: true,
      processedAt: true,
      periodEnd: true,
      provider: true,
      accountRef: true,
      failureReason: true,
      createdAt: true,
    },
  });

  const aboutis = lignes.filter((v) => v.status === "COMPLETED");

  const cumulAnnee = aboutis
    .filter((v) => (v.processedAt ?? v.createdAt) >= debutAnnee)
    .reduce((s, v) => s + v.amount, 0);

  const decision = peutEtrePaye({
    riskState: compte.riskState as RiskState,
    suspenduLe: compte.suspendedAt,
    versementsSuspendusLe: compte.payoutsPausedAt,
    compte: compteActif
      ? {
          provider: compteActif.provider,
          accountRef: compteActif.accountRef,
          enregistreLe: compteActif.createdAt,
        }
      : null,
    railsConnus: Object.keys(RAILS_BAOBART),
    soldeVersable: disponible,
    minimum: config.minimumAmount,
  });

  const prochain = decision.payable
    ? prochaineDateVersement({
        frequency: compte.payoutFrequency as PayoutFrequency,
        rail,
        soldeVersableJusqua: () => disponible,
        today: maintenant,
        config,
      })
    : null;

  return {
    devise,
    disponible,
    enAttente,
    cumulAnnee,
    partCreateur: partCreateurLisible(),
    prochainVersement: prochain,
    blocage: decision,
    compte: compteActif
      ? {
          id: compteActif.id,
          provider: compteActif.provider,
          label: RAILS_BAOBART[compteActif.provider]?.label ?? compteActif.provider,
          apercu: masquerCompte(compteActif.accountRef),
          verifie: compteActif.verifiedAt !== null,
        }
      : null,
    versements: lignes.map((v) => ({
      id: v.id,
      montant: v.amount,
      statut: v.status,
      date: v.processedAt ?? v.scheduledDate,
      periodEnd: v.periodEnd,
      rail: RAILS_BAOBART[v.provider]?.label ?? v.provider,
      compte: masquerCompte(v.accountRef),
      motifEchec: v.failureReason,
    })),
    parMois: parMois(aboutis, maintenant),
  };
}

/**
 * Six derniers mois de versements aboutis, pour le graphique de la maquette.
 *
 * Les mois sans versement restent à zéro plutôt que d'être omis : une barre
 * absente laisse croire à un trou dans les données, une barre à zéro dit qu'il
 * ne s'est rien passé.
 */
function parMois(
  aboutis: Array<{ amount: number; processedAt: Date | null; createdAt: Date }>,
  maintenant: Date,
): MoisDeVersement[] {
  const resultat: MoisDeVersement[] = [];

  for (let recul = 5; recul >= 0; recul -= 1) {
    const d = new Date(
      Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - recul, 1),
    );
    const suivant = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1),
    );

    const montant = aboutis
      .filter((v) => {
        const quand = v.processedAt ?? v.createdAt;
        return quand >= d && quand < suivant;
      })
      .reduce((s, v) => s + v.amount, 0);

    resultat.push({ libelle: MOIS[d.getUTCMonth()]!, montant });
  }

  return resultat;
}

/**
 * Part du prix qui revient au créateur.
 *
 * Dérivée du barème, jamais écrite en dur. La maquette annonce « 80 % » — un
 * taux que la lecture du dépôt de référence a fait abandonner
 * (VERIFICATION_GUMROAD §2.1). Deux chiffres qui se contredisent entre le code
 * et l'écran finissent toujours par être découverts par un créateur.
 */
function partCreateurLisible(): string {
  return `${100 - BAREME_XOF.directRateBp / 100} %`;
}
