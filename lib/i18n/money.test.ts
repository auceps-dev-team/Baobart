import { describe, expect, it } from "vitest";

import {
  formatCount,
  formatMoney,
  formatPrice,
  fromMinorUnits,
  toMinorUnits,
} from "./money";

const NBSP = " ";

describe("formatMoney", () => {
  it("formate le FCFA sans décimale, comme la maquette", () => {
    expect(formatMoney(180_000, "XOF")).toBe(`180${NBSP}000${NBSP}F`);
    expect(formatMoney(5_000, "XOF")).toBe(`5${NBSP}000${NBSP}F`);
    expect(formatMoney(0, "XOF")).toBe(`0${NBSP}F`);
  });

  it("place le symbole avant pour les devises qui l'exigent", () => {
    expect(formatMoney(45_000_00, "NGN")).toBe(`₦${NBSP}45${NBSP}000,00`);
    expect(formatMoney(120_00, "GHS")).toBe(`GH₵${NBSP}120,00`);
    expect(formatMoney(5_000_00, "KES")).toBe(`KSh${NBSP}5${NBSP}000,00`);
  });

  it("formate l'euro avec deux décimales et le symbole après", () => {
    expect(formatMoney(1250, "EUR")).toBe(`12,50${NBSP}€`);
  });

  it("prend le XOF par défaut", () => {
    expect(formatMoney(7500)).toBe(`7${NBSP}500${NBSP}F`);
  });
});

describe("formatPrice", () => {
  it("affiche GRATUIT à zéro (étiquette du design system)", () => {
    expect(formatPrice(0, "XOF")).toBe("GRATUIT");
  });

  it("affiche le montant sinon", () => {
    expect(formatPrice(10_000, "XOF")).toBe(`10${NBSP}000${NBSP}F`);
  });
});

describe("conversions", () => {
  it("ne perd rien sur un aller-retour en FCFA", () => {
    expect(toMinorUnits(180_000, "XOF")).toBe(180_000);
    expect(fromMinorUnits(180_000, "XOF")).toBe(180_000);
  });

  it("gère les centimes sans erreur de virgule flottante", () => {
    expect(toMinorUnits(12.5, "EUR")).toBe(1250);
    expect(toMinorUnits(0.1 + 0.2, "EUR")).toBe(30);
  });
});

describe("formatCount", () => {
  it("formate les compteurs de la maquette", () => {
    expect(formatCount(340)).toBe("340");
    expect(formatCount(2_340)).toBe(`2,3${NBSP}k`);
    expect(formatCount(1_200_000)).toBe(`1,2${NBSP}M`);
  });
});
