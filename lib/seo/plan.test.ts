import { describe, expect, it } from "vitest";

import { assemblerPlan, CHEMINS_EXCLUS, PAGES_PUBLIQUES } from "@/lib/seo/plan";

const VIDE = { ressources: [], articles: [], createurs: [] };

describe("le plan du site", () => {
  it("donne des adresses absolues, sans barre finale sur l'accueil", () => {
    const plan = assemblerPlan("https://baobart.test", VIDE);
    expect(plan[0]!.url).toBe("https://baobart.test");
    expect(plan.every((e) => e.url.startsWith("https://baobart.test"))).toBe(true);
    expect(plan).toHaveLength(PAGES_PUBLIQUES.length);
  });

  it("désigne chaque contenu par l'adresse de sa page publique", () => {
    const quand = new Date("2026-10-08T00:00:00Z");
    const plan = assemblerPlan("https://baobart.test", {
      ressources: [{ slug: "pack-wax", updatedAt: quand }],
      articles: [{ slug: "premier-article", updatedAt: quand }],
      createurs: [{ username: "awa-diallo", updatedAt: quand }],
    });
    const urls = plan.map((e) => e.url);
    expect(urls).toContain("https://baobart.test/products/pack-wax");
    expect(urls).toContain("https://baobart.test/blog/premier-article");
    expect(urls).toContain("https://baobart.test/createurs/awa-diallo");
  });

  it("échappe un identifiant qui casserait l'adresse", () => {
    const plan = assemblerPlan("https://baobart.test", {
      ...VIDE,
      ressources: [{ slug: "a b?c", updatedAt: new Date() }],
    });
    expect(plan.at(-1)!.url).toBe("https://baobart.test/products/a%20b%3Fc");
  });

  it("ne liste aucune page que les robots ont consigne d'éviter", () => {
    // Un plan qui recommande ce que robots.txt interdit est contradictoire :
    // les moteurs le signalent comme une erreur de configuration.
    for (const page of PAGES_PUBLIQUES) {
      for (const exclu of CHEMINS_EXCLUS) {
        const prefixe = exclu.split("*")[0]!;
        expect(page === prefixe || page.startsWith(prefixe)).toBe(false);
      }
    }
  });
});
