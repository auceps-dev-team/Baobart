import "server-only";

import { db } from "@/lib/db";
import { piloteCourant } from "@/lib/payments/encaissement/pilotes";
import {
  BLOCAGE_MS,
  constatsEncaissement,
  graviteEncaissement,
  graviteRappel,
  LIBELLE_RAPPEL,
  type FaitsEncaissement,
  type StatutRappel,
} from "@/lib/payments/encaissement/supervision";
import type { Constat, Gravite } from "@/lib/systeme/diagnostic";

/**
 * Ce que l'écran de supervision des paiements lit.
 *
 * Les règles vivent dans `supervision.ts` et ne savent pas d'où viennent les
 * nombres ; ici on ne fait que compter.
 */

export const FILTRES = [
  "Tous",
  "Traités",
  "Sans effet",
  "Refusés",
  "En souffrance",
] as const;

export type Filtre = (typeof FILTRES)[number];

const STATUTS_PAR_FILTRE: Record<Filtre, StatutRappel[] | null> = {
  Tous: null,
  Traités: ["PROCESSED"],
  "Sans effet": ["IGNORED"],
  Refusés: ["REJECTED"],
  // Reçu et jamais traité : le traitement est tombé au milieu.
  "En souffrance": ["RECEIVED"],
};

export function filtreValide(brut: string | undefined): Filtre {
  return FILTRES.includes(brut as Filtre) ? (brut as Filtre) : "Tous";
}

export interface LigneRappel {
  id: string;
  recuLe: Date;
  fournisseur: string;
  referenceOperateur: string | null;
  statut: StatutRappel;
  libelleStatut: string;
  erreur: string | null;
  gravite: Gravite;
}

export interface VueEncaissement {
  pilote: string;
  constats: Constat[];
  gravite: Gravite;
  lignes: LigneRappel[];
  total: number;
  totalGeneral: number;
  bloquees: number;
  refus: number;
}

const PAGE = 30;
const HEURE_MS = 3_600_000;

export async function vueDeLEncaissement(
  filtre: Filtre = "Tous",
): Promise<VueEncaissement> {
  const maintenant = Date.now();
  const statuts = STATUTS_PAR_FILTRE[filtre];
  const ou = statuts ? { status: { in: statuts } } : {};

  const pilote = piloteCourant();
  const depuisUneHeure = new Date(maintenant - HEURE_MS);

  const [refus, discordances, bloquees, traites24h, total, totalGeneral, brutes] =
    await Promise.all([
      db.paymentWebhookEvent.count({
        where: { status: "REJECTED", receivedAt: { gte: depuisUneHeure } },
      }),
      db.paymentWebhookEvent.count({
        where: {
          status: "REJECTED",
          receivedAt: { gte: depuisUneHeure },
          // Les discordances portent leur motif dans l'erreur. On les distingue
          // des refus de signature : les premières veulent dire « quelqu'un
          // ment », les secondes « un secret est décalé ».
          error: { contains: "Attendu" },
        },
      }),
      db.order.count({
        where: {
          status: "IN_PROGRESS",
          createdAt: { lt: new Date(maintenant - BLOCAGE_MS) },
        },
      }),
      db.paymentWebhookEvent.count({
        where: {
          status: { in: ["PROCESSED", "IGNORED"] },
          receivedAt: { gte: new Date(maintenant - 86_400_000) },
        },
      }),
      db.paymentWebhookEvent.count({ where: ou }),
      db.paymentWebhookEvent.count(),
      db.paymentWebhookEvent.findMany({
        where: ou,
        orderBy: { receivedAt: "desc" },
        take: PAGE,
        // La charge utile est absente de cette sélection, et ce n'est pas un
        // oubli : un corps d'opérateur porte des numéros de téléphone et des
        // identifiants de transaction. On les garde pour l'arbitrage, pas pour
        // les afficher à qui ouvre l'écran.
        select: {
          id: true,
          receivedAt: true,
          provider: true,
          providerRef: true,
          status: true,
          error: true,
        },
      }),
    ]);

  const faits: FaitsEncaissement = {
    pilote: pilote.nom === "aucun" ? null : pilote.nom,
    refusRecents: refus,
    discordancesRecentes: discordances,
    bloquees,
    traites24h,
  };

  return {
    pilote: pilote.nom,
    constats: constatsEncaissement(faits),
    gravite: graviteEncaissement(faits),
    lignes: brutes.map((b) => {
      const statut = b.status as StatutRappel;
      return {
        id: b.id,
        recuLe: b.receivedAt,
        fournisseur: b.provider,
        referenceOperateur: b.providerRef,
        statut,
        libelleStatut: LIBELLE_RAPPEL[statut],
        erreur: b.error,
        gravite: graviteRappel(statut),
      };
    }),
    total,
    totalGeneral,
    bloquees,
    refus,
  };
}

export function graviteGlobaleEncaissement(vue: VueEncaissement): Gravite {
  return vue.gravite;
}
