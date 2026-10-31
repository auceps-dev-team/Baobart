import { describe, expect, it } from "vitest";

import { licenceCommerciale, ordreBibliotheque, poidsLisible, resteAToi } from "./bibliotheque-regles";

const achat = (p: Partial<Parameters<typeof resteAToi>[0]> = {}) => ({
  price: 5_000,
  quantity: 1,
  tipAmount: 0,
  refundedAmount: 0,
  chargebackAt: null,
  chargebackReversedAt: null,
  accessRevokedAt: null,
  ...p,
});

describe("une ressource achetée reste-t-elle à toi ?", () => {
  it("oui, après un achat ordinaire", () => {
    expect(resteAToi(achat())).toBe(true);
  });

  it("oui, après un remboursement partiel", () => {
    expect(resteAToi(achat({ refundedAmount: 2_000 }))).toBe(true);
  });

  it("non, après un remboursement intégral", () => {
    expect(resteAToi(achat({ refundedAmount: 5_000 }))).toBe(false);
  });

  it("oui, quand seul le prix est rendu et que le pourboire reste dû", () => {
    // La règle de `encaisseDe` (PR #27) : intégral veut dire prix ET pourboire.
    expect(resteAToi(achat({ tipAmount: 1_000, refundedAmount: 5_000 }))).toBe(true);
    expect(resteAToi(achat({ tipAmount: 1_000, refundedAmount: 6_000 }))).toBe(false);
  });

  it("non, pendant une contestation ; oui, une fois tranchée pour le vendeur", () => {
    const le = new Date("2026-10-01");
    expect(resteAToi(achat({ chargebackAt: le }))).toBe(false);
    expect(resteAToi(achat({ chargebackAt: le, chargebackReversedAt: le }))).toBe(true);
  });

  it("non, quand le vendeur a retiré l'accès", () => {
    expect(resteAToi(achat({ accessRevokedAt: new Date() }))).toBe(false);
  });

  it("oui, pour une ressource obtenue à 0 F", () => {
    expect(resteAToi(achat({ price: 0 }))).toBe(true);
  });
});

describe("l'ordre de la bibliothèque", () => {
  const jamais = (jour: number) => ({ acheteLe: new Date(2026, 9, jour), dernierRetrait: null });
  const retire = (jour: number) => ({ acheteLe: new Date(2026, 8, 1), dernierRetrait: new Date(2026, 9, jour) });

  it("met ce qui n'a jamais été retiré en premier, le plus récent d'abord", () => {
    const liste = [retire(20), jamais(5), retire(25), jamais(12)].sort(ordreBibliotheque);
    expect(liste).toEqual([jamais(12), jamais(5), retire(25), retire(20)]);
  });
});

describe("le poids lisible", () => {
  it("parle en Ko, Mo ou Go, et se tait quand il ne sait pas", () => {
    expect(poidsLisible(null)).toBeNull();
    expect(poidsLisible(0)).toBeNull();
    expect(poidsLisible(800 * 1024)).toBe("800 Ko");
    expect(poidsLisible(42 * 1024 * 1024)).toBe("42 Mo");
    expect(poidsLisible(1.25 * 1024 * 1024 * 1024)).toMatch(/^1,[23] Go$/);
  });
});

describe("la licence commerciale", () => {
  it("vaut pour la commerciale, l'étendue et la licence par défaut, pas pour la personnelle", () => {
    expect(licenceCommerciale("COMMERCIAL")).toBe(true);
    expect(licenceCommerciale("EXTENDED")).toBe(true);
    expect(licenceCommerciale(null)).toBe(true);
    expect(licenceCommerciale("PERSONAL")).toBe(false);
  });
});
