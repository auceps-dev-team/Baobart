import { describe, expect, it } from "vitest";

import { DESTINATION_PAR_DEFAUT, destination, suiteSure } from "./suite";

describe("la suite d'une connexion", () => {
  it("suit les chemins que le site fabrique", () => {
    for (const chemin of ["/@awa-createur", "/dashboard/profil", "/jobs/cm0abc/postuler", "/evenements/e1?onglet=billets", "/createurs/awa?q=wax#ressources"]) {
      expect(suiteSure(chemin)).toBe(chemin);
    }
  });

  it("refuse toute adresse extérieure, même déguisée en chemin", () => {
    for (const piege of ["https://baobart-ci.com", "//baobart-ci.com", "/\\baobart-ci.com", "/x\\..\\..", "javascript:alert(1)", "baobart-ci.com/connexion", " //baobart-ci.com"]) {
      expect(suiteSure(piege), piege).toBeNull();
    }
  });

  it("refuse ce qui forgerait un en-tête : retours à la ligne, tabulations, caractères de contrôle", () => {
    for (const piege of ["/a\r\nSet-Cookie: x=1", "/a\nb", "/\t/baobart-ci.com", "/a b", "/a\u0000"]) {
      expect(suiteSure(piege), JSON.stringify(piege)).toBeNull();
    }
  });

  it("refuse de ramener à la connexion, à l'inscription ou à l'API", () => {
    for (const boucle of ["/connexion", "/connexion?suite=/x", "/connexion/verification", "/inscription", "/api/auth/telephone", "/api/csp-report"]) {
      expect(suiteSure(boucle), boucle).toBeNull();
    }
  });

  it("ne confond pas un préfixe avec la page interdite", () => {
    expect(suiteSure("/connexions-utiles")).toBe("/connexions-utiles");
    expect(suiteSure("/apiculture")).toBe("/apiculture");
  });

  it("refuse ce qui n'est pas une chaîne, vide ou démesuré", () => {
    for (const rien of [null, undefined, 42, {}, "", "   ", `/${"a".repeat(600)}`]) {
      expect(suiteSure(rien)).toBeNull();
    }
  });

  it("retombe sur le tableau de bord quand la suite ne vaut rien", () => {
    expect(destination("//baobart-ci.com")).toBe(DESTINATION_PAR_DEFAUT);
    expect(destination(null)).toBe(DESTINATION_PAR_DEFAUT);
    expect(destination("/@awa-createur")).toBe("/@awa-createur");
  });
});
