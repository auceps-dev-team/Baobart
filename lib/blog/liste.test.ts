import { describe, expect, it } from "vitest";

import { blogVide } from "./liste";

describe("blogVide (Q-33)", () => {
  it("un seul article, à la une, rien dessous : le blog n'est PAS vide", () => {
    // Le cas de la recette : la carte « Rien pour l'instant » s'affichait ici.
    expect(blogVide({ suite: 0, rubrique: false, une: true })).toBe(false);
  });

  it("aucun article du tout : vide", () => {
    expect(blogVide({ suite: 0, rubrique: false, une: false })).toBe(true);
  });

  it("une rubrique sans article : vide, même s'il existe une une ailleurs", () => {
    expect(blogVide({ suite: 0, rubrique: true, une: true })).toBe(true);
  });

  it("des articles sous la une : jamais vide", () => {
    expect(blogVide({ suite: 3, rubrique: false, une: true })).toBe(false);
    expect(blogVide({ suite: 1, rubrique: true, une: false })).toBe(false);
  });
});
