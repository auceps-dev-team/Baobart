import { describe, expect, it } from "vitest";

import { preuveExigee } from "./preuve";

const base = { totpActif: false, clesDAcces: 0, codeSaisi: false, passageRecent: false };

describe("la preuve exigée pour changer de compte de versement", () => {
  it("refuse un compte sans aucune double authentification", () => {
    expect(preuveExigee(base)).toEqual({ refus: "SANS_DEUX_FACTEURS" });
    // Même avec une session fraîche : la règle du 18/10 tient.
    expect(preuveExigee({ ...base, passageRecent: true, codeSaisi: true })).toEqual({ refus: "SANS_DEUX_FACTEURS" });
  });

  it("exige un code à chaque fois d'un compte TOTP, même juste après la connexion", () => {
    expect(preuveExigee({ ...base, totpActif: true, passageRecent: true })).toEqual({ refus: "CODE_MANQUANT" });
    expect(preuveExigee({ ...base, totpActif: true, codeSaisi: true })).toEqual({ exiger: "CODE" });
  });

  it("n'enferme plus dehors un compte qui n'a que des clés d'accès", () => {
    const cles = { ...base, clesDAcces: 1 };
    expect(preuveExigee({ ...cles, passageRecent: true })).toEqual({ exiger: "RIEN" });
    expect(preuveExigee({ ...cles, codeSaisi: true })).toEqual({ exiger: "CODE" });
    expect(preuveExigee(cles)).toEqual({ refus: "PASSAGE_ANCIEN" });
  });
});
