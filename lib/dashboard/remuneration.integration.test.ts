/**
 * « Commissions » : ce qui est versé, ce qui attend, ce que les remboursements
 * ont repris — contre un grand livre fabriqué.
 */

import { describe, expect, it } from "vitest";

import { remunerationDe } from "@/lib/dashboard/remuneration";
import { db } from "@/lib/db";

let n = 0;

async function vendeur() {
  n += 1;
  const s = `${n}-${Math.random().toString(36).slice(2, 7)}`;
  const u = await db.user.create({ data: { email: `remuneration-${s}@baobart.test`, defaultCurrency: "XOF" }, select: { id: true } });
  const acheteur = await db.user.create({ data: { email: `remuneration-acheteur-${s}@baobart.test` }, select: { id: true } });
  const produit = await db.product.create({ data: { sellerId: u.id, name: `Pack ${s}`, slug: `pack-remuneration-${s}`, price: 3000, currency: "XOF", status: "PUBLISHED" }, select: { id: true } });
  const commande = await db.order.create({ data: { buyerId: acheteur.id, total: 3000, currency: "XOF", status: "COMPLETED" }, select: { id: true } });
  const ligne = await db.orderItem.create({ data: { orderId: commande.id, productId: produit.id, price: 3000, quantity: 1, state: "SUCCESSFUL" }, select: { id: true } });
  return { id: u.id, produitId: produit.id, ligneId: ligne.id };
}

// Un solde par jour et par devise (contrainte unique du schéma) : chaque
// mouvement du test reçoit son propre jour, dans le passé.
let jour = 0;

async function mouvement(userId: string, type: "SALE" | "REFUND" | "PAYOUT", net: number, etat: "UNPAID" | "PROCESSING" | "PAID", orderItemId: string | null) {
  jour += 1;
  const solde = await db.balance.create({ data: { userId, date: new Date(Date.UTC(2026, 0, jour)), state: etat }, select: { id: true } });
  await db.balanceTransaction.create({
    data: { userId, balanceId: solde.id, type, issuedCurrency: "XOF", issuedGross: net, issuedNet: net, holdingCurrency: "XOF", holdingGross: net, holdingNet: net, orderItemId },
  });
}

describe("la rémunération par ressource", () => {
  it("sépare le versé, l'impayé et le repris, et ignore les versements", async () => {
    const v = await vendeur();
    await mouvement(v.id, "SALE", 2655, "PAID", v.ligneId);
    await mouvement(v.id, "SALE", 2655, "PROCESSING", v.ligneId);
    await mouvement(v.id, "REFUND", -3000, "UNPAID", v.ligneId);
    await mouvement(v.id, "PAYOUT", -2655, "PAID", null);

    const r = await remunerationDe(v.id);
    expect(r.versee).toBe(2655);
    expect(r.impayee).toBe(2655);
    expect(r.revoquee).toBe(3000);
    expect(r.remboursements).toBe(1);
    expect(r.ventesImpayees).toBe(1);
    // Par ressource : 2 655 + 2 655 − 3 000, le versement n'y compte pas.
    expect(r.parRessource).toEqual([expect.objectContaining({ produitId: v.produitId, ventes: 2, net: 2310, impaye: 2655 })]);
  });

  it("ne compte rien avant la période demandée", async () => {
    const v = await vendeur();
    await mouvement(v.id, "SALE", 2655, "UNPAID", v.ligneId);
    expect((await remunerationDe(v.id, new Date(Date.now() + 60_000))).parRessource).toEqual([]);
  });
});
