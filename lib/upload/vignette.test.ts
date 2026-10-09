import { describe, expect, it } from "vitest";

import {
  anciennesClesDApercu,
  cleDApercu,
  cleDeVignette,
  mediaDUneClePerimee,
  toutesLesClesDApercu,
  VERSION_APERCU,
  vignetteDe,
} from "@/lib/upload/vignette";

describe("les clés des aperçus", () => {
  it("portent la version de la recette", () => {
    expect(VERSION_APERCU).toBe(3);
    expect(cleDApercu("m1")).toBe("public/apercus/m1-v3.webp");
    expect(cleDeVignette("m1")).toBe("public/apercus/m1-v3-400.webp");
  });

  it("connaissent les clés des recettes précédentes, pour les supprimer", () => {
    expect(anciennesClesDApercu("m1")).toEqual(["public/apercus/m1.webp", "public/apercus/m1-v2.webp"]);
    expect(toutesLesClesDApercu("m1")).toHaveLength(4);
  });
});

describe("une clé périmée", () => {
  it.each([
    ["public/apercus/abc.webp", "abc"],
    ["public/apercus/abc-v2.webp", "abc"],
    ["public/apercus/abc-v2-400.webp", "abc"],
    ["public/apercus/abc-v3.webp", null],
    ["public/apercus/abc-v3-400.webp", null],
    ["public/extraits/p1/a.webp", null],
    ["public/apercus/sous/dossier.webp", null],
  ])("%s → %s", (cle, attendu) => {
    expect(mediaDUneClePerimee(cle)).toBe(attendu);
  });
});

describe("la vignette du fil", () => {
  it("se déduit de l'aperçu de la recette courante", () => {
    expect(vignetteDe("https://cdn.baobart.test/public/apercus/m1-v3.webp")).toBe(
      "https://cdn.baobart.test/public/apercus/m1-v3-400.webp",
    );
  });

  it.each([
    // Un aperçu de v1.86.0 n'a pas de vignette : en déduire une pointerait le
    // fil vers une image absente.
    "https://cdn.baobart.test/public/apercus/m1-v2.webp",
    "https://cdn.baobart.test/public/apercus/m1.webp",
    // Catalogue de démonstration, image externe : servis tels quels.
    "https://cdn.baobart.test/demo/portrait.jpg",
    "/img/demo/neon-02.png",
  ])("garde telle quelle une adresse hors convention : %s", (url) => {
    expect(vignetteDe(url)).toBe(url);
  });
});
