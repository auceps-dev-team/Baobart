/**
 * Rembourser une vente, quand deux demandes arrivent ensemble — VULN-02.
 *
 * Ce qu'on éprouve : l'opérateur n'est appelé qu'UNE fois, quoi qu'il arrive en
 * même temps ; une issue incertaine garde la vente réservée ; l'argent parti
 * sans écriture crie au journal. L'opérateur est une doublure — il compte ses
 * appels, attend un peu pour laisser la seconde demande arriver, et sait
 * refuser, tomber ou répondre de travers. Tout le reste est réel : la base, le
 * grand livre, la réservation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { encaisserLigne } from "@/lib/domain/orders";
import { journal } from "@/lib/observabilite/journal";
import type { Remboursement } from "@/lib/payments/encaissement/contrat";

type Comportement = "rend" | "refuse" | "incertain" | "leve";

const operateur = {
  appels: 0,
  comportement: "rend" as Comportement,
  pendant: null as null | (() => Promise<void>),
};

vi.mock("@/lib/payments/encaissement/pilotes", () => ({
  piloteCourant: () => ({
    nom: "doublure",
    async rembourser(): Promise<Remboursement> {
      operateur.appels += 1;
      await new Promise((r) => setTimeout(r, 150));
      if (operateur.pendant) await operateur.pendant();
      switch (operateur.comportement) {
        case "rend":
          return { ok: true, referenceOperateur: `rf_${operateur.appels}` };
        case "refuse":
          return { ok: false, message: "montant invalide", definitif: true };
        case "incertain":
          return { ok: false, message: "délai dépassé", definitif: false };
        case "leve":
          throw new Error("socket hang up");
      }
    },
  }),
}));

import { RESERVATION_INCERTAINE_MS, rembourserUneVente } from "@/lib/ventes/remboursement";

let n = 0;

async function venteDe(prix: number, pourboire = 0) {
  n += 1;
  const marque = `remb-${n}-${Math.random().toString(36).slice(2, 7)}`;
  const vendeur = await db.user.create({
    data: { email: `vendeur-${marque}@baobart.test`, profile: { create: { username: `v-${marque}`, displayName: "V" } } },
    select: { id: true },
  });
  const acheteur = await db.user.create({
    data: { email: `acheteur-${marque}@baobart.test`, profile: { create: { username: `a-${marque}`, displayName: "A" } } },
    select: { id: true },
  });
  const produit = await db.product.create({
    data: { sellerId: vendeur.id, name: `R ${marque}`, slug: `r-${marque}`, price: prix, currency: "XOF", status: "PUBLISHED" },
    select: { id: true },
  });
  const commande = await db.order.create({
    data: {
      buyerId: acheteur.id,
      total: prix + pourboire,
      currency: "XOF",
      provider: "paystack",
      providerRef: `tx_${marque}`,
      items: { create: { productId: produit.id, quantity: 1, price: prix, tipAmount: pourboire } },
    },
    select: { items: { select: { id: true } } },
  });
  const ligneId = commande.items[0]!.id;
  await encaisserLigne({ orderItemId: ligneId });
  return { vendeurId: vendeur.id, ligneId };
}

const demande = (ligneId: string, parId: string, montant?: number) =>
  rembourserUneVente({ orderItemId: ligneId, parId, motifInterne: "test", montant });

beforeEach(() => {
  operateur.appels = 0;
  operateur.comportement = "rend";
  operateur.pendant = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("deux demandes de remboursement en même temps", () => {
  it("n'appellent l'opérateur qu'une fois, et n'écrivent qu'un remboursement", async () => {
    const { vendeurId, ligneId } = await venteDe(5_000);

    const [a, b] = await Promise.all([demande(ligneId, vendeurId), demande(ligneId, vendeurId)]);

    expect(operateur.appels).toBe(1);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    const refus = [a, b].find((r) => !r.ok)!;
    expect(refus.message).toMatch(/déjà en cours/);

    const ligne = await db.orderItem.findUniqueOrThrow({ where: { id: ligneId } });
    expect(ligne.refundedAmount).toBe(5_000);
    expect(ligne.refundLockedUntil).toBeNull();
    expect(await db.refund.count({ where: { orderItemId: ligneId } })).toBe(1);
  });

  it("deux remboursements partiels qui se suivent passent tous les deux", async () => {
    const { vendeurId, ligneId } = await venteDe(10_000);
    expect((await demande(ligneId, vendeurId, 3_000)).ok).toBe(true);
    expect((await demande(ligneId, vendeurId, 4_000)).ok).toBe(true);
    expect(operateur.appels).toBe(2);
    expect((await db.orderItem.findUniqueOrThrow({ where: { id: ligneId } })).refundedAmount).toBe(7_000);
  });
});

describe("ce que l'opérateur répond", () => {
  it("garde sa référence sur le remboursement", async () => {
    const { vendeurId, ligneId } = await venteDe(5_000);
    await demande(ligneId, vendeurId);
    const remboursement = await db.refund.findFirstOrThrow({ where: { orderItemId: ligneId } });
    expect(remboursement.processorRef).toBe("rf_1");
  });

  it("un refus net libère la vente : on peut réessayer", async () => {
    const { vendeurId, ligneId } = await venteDe(5_000);
    operateur.comportement = "refuse";
    expect((await demande(ligneId, vendeurId)).ok).toBe(false);
    expect((await db.orderItem.findUniqueOrThrow({ where: { id: ligneId } })).refundLockedUntil).toBeNull();

    operateur.comportement = "rend";
    expect((await demande(ligneId, vendeurId)).ok).toBe(true);
  });

  it.each(["incertain", "leve"] as const)(
    "une issue incertaine (%s) garde la vente réservée un jour, et crie",
    async (comportement) => {
      const erreurs = vi.spyOn(journal, "erreur");
      const { vendeurId, ligneId } = await venteDe(5_000);
      operateur.comportement = comportement;

      const r = await demande(ligneId, vendeurId);
      expect(r.ok).toBe(false);
      expect(erreurs).toHaveBeenCalledWith("REMBOURSEMENT INCERTAIN", expect.objectContaining({ orderItemId: ligneId }));

      const ligne = await db.orderItem.findUniqueOrThrow({ where: { id: ligneId } });
      const reste = ligne.refundLockedUntil!.getTime() - Date.now();
      expect(reste).toBeGreaterThan(RESERVATION_INCERTAINE_MS - 60_000);

      // Relancer tout de suite ne rappelle pas l'opérateur.
      operateur.comportement = "rend";
      const relance = await demande(ligneId, vendeurId);
      expect(relance.ok).toBe(false);
      expect(operateur.appels).toBe(1);
      expect(await db.refund.count({ where: { orderItemId: ligneId } })).toBe(0);
    },
  );

  it("une réservation expirée se reprend", async () => {
    const { vendeurId, ligneId } = await venteDe(5_000);
    await db.orderItem.update({ where: { id: ligneId }, data: { refundLockedUntil: new Date(Date.now() - 1_000) } });
    expect((await demande(ligneId, vendeurId)).ok).toBe(true);
  });
});

describe("l'argent parti sans écriture", () => {
  it("ne se tait plus : la RangeError d'après l'opérateur est journalisée", async () => {
    const erreurs = vi.spyOn(journal, "erreur");
    const { vendeurId, ligneId } = await venteDe(5_000);
    // Pendant que l'opérateur rend l'argent, un autre chemin rembourse tout
    // (un rattrapage à la main) : l'écriture qui suit dépasse l'encaissé.
    operateur.pendant = async () => {
      await db.orderItem.update({ where: { id: ligneId }, data: { refundedAmount: 5_000 } });
    };

    const r = await demande(ligneId, vendeurId);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/support est prévenu/);
    expect(erreurs).toHaveBeenCalledWith("ARGENT REMBOURSÉ SANS ÉCRITURE", expect.objectContaining({ orderItemId: ligneId }));
    expect((await db.orderItem.findUniqueOrThrow({ where: { id: ligneId } })).refundLockedUntil).toBeNull();
  });
});

describe("une vente avec pourboire", () => {
  it("rend le prix et le pourboire quand aucun montant n'est précisé", async () => {
    const { vendeurId, ligneId } = await venteDe(5_000, 1_000);

    const r = await demande(ligneId, vendeurId);
    expect(r).toMatchObject({ ok: true, montant: 6_000 });

    const ligne = await db.orderItem.findUniqueOrThrow({ where: { id: ligneId } });
    expect(ligne.refundedAmount).toBe(6_000);
  });

  it("permet de rendre le pourboire restant après un remboursement partiel du prix seul", async () => {
    const { vendeurId, ligneId } = await venteDe(5_000, 1_000);

    expect(await demande(ligneId, vendeurId, 5_000)).toMatchObject({ ok: true, montant: 5_000 });
    expect(await demande(ligneId, vendeurId)).toMatchObject({ ok: true, montant: 1_000 });

    const ligne = await db.orderItem.findUniqueOrThrow({ where: { id: ligneId } });
    expect(ligne.refundedAmount).toBe(6_000);
  });
});
