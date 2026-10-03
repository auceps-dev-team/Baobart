import { describe, expect, it } from "vitest";

import { intercaler, placerLesPublicites } from "@/lib/publicites/placement";

const rangs = (m: Map<number, string>) => [...m.keys()];

describe("le placement des bannières", () => {
  it("place une pub tous les N produits", () => {
    const m = placerLesPublicites(30, [{ id: "a", frequence: 10 }], 1);
    expect([...m.entries()]).toEqual([[10, "a"], [20, "a"], [30, "a"]]);
  });

  it("fait alterner deux pubs qui tombent au même rang", () => {
    // Le plugin prenait toujours la première : « b » ne paraissait jamais.
    const m = placerLesPublicites(40, [{ id: "a", frequence: 10 }, { id: "b", frequence: 10 }], 1);
    expect([...m.values()]).toEqual(["a", "b", "a", "b"]);
  });

  it("n'en colle jamais deux à moins de l'écart minimal", () => {
    const m = placerLesPublicites(30, [{ id: "a", frequence: 3 }, { id: "b", frequence: 4 }], 5);
    const r = rangs(m);
    for (let i = 1; i < r.length; i += 1) expect(r[i]! - r[i - 1]!).toBeGreaterThanOrEqual(5);
  });

  it("ne place rien sans pub valide", () => {
    expect(placerLesPublicites(50, [], 3).size).toBe(0);
    expect(placerLesPublicites(50, [{ id: "a", frequence: 0 }], 3).size).toBe(0);
  });

  it("ne déplace aucune bannière quand on charge plus de produits", () => {
    const pubs = [{ id: "a", frequence: 6 }, { id: "b", frequence: 9 }];
    const avant = placerLesPublicites(50, pubs, 4);
    const apres = placerLesPublicites(100, pubs, 4);
    for (const [rang, id] of avant) expect(apres.get(rang)).toBe(id);
  });
});

describe("l'intercalage", () => {
  it("met la bannière juste après le produit de son rang", () => {
    const cases = intercaler(["p1", "p2", "p3", "p4"], [{ id: "a", frequence: 2 }], 1);
    expect(cases.map((c) => (c.nature === "produit" ? c.produit : `pub:${c.pub.id}`))).toEqual([
      "p1", "p2", "pub:a", "p3", "p4", "pub:a",
    ]);
  });
});
