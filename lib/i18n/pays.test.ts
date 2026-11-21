import { describe, expect, it } from "vitest";

import { CODES_PAYS, nomDuPays, paysTries } from "./pays";

describe("les pays d'un profil (Q-32)", () => {
  it("54 pays d'Afrique, plus la diaspora, sans doublon, tous en ISO alpha-2", () => {
    expect(new Set(CODES_PAYS).size).toBe(CODES_PAYS.length);
    for (const c of CODES_PAYS) expect(c).toMatch(/^[A-Z]{2}$/);
    expect(CODES_PAYS.length).toBeGreaterThanOrEqual(54);
  });

  it("nomme en français, trie par nom", () => {
    expect(nomDuPays("CI")).toBe("Côte d’Ivoire");
    const noms = paysTries().map((p) => p.nom);
    expect([...noms].sort((a, b) => a.localeCompare(b, "fr"))).toEqual(noms);
  });

  it("contient les pays cités par l'aide d'avant (CI, SN, ML) et ceux des paiements", () => {
    for (const c of ["CI", "SN", "ML", "GH", "BJ"]) expect(CODES_PAYS).toContain(c);
  });
});
