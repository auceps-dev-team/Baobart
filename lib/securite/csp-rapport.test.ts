import { describe, expect, it } from "vitest";

import { RAPPORTS_MAX, cheminSansSecrets, lireRapports, origineBloquee } from "./csp-rapport";

describe("le chemin d'une page, sans ses secrets", () => {
  it("garde les mots de route et masque le reste", () => {
    expect(cheminSansSecrets("https://baobart.test/reinitialiser/Zx9_abcDEF-123")).toBe("/reinitialiser/:x");
    expect(cheminSansSecrets("https://baobart.test/products/pack-wax")).toBe("/products/pack-wax");
    expect(cheminSansSecrets("https://baobart.test/@awa")).toBe("/:x");
    expect(cheminSansSecrets("https://baobart.test/achat/cm8x2k9q0000")).toBe("/achat/:x");
  });

  it("oublie la requête et le fragment", () => {
    expect(cheminSansSecrets("https://baobart.test/connexion?suite=/x&jeton=abc#f")).toBe("/connexion");
  });

  it("ne rend rien d'une adresse illisible", () => {
    expect(cheminSansSecrets("pas une adresse")).toBe(":x");
  });
});

describe("ce qui a été bloqué", () => {
  it("rend l'origine, jamais le chemin ni la requête", () => {
    expect(origineBloquee("https://cdn.exemple/a/b.js?cle=1")).toBe("https://cdn.exemple");
  });

  it("garde les mots-clés du navigateur", () => {
    expect(origineBloquee("inline")).toBe("inline");
    expect(origineBloquee("eval")).toBe("eval");
  });

  it("réduit les autres schémas à leur nom", () => {
    expect(origineBloquee("data:image/png;base64,AAAA")).toBe("data");
    expect(origineBloquee("chrome-extension://id/x.js")).toBe("chrome-extension");
  });
});

describe("lire un corps de rapport", () => {
  it("ignore ce qui n'a pas de directive", () => {
    expect(lireRapports({ "csp-report": { "document-uri": "https://x.test/" } })).toEqual([]);
    expect(lireRapports("texte")).toEqual([]);
    expect(lireRapports(null)).toEqual([]);
  });

  it("ne garde que le nom de la directive", () => {
    const [v] = lireRapports({ "violated-directive": "script-src 'self' https://x" });
    expect(v?.directive).toBe("script-src");
  });

  it("borne un envoi groupé", () => {
    const lot = Array.from({ length: 50 }, () => ({ type: "csp-violation", body: { effectiveDirective: "img-src" } }));
    expect(lireRapports(lot)).toHaveLength(RAPPORTS_MAX);
  });
});
