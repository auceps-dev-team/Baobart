import { describe, expect, it } from "vitest";

import { licenceBienFormee, nouvelleLicence } from "./licence";

describe("clé de licence", () => {
  it("respecte le format annoncé", () => {
    expect(licenceBienFormee(nouvelleLicence())).toBe(true);
  });

  it("fait quatre groupes de huit", () => {
    const groupes = nouvelleLicence().split("-");
    expect(groupes).toHaveLength(4);
    for (const g of groupes) expect(g).toHaveLength(8);
  });

  describe("alphabet sans ambiguïté", () => {
    it.each(["0", "O", "1", "I", "L"])(
      "n'emploie jamais « %s »",
      (caractere) => {
        // Ces caractères se confondent dans une police, et la clé sera recopiée
        // à la main depuis un courriel.
        const echantillon = Array.from({ length: 300 }, nouvelleLicence).join("");
        expect(echantillon).not.toContain(caractere);
      },
    );
  });

  describe("imprévisibilité", () => {
    it("ne se répète pas sur un large échantillon", () => {
      const tirees = new Set(Array.from({ length: 5000 }, nouvelleLicence));
      expect(tirees.size).toBe(5000);
    });

    it("répartit les caractères sans favoriser le début de l'alphabet", () => {
      // Un `randomBytes % 31` produirait un excès sur les premiers caractères,
      // 256 n'étant pas un multiple de 31. On vérifie qu'aucun ne domine.
      const chars = Array.from({ length: 4000 }, nouvelleLicence)
        .join("")
        .replaceAll("-", "");
      const comptes = new Map<string, number>();
      for (const c of chars) comptes.set(c, (comptes.get(c) ?? 0) + 1);

      const attendu = chars.length / 31;
      for (const [c, n] of comptes) {
        // Marge large : on cherche un biais systématique, pas du bruit.
        expect(n, `caractère ${c}`).toBeGreaterThan(attendu * 0.8);
        expect(n, `caractère ${c}`).toBeLessThan(attendu * 1.2);
      }
    });
  });

  describe("validation de forme", () => {
    it.each([
      "",
      "ABCDEFGH",
      "ABCDEFGH-ABCDEFGH-ABCDEFGH",
      "ABCDEFGH-ABCDEFGH-ABCDEFGH-ABCDEFGH-ABCDEFGH",
      "abcdefgh-ABCDEFGH-ABCDEFGH-ABCDEFGH",
      "ABCDEF0H-ABCDEFGH-ABCDEFGH-ABCDEFGH",
      "ABCDEFGH ABCDEFGH ABCDEFGH ABCDEFGH",
    ])("refuse %j", (valeur) => {
      expect(licenceBienFormee(valeur)).toBe(false);
    });
  });
});
