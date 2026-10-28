/**
 * Les chiffres du tableau de bord, contre un grand livre fabriqué : ce qui
 * compte comme gagné, ce qui n'en est pas, et le mois où il tombe.
 */

import { describe, expect, it } from "vitest";

import { indicateursCreateur } from "@/lib/dashboard/indicateurs";
import { db } from "@/lib/db";

let n = 0;
const LE_27_OCTOBRE = new Date("2026-10-27T15:00:00Z");

async function createur(vues = 0) {
  n += 1;
  const s = `${n}-${Math.random().toString(36).slice(2, 7)}`;
  return db.user.create({
    data: {
      email: `indicateurs-${s}@baobart.test`,
      defaultCurrency: "XOF",
      profile: { create: { username: `indicateurs-${s}`, displayName: `Indicateurs ${s}`, viewCount: vues } },
    },
    select: { id: true },
  });
}

async function ecriture(
  userId: string,
  type: "SALE" | "REFUND" | "PAYOUT" | "TIP",
  montant: number,
  quand: string,
  devise: "XOF" | "EUR" = "XOF",
) {
  const solde = await db.balance.create({ data: { userId, date: new Date(quand), currency: devise, holdingCurrency: devise } });
  await db.balanceTransaction.create({
    data: {
      userId,
      balanceId: solde.id,
      type,
      occurredAt: new Date(quand),
      issuedCurrency: devise,
      issuedGross: montant,
      issuedNet: montant,
      holdingCurrency: devise,
      holdingGross: montant,
      holdingNet: montant,
    },
  });
}

describe("les chiffres du tableau de bord", () => {
  it("compte ventes et pourboires, déduit les remboursements, ignore les versements", async () => {
    const c = await createur();
    await ecriture(c.id, "SALE", 3000, "2026-10-05T10:00:00Z");
    await ecriture(c.id, "TIP", 500, "2026-10-06T10:00:00Z");
    await ecriture(c.id, "REFUND", -1000, "2026-10-07T10:00:00Z");
    // Un versement n'est pas un gain : c'est le gain qui sort.
    await ecriture(c.id, "PAYOUT", -2500, "2026-10-08T10:00:00Z");

    const i = await indicateursCreateur(c.id, LE_27_OCTOBRE);
    expect(i.gainsMois).toBe(2500);
  });

  it("range chaque mouvement dans son mois, y compris le dernier instant", async () => {
    const c = await createur();
    await ecriture(c.id, "SALE", 2000, "2026-09-30T23:59:59Z");
    await ecriture(c.id, "SALE", 4000, "2026-10-01T00:00:00Z");
    await ecriture(c.id, "SALE", 700, "2026-05-02T00:00:00Z");
    // Hors de la fenêtre de six mois : n'apparaît nulle part.
    await ecriture(c.id, "SALE", 9999, "2026-04-30T12:00:00Z");

    const i = await indicateursCreateur(c.id, LE_27_OCTOBRE);
    expect(i.revenus.map((b) => [b.cle, b.montant])).toEqual([
      ["2026-05", 700],
      ["2026-06", 0],
      ["2026-07", 0],
      ["2026-08", 0],
      ["2026-09", 2000],
      ["2026-10", 4000],
    ]);
    expect(i.gainsMoisPrecedent).toBe(2000);
  });

  it("n'additionne pas une autre devise à la devise du compte", async () => {
    const c = await createur();
    await ecriture(c.id, "SALE", 3000, "2026-10-05T10:00:00Z");
    await ecriture(c.id, "SALE", 50, "2026-10-05T11:00:00Z", "EUR");

    expect((await indicateursCreateur(c.id, LE_27_OCTOBRE)).gainsMois).toBe(3000);
  });

  it("ne calcule pas de conversion sans aucune vue", async () => {
    expect((await indicateursCreateur((await createur(0)).id, LE_27_OCTOBRE)).conversion).toBeNull();
    const vu = await indicateursCreateur((await createur(250)).id, LE_27_OCTOBRE);
    expect(vu.vues).toBe(250);
    expect(vu.conversion).toBe(0);
  });
});
