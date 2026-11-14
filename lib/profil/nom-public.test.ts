import { describe, expect, it } from "vitest";

import { NOM_PAR_DEFAUT, nomPublic } from "@/lib/profil/nom-public";

describe("nomPublic", () => {
  it("rend le nom d'affichage quand il y en a un", () => {
    expect(nomPublic({ displayName: "Awa Diallo" })).toBe("Awa Diallo");
  });

  it("rend « Membre Baobart » pour un compte sans profil", () => {
    expect(NOM_PAR_DEFAUT).toBe("Membre Baobart");
    expect(nomPublic(null)).toBe(NOM_PAR_DEFAUT);
    expect(nomPublic(undefined)).toBe(NOM_PAR_DEFAUT);
  });

  it("ne rend jamais un nom vide", () => {
    // `??` ne rattrape pas la chaîne vide : l'ancien repli affichait « par  ».
    expect(nomPublic({ displayName: "" })).toBe(NOM_PAR_DEFAUT);
    expect(nomPublic({ displayName: "   " })).toBe(NOM_PAR_DEFAUT);
    expect(nomPublic({ displayName: null })).toBe(NOM_PAR_DEFAUT);
  });

  it("retire les espaces autour du nom", () => {
    expect(nomPublic({ displayName: "  Kwame Mensah " })).toBe("Kwame Mensah");
  });
});
