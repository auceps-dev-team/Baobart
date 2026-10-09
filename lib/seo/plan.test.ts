import { describe, expect, it } from "vitest";

import {
  assemblerPlan,
  CHEMINS_EXCLUS,
  consignesAuxRobots,
  PAGES_PUBLIQUES,
  ROBOTS_D_ENTRAINEMENT,
} from "@/lib/seo/plan";

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

describe("les consignes aux robots d'IA", () => {
  const regles = () => {
    const r = consignesAuxRobots().rules;
    return Array.isArray(r) ? r : [r];
  };

  it("refusent tout le site aux robots d'entraînement", () => {
    const ia = regles().find((r) => Array.isArray(r.userAgent) && r.userAgent.includes("GPTBot"));
    expect(ia?.disallow).toBe("/");
    expect(ia?.userAgent).toEqual([...ROBOTS_D_ENTRAINEMENT]);
  });

  it("laissent la règle générale intacte : les moteurs de recherche indexent toujours", () => {
    const tous = regles().find((r) => r.userAgent === "*");
    expect(tous).toMatchObject({ allow: "/" });
    expect(tous?.disallow).not.toBe("/");
  });

  it("ne nomment pas les robots de recherche des assistants", () => {
    // Choix documenté dans `plan.ts` : les bloquer retirerait Baobart des
    // réponses, sans rien protéger de plus que l'aperçu filigrané.
    for (const nom of ["OAI-SearchBot", "Claude-SearchBot", "Googlebot", "Bingbot"]) {
      expect(ROBOTS_D_ENTRAINEMENT as readonly string[]).not.toContain(nom);
    }
  });
});
