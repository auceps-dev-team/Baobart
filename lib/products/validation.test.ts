import { describe, expect, it } from "vitest";

import {
  MOTS_CLES_MAX,
  PRIX_MAX,
  decouperMotsCles,
  prixRetenu,
  slugifier,
} from "./validation";

describe("mots-clés", () => {
  it("découpe sur les virgules et taille les espaces", () => {
    expect(decouperMotsCles("wax, portrait ,  motif")).toEqual([
      "wax",
      "portrait",
      "motif",
    ]);
  });

  it("ignore les entrées vides", () => {
    expect(decouperMotsCles("wax,,  , portrait")).toEqual(["wax", "portrait"]);
    expect(decouperMotsCles("")).toEqual([]);
    expect(decouperMotsCles("  ,  ")).toEqual([]);
  });

  it("dédoublonne sans tenir compte de la casse ni des accents", () => {
    // « Wax » et « wax » désignent la même chose ; en garder deux fausserait
    // les compteurs de mots-clés.
    expect(decouperMotsCles("wax, Wax, WAX")).toEqual(["wax"]);
    expect(decouperMotsCles("Icône, icone")).toEqual(["Icône"]);
  });

  it("garde la casse d'origine du premier vu", () => {
    expect(decouperMotsCles("Portrait, portrait")).toEqual(["Portrait"]);
  });

  it("accepte aussi les retours à la ligne", () => {
    expect(decouperMotsCles("wax\nportrait")).toEqual(["wax", "portrait"]);
  });

  it("plafonne : au-delà, les mots-clés ne classent plus rien", () => {
    const beaucoup = Array.from({ length: 30 }, (_, i) => `mot${i}`).join(",");
    expect(decouperMotsCles(beaucoup)).toHaveLength(MOTS_CLES_MAX);
  });
});

describe("prix", () => {
  it("retient le prix saisi", () => {
    expect(prixRetenu("5000", false)).toEqual({ prix: 5_000 });
  });

  it("accepte les espaces de milliers, comme on les tape", () => {
    expect(prixRetenu("5 000", false)).toEqual({ prix: 5_000 });
    expect(prixRetenu("180 000", false)).toEqual({ prix: 180_000 });
  });

  it("« Gratuit » l'emporte sur le prix saisi", () => {
    // Deux commandes pour une seule valeur : c'est la case qui décide, sinon
    // on publierait un prix que la personne croyait avoir annulé.
    expect(prixRetenu("5000", true)).toEqual({ prix: 0 });
  });

  it("refuse un prix vide sans case cochée", () => {
    expect(prixRetenu("", false)).toMatchObject({
      erreur: expect.stringContaining("Gratuit"),
    });
    expect(prixRetenu("0", false)).toMatchObject({
      erreur: expect.stringContaining("Gratuit"),
    });
  });

  it("refuse un montant absurde", () => {
    expect(prixRetenu(String(PRIX_MAX + 1), false)).toMatchObject({
      erreur: expect.any(String),
    });
  });

  it("accepte la borne haute", () => {
    expect(prixRetenu(String(PRIX_MAX), false)).toEqual({ prix: PRIX_MAX });
  });

  it("ignore le texte parasite plutôt que d'échouer", () => {
    expect(prixRetenu("5 000 FCFA", false)).toEqual({ prix: 5_000 });
  });
});

describe("slug", () => {
  it("translittère les accents et remplace le reste par des tirets", () => {
    expect(slugifier("Illu Femme au Foulard")).toBe("illu-femme-au-foulard");
    expect(slugifier("Icônes transport Abidjan")).toBe(
      "icones-transport-abidjan",
    );
  });

  it("ne laisse ni tiret en tête ni en queue", () => {
    expect(slugifier("  — Wax & Motifs —  ")).toBe("wax-motifs");
  });

  it("borne la longueur", () => {
    expect(slugifier("a".repeat(200)).length).toBeLessThanOrEqual(60);
  });

  it("rend une chaîne vide sur une saisie sans lettre", () => {
    expect(slugifier("!!! ???")).toBe("");
  });
});
