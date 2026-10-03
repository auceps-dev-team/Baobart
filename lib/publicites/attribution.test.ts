import { describe, expect, it } from "vitest";

import { ajouterClic, lireClics, pubMenantA } from "@/lib/publicites/attribution";

const A = "cmg0aaaaaaaaaaaaaaaaaaaaa";
const B = "cmg0bbbbbbbbbbbbbbbbbbbbb";

describe("les clics retenus", () => {
  it("met le dernier clic en tête, sans doublon, cinq au plus", () => {
    let c = "";
    for (const id of [A, B, A]) c = ajouterClic(c, id);
    expect(lireClics(c)).toEqual([A, B]);

    const sept = Array.from({ length: 7 }, (_, i) => `cmg0${String(i).repeat(21)}`);
    c = "";
    for (const id of sept) c = ajouterClic(c, id);
    expect(lireClics(c)).toHaveLength(5);
    expect(lireClics(c)[0]).toBe(sept[6]);
  });

  it("ignore ce qui n'est pas un identifiant", () => {
    expect(lireClics(`${A}.'; DROP TABLE.${B}`)).toEqual([A, B]);
    expect(ajouterClic(A, "<script>")).toBe(A);
  });
});

describe("l'attribution d'une vente", () => {
  const pubs = [
    { id: A, linkUrl: "/products/pack-wax?utm=rentree" },
    { id: B, linkUrl: "https://ailleurs.ci/products/pack-wax" },
  ];

  it("revient à la bannière qui menait à la fiche achetée", () => {
    expect(pubMenantA("pack-wax", [B, A], pubs)).toBe(A);
  });

  it("ne revient à personne quand aucune bannière ne menait là", () => {
    // Le plugin l'aurait attribuée au dernier clic, quel qu'il soit.
    expect(pubMenantA("polices-akan", [A, B], pubs)).toBeNull();
    // Un lien extérieur ne mène jamais à une fiche de Baobart.
    expect(pubMenantA("pack-wax", [B], pubs)).toBeNull();
  });
});
