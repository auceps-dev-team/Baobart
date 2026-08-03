import { describe, expect, it } from "vitest";

import { navigationPour } from "./nav";

const entrees = (etape: Parameters<typeof navigationPour>[0]) =>
  navigationPour(etape).flatMap((g) => g.entrees);

const trouver = (etape: Parameters<typeof navigationPour>[0], cle: string) =>
  entrees(etape).find((e) => e.cle === cle);

describe("palier acheteur", () => {
  it("ne montre qu'une seule porte vers la vente", () => {
    const createurs = entrees("ACHETEUR").filter((e) => e.cle.startsWith("c_"));

    expect(createurs).toHaveLength(1);
    expect(createurs[0]).toMatchObject({ label: "Devenir vendeur", actif: true });
  });

  it("garde toutes les entrées acheteur ouvertes", () => {
    const acheteur = entrees("ACHETEUR").filter((e) => !e.cle.startsWith("c_"));

    expect(acheteur.length).toBeGreaterThan(5);
    expect(acheteur.every((e) => e.actif)).toBe(true);
  });

  it("n'affiche aucune entrée grisée — il n'y a rien à promettre encore", () => {
    expect(entrees("ACHETEUR").every((e) => e.actif)).toBe(true);
  });
});

describe("palier atelier", () => {
  it("fait apparaître les entrées créateur", () => {
    const createurs = entrees("ATELIER").filter((e) => e.cle.startsWith("c_"));
    expect(createurs.length).toBeGreaterThan(5);
  });

  it("laisse atteignable ce qui sert à travailler le brouillon", () => {
    // Sans ça, le produit qu'on vient de créer serait inaccessible.
    for (const cle of ["c_apercu", "c_produits", "c_publier"]) {
      expect(trouver("ATELIER", cle)?.actif, cle).toBe(true);
    }
  });

  it("grise ce qui n'a pas encore de sens", () => {
    for (const cle of ["c_revenus", "c_ventes", "c_stats", "c_profil"]) {
      expect(trouver("ATELIER", cle)?.actif, cle).toBe(false);
    }
  });

  it("dit ce qui débloquera chaque entrée grisée", () => {
    const verrouillees = entrees("ATELIER").filter((e) => !e.actif);

    expect(verrouillees.length).toBeGreaterThan(0);
    expect(verrouillees.every((e) => (e.raisonVerrou ?? "").length > 10)).toBe(
      true,
    );
  });

  it("n'affiche jamais de raison sur une entrée ouverte", () => {
    expect(
      entrees("ATELIER")
        .filter((e) => e.actif)
        .every((e) => e.raisonVerrou === null),
    ).toBe(true);
  });
});

describe("palier boutique", () => {
  it("ouvre tout", () => {
    expect(entrees("BOUTIQUE").every((e) => e.actif)).toBe(true);
  });

  it("expose le profil de la boutique, verrouillé au palier précédent", () => {
    expect(trouver("ATELIER", "c_profil")?.actif).toBe(false);
    expect(trouver("BOUTIQUE", "c_profil")?.actif).toBe(true);
  });
});

describe("continuité entre les paliers", () => {
  it("les entrées acheteur ne disparaissent jamais", () => {
    const cles = (etape: Parameters<typeof navigationPour>[0]) =>
      entrees(etape)
        .filter((e) => !e.cle.startsWith("c_"))
        .map((e) => e.cle);

    expect(cles("ATELIER")).toEqual(cles("ACHETEUR"));
    expect(cles("BOUTIQUE")).toEqual(cles("ACHETEUR"));
  });

  it("aucune clé n'apparaît deux fois", () => {
    for (const etape of ["ACHETEUR", "ATELIER", "BOUTIQUE"] as const) {
      const cles = entrees(etape).map((e) => e.cle);
      expect(new Set(cles).size, etape).toBe(cles.length);
    }
  });
});
