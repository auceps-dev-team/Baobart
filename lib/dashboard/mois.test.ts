import { describe, expect, it } from "vitest";

import { cleDuMois, debutDuMois, nomDuMoisPrecedent, serieMensuelle, variation } from "./mois";

const LE_27_OCTOBRE = new Date("2026-10-27T15:00:00Z");

describe("les mois du tableau de bord", () => {
  it("donne les six derniers mois, du plus ancien au courant", () => {
    expect(serieMensuelle([], LE_27_OCTOBRE).map((b) => b.cle)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
  });

  it("garde un mois sans vente, à zéro, au lieu de le sauter", () => {
    const serie = serieMensuelle([{ mois: "2026-07", montant: 4000 }, { mois: "2026-10", montant: 1500 }], LE_27_OCTOBRE);
    expect(serie.map((b) => b.montant)).toEqual([0, 0, 4000, 0, 0, 1500]);
    expect(serie[5]!.libelle).toBe("oct.");
  });

  it("ignore ce qui sort de la fenêtre", () => {
    expect(serieMensuelle([{ mois: "2026-01", montant: 9 }], LE_27_OCTOBRE).every((b) => b.montant === 0)).toBe(true);
  });

  it("passe l'année sans se perdre", () => {
    const janvier = new Date("2027-01-03T00:00:00Z");
    expect(serieMensuelle([], janvier, 3).map((b) => b.cle)).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(nomDuMoisPrecedent(janvier)).toBe("déc.");
    expect(cleDuMois(debutDuMois(janvier, -1))).toBe("2026-12");
  });

  it("chiffre la variation, sauf depuis zéro", () => {
    expect(variation(122, 100)).toBe(22);
    expect(variation(50, 100)).toBe(-50);
    expect(variation(500, 0)).toBeNull();
    // Un mois précédent négatif (plus de remboursements que de ventes) : le sens reste lisible.
    expect(variation(100, -100)).toBe(200);
  });
});
