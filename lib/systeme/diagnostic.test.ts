import { describe, expect, it } from "vitest";

import {
  constatBase,
  constatConnexion,
  constatInterrupteurs,
  constatStockage,
  graviteGlobale,
  type Constat,
} from "./diagnostic";

const OK: Constat = { cle: "a", libelle: "A", gravite: "ok", detail: "" };
const ATTENTION: Constat = { ...OK, cle: "b", gravite: "attention" };
const PANNE: Constat = { ...OK, cle: "c", gravite: "panne" };

describe("diagnostic de la plateforme", () => {
  describe("gravité globale", () => {
    it("est ok quand tout va bien", () => {
      expect(graviteGlobale([OK, OK])).toBe("ok");
    });

    it("laisse le pire l'emporter", () => {
      expect(graviteGlobale([OK, ATTENTION, PANNE])).toBe("panne");
      expect(graviteGlobale([OK, ATTENTION])).toBe("attention");
    });

    it("ne considère pas une liste vide comme en panne", () => {
      expect(graviteGlobale([])).toBe("ok");
    });
  });

  describe("base de données", () => {
    it("signale une panne quand elle est injoignable", () => {
      const c = constatBase({ joignable: false, enAttente: 0 });
      expect(c.gravite).toBe("panne");
      expect(c.remede).toContain("DATABASE_URL");
    });

    it("traite une migration en attente comme une panne, pas un avertissement", () => {
      // Le code déployé attend des colonnes absentes : la panne surgira à la
      // première requête, pas au démarrage. La signaler mollement ferait
      // déployer par-dessus.
      const c = constatBase({ joignable: true, enAttente: 2 });
      expect(c.gravite).toBe("panne");
      expect(c.detail).toContain("2");
    });

    it("est verte quand la base répond et que le schéma est à jour", () => {
      expect(constatBase({ joignable: true, enAttente: 0 }).gravite).toBe("ok");
    });
  });

  describe("stockage", () => {
    const base = { configure: true, production: true };

    it("est en panne sans configuration", () => {
      const c = constatStockage({ ...base, configure: false, urlPublique: null });
      expect(c.gravite).toBe("panne");
    });

    it("avertit quand S3_PUBLIC_URL manque sans être bloquant", () => {
      const c = constatStockage({ ...base, urlPublique: null });
      expect(c.gravite).toBe("attention");
    });

    it("refuse le HTTP en production", () => {
      // Une image en HTTP sur une page HTTPS est bloquée par le navigateur et
      // la grille se vide, sans qu'aucune erreur ne remonte au serveur.
      const c = constatStockage({ ...base, urlPublique: "http://media.exemple.com" });
      expect(c.gravite).toBe("panne");
      expect(c.remede).toContain("https");
    });

    it("tolère le HTTP hors production", () => {
      const c = constatStockage({
        configure: true,
        production: false,
        urlPublique: "http://localhost:9000",
      });
      expect(c.gravite).toBe("ok");
    });

    it.each(["http://localhost:9000", "https://127.0.0.1:9000"])(
      "refuse une adresse locale en production (%s)",
      (url) => {
        expect(constatStockage({ ...base, urlPublique: url }).gravite).toBe("panne");
      },
    );

    it("signale une URL illisible plutôt que de la laisser passer", () => {
      const c = constatStockage({ ...base, urlPublique: "media.exemple.com" });
      expect(c.gravite).toBe("panne");
      expect(c.detail).toContain("valide");
    });

    it("est verte sur une adresse publique en https", () => {
      const c = constatStockage({ ...base, urlPublique: "https://media.exemple.com" });
      expect(c.gravite).toBe("ok");
      expect(c.detail).toContain("media.exemple.com");
    });
  });

  describe("connexion", () => {
    it("est en panne quand plus personne ne peut entrer", () => {
      const c = constatConnexion({ actifs: [], motDePasse: false });
      expect(c.gravite).toBe("panne");
    });

    it("se contente d'avertir quand le mot de passe reste ouvert", () => {
      expect(constatConnexion({ actifs: [], motDePasse: true }).gravite).toBe(
        "attention",
      );
    });

    it("nomme les fournisseurs actifs", () => {
      const c = constatConnexion({ actifs: ["google", "github"], motDePasse: true });
      expect(c.gravite).toBe("ok");
      expect(c.detail).toContain("google");
    });
  });

  describe("interrupteurs", () => {
    it("est vert quand rien n'est fermé", () => {
      expect(constatInterrupteurs({ fermees: [] }).gravite).toBe("ok");
    });

    it("avertit sans crier à la panne : fermer est une décision", () => {
      const c = constatInterrupteurs({ fermees: ["Envoi de fichiers"] });
      expect(c.gravite).toBe("attention");
      expect(c.detail).toContain("Envoi de fichiers");
    });
  });
});
