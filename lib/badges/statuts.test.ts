import { describe, expect, it } from "vitest";

import { gestesSur, lireGeste, STATUTS } from "./statuts";

const cles = (actuels: Parameters<typeof gestesSur>[0]) => gestesSur(actuels).map((g) => g.cle);

describe("les gestes possibles sur un compte", () => {
  it("propose d'accorder chacun des quatre statuts à un compte qui n'en a aucun", () => {
    expect(cles([])).toEqual(STATUTS.map((s) => `ACCORDER:${s.code}`));
  });

  it("propose de retirer ce que le compte porte, et seulement cela", () => {
    expect(cles(["VERIFIED_CREATOR"])).toContain("RETIRER:VERIFIED_CREATOR");
    expect(cles(["VERIFIED_CREATOR"])).not.toContain("ACCORDER:VERIFIED_CREATOR");
  });

  it("passe d'Agence à Freelance au lieu de poser les deux", () => {
    const gestes = gestesSur(["AGENCE"]);
    expect(gestes.map((g) => g.cle)).toEqual(
      expect.arrayContaining(["RETIRER:AGENCE", "ACCORDER:FREELANCE"]),
    );
    expect(gestes.find((g) => g.cle === "ACCORDER:FREELANCE")!.libelle).toBe("Passer en Freelance (retire Agence)");
  });

  it("ne touche pas aux mérites que le compte porte", () => {
    // Un mérite se recalcule, il ne se retire pas à la main.
    expect(cles(["TOP_CREATOR"]).some((c) => c.includes("TOP_CREATOR"))).toBe(false);
  });
});

describe("la clé reçue du navigateur", () => {
  it("se relit quand elle est connue", () => {
    expect(lireGeste("ACCORDER:FREELANCE")).toEqual({ sens: "ACCORDER", code: "FREELANCE" });
    expect(lireGeste("RETIRER:VERIFIED_RECRUITER")).toEqual({ sens: "RETIRER", code: "VERIFIED_RECRUITER" });
  });

  it("se refuse quand elle vise un mérite, un code inconnu ou un sens inventé", () => {
    expect(lireGeste("ACCORDER:TOP_CREATOR")).toBeNull();
    expect(lireGeste("ACCORDER:ADMIN")).toBeNull();
    expect(lireGeste("SUPPRIMER:FREELANCE")).toBeNull();
    expect(lireGeste("")).toBeNull();
  });
});
