import { describe, expect, it } from "vitest";

import { adressePaginee, pageDemandee, paginer } from "./pagination";

describe("pageDemandee", () => {
  it.each([
    [undefined, 3, 1],
    ["2", 3, 2],
    ["99", 3, 3],
    ["0", 3, 1],
    ["-4", 3, 1],
    ["abc", 3, 1],
    ["2", 0, 1],
  ] as const)("« %s » sur %i pages → %i", (brut, pages, attendu) => {
    expect(pageDemandee(brut, pages)).toBe(attendu);
  });
});

describe("paginer", () => {
  const trente = Array.from({ length: 30 }, (_, i) => i + 1);

  it("découpe la page demandée", () => {
    expect(paginer(trente, "2", 7)).toEqual({ page: 2, pages: 5, total: 30, visibles: [8, 9, 10, 11, 12, 13, 14] });
  });

  it("la dernière page est incomplète, pas vide", () => {
    expect(paginer(trente, "5", 7).visibles).toEqual([29, 30]);
  });

  it("une page hors limites est ramenée sur la dernière", () => {
    expect(paginer(trente, "99", 7).page).toBe(5);
    expect(paginer(trente, "99", 7).visibles).toEqual([29, 30]);
  });

  it("une liste vide a une page, vide — pas zéro", () => {
    expect(paginer([], undefined, 7)).toEqual({ page: 1, pages: 1, total: 0, visibles: [] });
  });

  it("refuse une taille de page qui ne veut rien dire", () => {
    expect(() => paginer(trente, "1", 0)).toThrow("taille de page invalide");
    expect(() => paginer(trente, "1", 2.5)).toThrow("taille de page invalide");
  });
});

describe("adressePaginee", () => {
  it("garde les filtres, n'écrit pas page=1", () => {
    expect(adressePaginee("/dashboard/commandes", { etat: "payees", page: "3" }, 1)).toBe("/dashboard/commandes?etat=payees");
    expect(adressePaginee("/dashboard/commandes", { etat: "payees" }, 2)).toBe("/dashboard/commandes?etat=payees&page=2");
    expect(adressePaginee("/dashboard/commandes", {}, 1)).toBe("/dashboard/commandes");
  });

  it("ignore les paramètres vides", () => {
    expect(adressePaginee("/dashboard/avis", { filtre: "", q: undefined }, 2)).toBe("/dashboard/avis?page=2");
  });
});
