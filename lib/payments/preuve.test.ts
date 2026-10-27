import { describe, expect, it } from "vitest";

import { facteurPropose, preuveExigee } from "./preuve";

const base = { totpActif: false, clesDAcces: 0, codeSaisi: false, passageRecent: false };

describe("la preuve exigée pour changer de compte de versement", () => {
  it("n'enferme plus personne dehors : sans application, le code arrive par courriel", () => {
    // Le 18/10, ce compte était refusé (« SANS_DEUX_FACTEURS »).
    expect(preuveExigee(base)).toEqual({ refus: "CODE_COURRIEL_MANQUANT" });
    expect(preuveExigee({ ...base, codeSaisi: true })).toEqual({ exiger: "CODE_COURRIEL" });
  });

  it("ne laisse jamais passer une session seule, même fraîche", () => {
    expect(preuveExigee({ ...base, passageRecent: true })).toEqual({ refus: "CODE_COURRIEL_MANQUANT" });
  });

  it("exige le code de l'application d'un compte TOTP, même juste après la connexion", () => {
    expect(preuveExigee({ ...base, totpActif: true, passageRecent: true })).toEqual({ refus: "CODE_MANQUANT" });
    expect(preuveExigee({ ...base, totpActif: true, codeSaisi: true })).toEqual({ exiger: "CODE_TOTP" });
  });

  it("ne remplace pas TOTP par le courriel, plus faible", () => {
    expect(facteurPropose({ totpActif: true })).toBe("TOTP");
    expect(facteurPropose({ totpActif: false })).toBe("COURRIEL");
  });

  it("laisse passer un compte à clé d'accès franchie il y a peu, sans code", () => {
    const cles = { ...base, clesDAcces: 1 };
    expect(preuveExigee({ ...cles, passageRecent: true })).toEqual({ exiger: "RIEN" });
    expect(preuveExigee(cles)).toEqual({ refus: "CODE_COURRIEL_MANQUANT" });
    expect(preuveExigee({ ...cles, codeSaisi: true })).toEqual({ exiger: "CODE_COURRIEL" });
  });
});
