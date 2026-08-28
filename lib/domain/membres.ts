import "server-only";

import { db } from "@/lib/db";
import { ETATS_SUSPENDUS, type RiskEvent, type RiskState } from "@/lib/domain/trust";

/**
 * La liste des comptes, vue de l'administration.
 *
 * Elle n'existe que pour rendre atteignables les décisions de confiance : sans
 * écran, `appliquerEvenementRisque` resterait ce qu'était la machine à états
 * avant lui — juste, éprouvée, et appelée par personne.
 */

/**
 * Les trois états que la maquette montre, sur nos sept.
 *
 * Nos sept états de risque disent *pourquoi* ; ces trois-là disent *où en est
 * le compte*. Le regroupement n'est pas une perte : on garde la distinction
 * fraude / conditions là où elle sert — dans le libellé des décisions et dans
 * la trace écrite — et on l'épargne à l'œil qui parcourt une liste.
 */
export type EtatMembre = "SAIN" | "SIGNALE" | "SUSPENDU";

export const ETATS_MEMBRE: Record<
  EtatMembre,
  { sens: string; ton: string }
> = {
  SAIN: { sens: "Aucune décision en cours.", ton: "neutre" },
  SIGNALE: {
    sens: "Sous observation. Le membre ne le voit pas ; ses versements continuent.",
    ton: "attend",
  },
  SUSPENDU: {
    sens: "Publication bloquée, versements gelés, compte visible en lecture seule côté membre.",
    ton: "gele",
  },
};

export function etatMembreDe(risque: RiskState): EtatMembre {
  if (ETATS_SUSPENDUS.includes(risque)) return "SUSPENDU";
  if (risque === "FLAGGED_FRAUD" || risque === "FLAGGED_TOS") return "SIGNALE";
  return "SAIN";
}

export const FILTRES_MEMBRES = ["Tous", "Sains", "Signalés", "Suspendus"] as const;
export type FiltreMembres = (typeof FILTRES_MEMBRES)[number];

export function filtreMembresValide(brut: string | undefined): FiltreMembres {
  return FILTRES_MEMBRES.includes(brut as FiltreMembres)
    ? (brut as FiltreMembres)
    : "Tous";
}

/**
 * Ce qu'on peut décider sur un compte, selon son état.
 *
 * La liste vient de la machine : proposer une transition qu'elle refusera
 * ferait cliquer dans le vide. La probation et « non examiné » sont omises —
 * elles existent pour les contrôles automatiques, pas pour un geste
 * d'administration.
 */
export function decisionsPour(
  etat: RiskState,
): Array<{ event: RiskEvent; libelle: string; leveSuspension: boolean }> {
  if (ETATS_SUSPENDUS.includes(etat)) {
    return [
      { event: "MARK_COMPLIANT", libelle: "Lever la suspension", leveSuspension: true },
    ];
  }

  if (etat === "FLAGGED_FRAUD" || etat === "FLAGGED_TOS") {
    return [
      { event: "SUSPEND_TOS", libelle: "Suspendre (conditions)", leveSuspension: false },
      { event: "SUSPEND_FRAUD", libelle: "Suspendre (fraude)", leveSuspension: false },
      { event: "MARK_COMPLIANT", libelle: "Lever le signalement", leveSuspension: false },
    ];
  }

  return [
    { event: "FLAG_TOS", libelle: "Signaler (conditions)", leveSuspension: false },
    { event: "FLAG_FRAUD", libelle: "Signaler (fraude)", leveSuspension: false },
    { event: "SUSPEND_TOS", libelle: "Suspendre (conditions)", leveSuspension: false },
    { event: "SUSPEND_FRAUD", libelle: "Suspendre (fraude)", leveSuspension: false },
  ];
}

export interface MembreAdmin {
  id: string;
  nom: string;
  email: string;
  etatRisque: RiskState;
  suspendu: boolean;
  suspenduLe: Date | null;
  kyc: string;
  produits: number;
  /// Ce que le compte a en attente de versement — gelé s'il est suspendu.
  soldeGele: number;
  inscritLe: Date;
  derniereDecision: { auteur: string; motif: string | null; le: Date } | null;
}

const PAGE = 40;

export async function listerMembres(
  filtre: FiltreMembres = "Tous",
): Promise<{ membres: MembreAdmin[]; total: number; suspendus: number }> {
  const ou =
    filtre === "Suspendus"
      ? { riskState: { in: [...ETATS_SUSPENDUS] } }
      : filtre === "Signalés"
        ? { riskState: { in: ["FLAGGED_FRAUD", "FLAGGED_TOS"] as RiskState[] } }
        : filtre === "Sains"
          ? {
              riskState: {
                notIn: [
                  ...ETATS_SUSPENDUS,
                  "FLAGGED_FRAUD",
                  "FLAGGED_TOS",
                ] as RiskState[],
              },
            }
          : {};



  const [lignes, total, suspendus] = await Promise.all([
    db.user.findMany({
      where: ou,
      orderBy: { createdAt: "desc" },
      take: PAGE,
      select: {
        id: true,
        email: true,
        riskState: true,
        kycStatus: true,
        suspendedAt: true,
        createdAt: true,
        profile: { select: { displayName: true } },
        _count: { select: { products: true } },
        balances: { where: { state: "UNPAID" }, select: { holdingAmount: true } },
        riskStateChanges: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { author: true, reason: true, createdAt: true },
        },
      },
    }),
    db.user.count({ where: ou }),
    db.user.count({ where: { riskState: { in: [...ETATS_SUSPENDUS] } } }),
  ]);

  return {
    membres: lignes.map((u) => ({
      id: u.id,
      nom: u.profile?.displayName ?? u.email,
      email: u.email,
      etatRisque: u.riskState as RiskState,
      suspendu: u.suspendedAt !== null,
      suspenduLe: u.suspendedAt,
      kyc: u.kycStatus,
      produits: u._count.products,
      soldeGele: u.balances.reduce((t, b) => t + b.holdingAmount, 0),
      inscritLe: u.createdAt,
      derniereDecision: u.riskStateChanges[0]
        ? {
            auteur: u.riskStateChanges[0].author,
            motif: u.riskStateChanges[0].reason,
            le: u.riskStateChanges[0].createdAt,
          }
        : null,
    })),
    total,
    suspendus,
  };
}
