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

export const FILTRES_MEMBRES = ["Tous", "Créateurs", "Suspendus"] as const;
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
 * ferait cliquer dans le vide. `MARK_NOT_REVIEWED` et la probation sont
 * omises — elles existent pour les contrôles automatiques, pas pour un geste
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

  return [
    { event: "FLAG_TOS", libelle: "Signaler (conditions)", leveSuspension: false },
    { event: "FLAG_FRAUD", libelle: "Signaler (fraude)", leveSuspension: false },
    { event: "SUSPEND_TOS", libelle: "Suspendre (conditions)", leveSuspension: false },
    { event: "SUSPEND_FRAUD", libelle: "Suspendre (fraude)", leveSuspension: false },
    { event: "MARK_COMPLIANT", libelle: "Marquer conforme", leveSuspension: false },
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
      : filtre === "Créateurs"
        ? { products: { some: {} } }
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
