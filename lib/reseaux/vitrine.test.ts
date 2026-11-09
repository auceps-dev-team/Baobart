import { describe, expect, it } from "vitest";

import { liensAffichables, portfolioAffichable } from "./vitrine";

/**
 * La règle d'affichage du portfolio et des réseaux, partagée par la vitrine
 * et par « Devenir vendeur » depuis le 09/11/2026 (relecture d'Argon).
 */
describe("ce que la vitrine accepte d'afficher", () => {
  it("n'affiche le portfolio qu'en https", () => {
    expect(portfolioAffichable("https://awadiallo.com")).toBe("https://awadiallo.com");
    // Les données de démonstration : sans protocole, la vitrine l'écarte.
    expect(portfolioAffichable("awadiallo.com")).toBeNull();
    expect(portfolioAffichable("http://awadiallo.com")).toBeNull();
    expect(portfolioAffichable(null)).toBeNull();
    expect(portfolioAffichable(undefined)).toBeNull();
  });

  it("garde un réseau qui mène bien sur son domaine, et écarte les autres", () => {
    const liens = liensAffichables([
      { network: "INSTAGRAM", url: "https://www.instagram.com/awa.diallo/" },
      { network: "BEHANCE", url: "https://exemple.test/awa" },
    ]);
    expect(liens.map((l) => l.reseau)).toEqual(["instagram"]);
    expect(liens[0]!.url).toContain("instagram.com");
  });

  it("ne rend rien sans ligne", () => {
    expect(liensAffichables([])).toEqual([]);
  });
});
