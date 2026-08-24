import { describe, expect, it } from "vitest";

import { ligne } from "./journal";

const INSTANT = new Date("2026-08-24T09:30:00.000Z");

function lire(...args: Parameters<typeof ligne>) {
  return JSON.parse(ligne(...args)) as Record<string, unknown>;
}

describe("journal structuré", () => {
  describe("forme de la ligne", () => {
    it("écrit un JSON valide, sur une seule ligne", () => {
      const brut = ligne("info", "envoi confirmé", { produitId: "p1" }, INSTANT);
      expect(brut).not.toContain("\n");
      expect(() => JSON.parse(brut)).not.toThrow();
    });

    it("porte l'horodatage, le niveau et le message", () => {
      const l = lire("erreur", "échec du versement", {}, INSTANT);
      expect(l.horodatage).toBe("2026-08-24T09:30:00.000Z");
      expect(l.niveau).toBe("erreur");
      expect(l.message).toBe("échec du versement");
    });

    it("remonte les champs à la racine, pour qu'ils se filtrent", () => {
      const l = lire("info", "ok", { produitId: "p1", duree: 42 }, INSTANT);
      expect(l.produitId).toBe("p1");
      expect(l.duree).toBe(42);
    });
  });

  describe("caviardage", () => {
    it.each([
      "secret",
      "token",
      "accessKeyId",
      "secretAccessKey",
      "authorization",
      "cookie",
      "sessionToken",
      "apiKey",
      "motDePasse",
      "SENTRY_DSN",
    ])("masque le champ %j", (nom) => {
      const l = lire("info", "test", { [nom]: "valeur-sensible" }, INSTANT);
      expect(l[nom]).toBe("[caviardé]");
    });

    it("masque en profondeur, pas seulement à la racine", () => {
      const l = lire(
        "info",
        "config",
        { s3: { region: "eu-west-3", secretAccessKey: "abc123" } },
        INSTANT,
      );
      const s3 = l.s3 as Record<string, unknown>;
      expect(s3.region).toBe("eu-west-3");
      expect(s3.secretAccessKey).toBe("[caviardé]");
    });

    it("masque à l'intérieur des tableaux", () => {
      const l = lire("info", "comptes", { liste: [{ token: "t1" }] }, INSTANT);
      const liste = l.liste as Array<Record<string, unknown>>;
      expect(liste[0]?.token).toBe("[caviardé]");
    });

    it("laisse passer ce qui n'est pas sensible", () => {
      const l = lire("info", "ok", { produitId: "p1", taille: 1024 }, INSTANT);
      expect(l.produitId).toBe("p1");
      expect(l.taille).toBe(1024);
    });

    it("ne laisse jamais la valeur sensible apparaître dans le texte brut", () => {
      const brut = ligne(
        "info",
        "test",
        { secretAccessKey: "wJalrXUtnFEMI" },
        INSTANT,
      );
      expect(brut).not.toContain("wJalrXUtnFEMI");
    });
  });

  describe("valeurs qui cassent JSON.stringify", () => {
    it("sérialise une Error au lieu d'un objet vide", () => {
      const l = lire("erreur", "échec", { cause: new Error("bucket absent") }, INSTANT);
      const cause = l.cause as Record<string, unknown>;
      expect(cause.nom).toBe("Error");
      expect(cause.message).toBe("bucket absent");
      expect(typeof cause.pile).toBe("string");
    });

    it("ne lève pas sur un BigInt", () => {
      expect(() => ligne("info", "t", { montant: 10n }, INSTANT)).not.toThrow();
      expect(lire("info", "t", { montant: 10n }, INSTANT).montant).toBe("10");
    });

    it("ne boucle pas sur une structure cyclique", () => {
      const noeud: Record<string, unknown> = { nom: "a" };
      noeud.soi = noeud;
      expect(() => ligne("info", "t", { noeud }, INSTANT)).not.toThrow();
    });
  });
});
