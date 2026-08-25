import { describe, expect, it } from "vitest";

import {
  AGE_GRAVE_MS,
  AGE_INQUIETANT_MS,
  compteurs,
  dureeLisible,
  graviteLigne,
  SEUIL_ATTENTE,
  type FaitsFile,
} from "./supervision";

const CALME: FaitsFile = {
  enAttente: 1,
  envoyes24h: 184,
  echecs: 0,
  agePlusAncienMs: 60_000,
};

function compteur(faits: Partial<FaitsFile>, cle: string) {
  return compteurs({ ...CALME, ...faits }).find((c) => c.cle === cle)!;
}

describe("compteurs de la file", () => {
  it("en produit toujours quatre", () => {
    expect(compteurs(CALME)).toHaveLength(4);
  });

  describe("en attente", () => {
    it("reste calme sous le seuil", () => {
      expect(compteur({ enAttente: SEUIL_ATTENTE - 1 }, "attente").gravite).toBe("ok");
    });

    it("alerte au seuil, pas seulement au-delà", () => {
      expect(compteur({ enAttente: SEUIL_ATTENTE }, "attente").gravite).toBe(
        "attention",
      );
    });

    it("ne crie jamais à la panne : une file qui grossit s'écoule encore", () => {
      expect(compteur({ enAttente: 5000 }, "attente").gravite).toBe("attention");
    });
  });

  describe("envoyés", () => {
    it("n'alarme jamais, quel que soit le volume", () => {
      for (const n of [0, 184, 1_000_000]) {
        expect(compteur({ envoyes24h: n }, "envoyes").gravite).toBe("ok");
      }
    });
  });

  describe("échecs définitifs", () => {
    it("est une panne dès le premier", () => {
      // La machine a renoncé : sans décision humaine, ce message ne partira
      // jamais.
      expect(compteur({ echecs: 1 }, "echecs").gravite).toBe("panne");
    });

    it("est calme à zéro", () => {
      expect(compteur({ echecs: 0 }, "echecs").gravite).toBe("ok");
    });
  });

  describe("âge du plus ancien", () => {
    it("est calme sur une file vide", () => {
      const c = compteur({ agePlusAncienMs: null }, "age");
      expect(c.gravite).toBe("ok");
      expect(c.valeur).toBe("—");
    });

    it("est calme quand la file s'écoule", () => {
      expect(compteur({ agePlusAncienMs: 60_000 }, "age").gravite).toBe("ok");
    });

    it("s'inquiète à la demi-heure", () => {
      expect(compteur({ agePlusAncienMs: AGE_INQUIETANT_MS }, "age").gravite).toBe(
        "attention",
      );
    });

    it("crie à la panne à l'heure", () => {
      expect(compteur({ agePlusAncienMs: AGE_GRAVE_MS }, "age").gravite).toBe(
        "panne",
      );
    });

    it("voit une file figée que le nombre en attente ne trahit pas", () => {
      // Trois messages depuis six heures : le compteur « en attente » reste
      // vert, et pourtant plus rien ne part.
      const liste = compteurs({
        enAttente: 3,
        envoyes24h: 0,
        echecs: 0,
        agePlusAncienMs: 6 * 3_600_000,
      });
      expect(liste.find((c) => c.cle === "attente")?.gravite).toBe("ok");
      expect(liste.find((c) => c.cle === "age")?.gravite).toBe("panne");
    });
  });
});

describe("durée lisible", () => {
  it.each([
    [30_000, "moins d'une minute"],
    [60_000, "1 min"],
    [43 * 60_000, "43 min"],
    [3_600_000, "1 h"],
    [2 * 3_600_000 + 10 * 60_000, "2 h 10"],
    [24 * 3_600_000, "1 jour"],
    [3 * 24 * 3_600_000, "3 jours"],
  ])("rend %i ms en %s", (ms, attendu) => {
    expect(dureeLisible(ms)).toBe(attendu);
  });

  it("garde deux chiffres aux minutes d'une heure pleine", () => {
    // « 2 h 5 » se lit mal ; « 2 h 05 » se lit d'un coup d'œil.
    expect(dureeLisible(2 * 3_600_000 + 5 * 60_000)).toBe("2 h 05");
  });
});

describe("gravité d'une ligne", () => {
  it("traite un échec comme une panne", () => {
    expect(graviteLigne({ statut: "FAILED", reclameDepuisMs: null })).toBe("panne");
  });

  it.each(["PENDING", "SENT", "ABANDONED"] as const)("laisse %s au calme", (s) => {
    expect(graviteLigne({ statut: s, reclameDepuisMs: null })).toBe("ok");
  });

  describe("en cours d'envoi", () => {
    it("est normal quand la réclamation est fraîche", () => {
      expect(
        graviteLigne({ statut: "SENDING", reclameDepuisMs: 5_000 }),
      ).toBe("attention");
    });

    it("devient une panne quand elle traîne — le processus est mort", () => {
      expect(
        graviteLigne({ statut: "SENDING", reclameDepuisMs: AGE_INQUIETANT_MS }),
      ).toBe("panne");
    });
  });
});
