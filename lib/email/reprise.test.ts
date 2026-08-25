import { describe, expect, it } from "vitest";

import { reculApres, suiteApresEchec, TENTATIVES_MAX } from "./reprise";

describe("reprise des envois", () => {
  describe("recul progressif", () => {
    it("commence court — la panne la plus fréquente est passagère", () => {
      expect(reculApres(1)).toBe(60_000);
    });

    it("s'espace à chaque tentative", () => {
      const suite = [1, 2, 3, 4, 5].map(reculApres);
      for (let i = 1; i < suite.length; i += 1) {
        expect(suite[i]!).toBeGreaterThan(suite[i - 1]!);
      }
    });

    it("plafonne au lieu de croître sans fin", () => {
      expect(reculApres(99)).toBe(reculApres(TENTATIVES_MAX));
    });

    it("ne renvoie jamais zéro, même sur une entrée aberrante", () => {
      // Un recul nul ferait tourner le passage en boucle sur la même ligne.
      for (const n of [0, -1, -100, Number.NaN]) {
        expect(reculApres(n)).toBeGreaterThan(0);
      }
    });
  });

  describe("sort après échec", () => {
    it("renonce tout de suite sur une erreur définitive", () => {
      // Une adresse mal formée ne guérit pas : insister retarde le reste.
      const s = suiteApresEchec({ tentatives: 1, definitif: true });
      expect(s).toEqual({ sort: "RENONCER", motif: "definitif" });
    });

    it("réessaie tant que le quota n'est pas atteint", () => {
      const s = suiteApresEchec({ tentatives: 2, definitif: false });
      expect(s.sort).toBe("REESSAYER");
    });

    it("renonce au quota atteint", () => {
      const s = suiteApresEchec({
        tentatives: TENTATIVES_MAX,
        definitif: false,
      });
      expect(s).toEqual({ sort: "RENONCER", motif: "trop_de_tentatives" });
    });

    it("ne dépasse jamais le quota, même si le compteur a dérivé", () => {
      const s = suiteApresEchec({
        tentatives: TENTATIVES_MAX + 40,
        definitif: false,
      });
      expect(s.sort).toBe("RENONCER");
    });

    it("réessaie dans le doute plutôt que de perdre le message", () => {
      // Abandonner à tort perd un message ; réessayer à tort coûte une
      // tentative. Le déséquilibre dicte le défaut.
      const s = suiteApresEchec({ tentatives: 1, definitif: false });
      expect(s.sort).toBe("REESSAYER");
    });
  });
});
