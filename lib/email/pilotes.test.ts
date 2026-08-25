import { describe, expect, it } from "vitest";

import { adressePlausible, echecDefinitif, reglagesSmtp } from "./pilotes";

describe("adresse plausible", () => {
  it.each([
    "awa@baobart.test",
    "a.b+c@sous.domaine.africa",
  ])("accepte %s", (a) => {
    expect(adressePlausible(a)).toBe(true);
  });

  it.each([
    "pas-une-adresse",
    "sans@domaine",
    "a@b.test\nBcc: voleur@x.test",
    "espace dans@adresse.test",
    "",
  ])("refuse %j", (a) => {
    expect(adressePlausible(a)).toBe(false);
  });

  it("refuse une adresse absurdement longue", () => {
    expect(adressePlausible("a".repeat(320) + "@b.test")).toBe(false);
  });
});

describe("réglages SMTP", () => {
  describe("chiffrement", () => {
    it("chiffre dès la connexion en smtps", () => {
      const r = reglagesSmtp("smtps://u:p@courriel.test");
      expect(r.secure).toBe(true);
      expect(r.port).toBe(465);
    });

    it("exige STARTTLS quand la connexion démarre en clair", () => {
      // Sans cette exigence, un serveur qui n'annonce pas STARTTLS recevrait
      // le message et les identifiants en clair, sans que rien ne le signale.
      const r = reglagesSmtp("smtp://u:p@courriel.test");
      expect(r.secure).toBe(false);
      expect(r.requireTLS).toBe(true);
      expect(r.port).toBe(587);
    });

    it("n'accepte jamais une connexion en clair vers l'extérieur", () => {
      for (const url of ["smtp://h.test", "smtps://h.test", "smtp://h.test:2525"]) {
        const r = reglagesSmtp(url);
        expect(r.secure || r.requireTLS, url).toBe(true);
      }
    });

    it.each(["localhost", "127.0.0.1"])(
      "tolère le clair vers %s — le trafic ne quitte pas la machine",
      (hote) => {
        const r = reglagesSmtp(`smtp://${hote}:1025`);
        expect(r.requireTLS).toBe(false);
        expect(r.secure).toBe(false);
      },
    );

    it("ne prend pas un nom qui ressemble à localhost pour localhost", () => {
      // « localhost.attaquant.test » est un domaine public ordinaire.
      const r = reglagesSmtp("smtp://localhost.attaquant.test");
      expect(r.requireTLS).toBe(true);
    });
  });

  describe("adresse et identifiants", () => {
    it("respecte un port explicite", () => {
      expect(reglagesSmtp("smtp://h.test:2525").port).toBe(2525);
    });

    it("décode les identifiants échappés dans l'URL", () => {
      // Un mot de passe contenant « @ » ou « / » doit être encodé dans l'URL ;
      // le transmettre encodé au serveur échouerait à l'authentification.
      const r = reglagesSmtp("smtp://mon%40user:mot%2Fpasse@h.test");
      expect(r.auth).toEqual({ user: "mon@user", pass: "mot/passe" });
    });

    it("n'invente pas d'identifiants quand l'URL n'en porte pas", () => {
      expect(reglagesSmtp("smtp://h.test").auth).toBeUndefined();
    });
  });
});

describe("échec SMTP définitif", () => {
  it("renonce sur un 5xx — le serveur dit non, et n'insiste pas", () => {
    expect(echecDefinitif({ responseCode: 550 })).toBe(true);
    expect(echecDefinitif({ responseCode: 553 })).toBe(true);
  });

  it("réessaie sur un 4xx — boîte pleine, serveur saturé", () => {
    expect(echecDefinitif({ responseCode: 421 })).toBe(false);
    expect(echecDefinitif({ responseCode: 450 })).toBe(false);
  });

  it("réessaie sur une panne réseau, sans code de réponse", () => {
    expect(echecDefinitif(new Error("ECONNREFUSED"))).toBe(false);
    expect(echecDefinitif(null)).toBe(false);
    expect(echecDefinitif(undefined)).toBe(false);
  });

  it("réessaie sur une authentification refusée", () => {
    // Elle vient d'une configuration corrigeable : abandonner les messages en
    // attendant les perdrait.
    expect(echecDefinitif({ code: "EAUTH" })).toBe(false);
  });
});
