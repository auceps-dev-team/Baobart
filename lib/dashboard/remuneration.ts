import "server-only";

import type { Currency } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * « Commissions » de `Baobart Dashboard.dc.html` : ce que chaque ressource a
 * rapporté, et où en est l'argent.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE MOT « COMMISSION » A DEUX SENS ICI
 *
 * Dans la maquette, c'est la rémunération du créateur sur ses ventes. Dans le
 * schéma, `Commission` est une commande sur mesure (acompte, brief, solde),
 * dont l'interface n'existe pas encore. L'écran suit la maquette ; les
 * commandes sur mesure, s'il y en a, restent listées en dessous.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUI EST COMPTÉ
 *
 * Le grand livre (`BalanceTransaction.holdingNet`), dans la devise du compte,
 * versements exclus : ventes et pourboires en plus, remboursements et
 * contestations en moins. « Versée » veut dire que le solde qui la porte est
 * parti (`PAID`) ; « impayée », qu'il attend (`UNPAID`, `PROCESSING`) ;
 * « révoquée », ce que les remboursements et contestations ont repris.
 */

export interface LigneRemuneration {
  produitId: string;
  nom: string;
  couverture: string | null;
  ventes: number;
  net: number;
  impaye: number;
}

export interface Remuneration {
  devise: Currency;
  impayee: number;
  versee: number;
  revoquee: number;
  remboursements: number;
  ventesImpayees: number;
  parRessource: LigneRemuneration[];
}

const REPRISES = new Set(["REFUND", "CHARGEBACK"]);

export async function remunerationDe(userId: string, depuis?: Date): Promise<Remuneration> {
  const compte = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { defaultCurrency: true } });
  const devise = compte.defaultCurrency;

  const mouvements = await db.balanceTransaction.findMany({
    where: { userId, type: { not: "PAYOUT" }, holdingCurrency: devise, ...(depuis ? { occurredAt: { gte: depuis } } : {}) },
    select: { type: true, holdingNet: true, orderItemId: true, balance: { select: { state: true } } },
  });

  const lignesIds = [...new Set(mouvements.map((m) => m.orderItemId).filter((id): id is string => id !== null))];
  const lignes = await db.orderItem.findMany({
    where: { id: { in: lignesIds } },
    select: { id: true, product: { select: { id: true, name: true, coverUrl: true } } },
  });
  const produitDe = new Map(lignes.map((l) => [l.id, l.product]));

  const parProduit = new Map<string, LigneRemuneration>();
  let impayee = 0;
  let versee = 0;
  let revoquee = 0;
  let remboursements = 0;
  let ventesImpayees = 0;

  for (const m of mouvements) {
    const paye = m.balance.state === "PAID";
    if (REPRISES.has(m.type)) {
      revoquee += -m.holdingNet;
      remboursements += 1;
    } else if (paye) versee += m.holdingNet;
    else {
      impayee += m.holdingNet;
      if (m.type === "SALE") ventesImpayees += 1;
    }

    const produit = m.orderItemId ? produitDe.get(m.orderItemId) : undefined;
    if (!produit) continue;
    const ligne = parProduit.get(produit.id) ?? { produitId: produit.id, nom: produit.name, couverture: produit.coverUrl, ventes: 0, net: 0, impaye: 0 };
    ligne.net += m.holdingNet;
    if (m.type === "SALE") ligne.ventes += 1;
    if (!paye && !REPRISES.has(m.type)) ligne.impaye += m.holdingNet;
    parProduit.set(produit.id, ligne);
  }

  return {
    devise,
    // Les remboursements tombent dans des soldes non versés : la part impayée
    // en est déjà diminuée côté grand livre, pas ici. On la montre brute, et la
    // reprise à part — c'est ce que la maquette sépare en deux cartes.
    impayee,
    versee,
    revoquee,
    remboursements,
    ventesImpayees,
    parRessource: [...parProduit.values()].sort((a, b) => b.net - a.net),
  };
}
