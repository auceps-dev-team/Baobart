import { describe, expect, it } from "vitest";

import {
  constatAdressePublique,
  constatBase,
  constatAntiBot,
  constatLimitation,
  constatSms,
  constatConnexion,
  constatInterrupteurs,
  constatSimulation,
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

    it("avertit d'un fournisseur configuré qu'aucune route ne reçoit", () => {
      // Jusqu'au 08/10/2026, ce cas s'affichait « 1 fournisseur(s) actif(s) :
      // Google » en vert, et le bouton menait à une 404.
      const c = constatConnexion({
        actifs: [],
        configuresNonBranches: ["Google"],
        motDePasse: true,
      });
      expect(c.gravite).toBe("attention");
      expect(c.detail).toContain("Google");
      expect(c.detail).toContain("non branché");
    });

    it("ne cache pas les actifs derrière l'avertissement", () => {
      const c = constatConnexion({
        actifs: ["GitHub"],
        configuresNonBranches: ["Google"],
        motDePasse: true,
      });
      expect(c.gravite).toBe("attention");
      expect(c.detail).toContain("GitHub");
    });
  });

  describe("paiement simulé", () => {
    it("est calme quand la simulation est fermée", () => {
      expect(
        constatSimulation({ ouverte: false, production: true }).gravite,
      ).toBe("ok");
    });

    it("avertit hors production", () => {
      expect(
        constatSimulation({ ouverte: true, production: false }).gravite,
      ).toBe("attention");
    });

    it("crie à la panne en production", () => {
      // Deux dégâts à la fois : les ressources payantes se prennent sans
      // payer, et les créateurs sont crédités d'un argent jamais entré.
      const c = constatSimulation({ ouverte: true, production: true });
      expect(c.gravite).toBe("panne");
      expect(c.remede).toContain("CHECKOUT_SIMULATION_ENABLED");
    });

    it("dit où retrouver les ventes fabriquées", () => {
      const c = constatSimulation({ ouverte: true, production: true });
      expect(c.remede).toContain("simulation");
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

describe("l'adresse publique", () => {
  it("est une panne quand elle manque : les courriels ne peuvent plus partir", () => {
    const c = constatAdressePublique({ origine: null, production: true });
    expect(c.gravite).toBe("panne");
    expect(c.remede).toContain("APP_URL");
  });

  it("est une panne en HTTP sur un site en production", () => {
    // Le lien de réinitialisation est un identifiant temporaire. En clair sur
    // le réseau, il se ramasse.
    const c = constatAdressePublique({
      origine: "http://baobart.com",
      production: true,
    });
    expect(c.gravite).toBe("panne");
  });

  it("laisse passer HTTP hors production", () => {
    const c = constatAdressePublique({
      origine: "http://localhost:3000",
      production: false,
    });
    expect(c.gravite).toBe("ok");
  });

  it("est satisfaite d'une adresse en HTTPS", () => {
    const c = constatAdressePublique({
      origine: "https://baobart.com",
      production: true,
    });
    expect(c.gravite).toBe("ok");
    expect(c.detail).toContain("baobart.com");
  });
});

describe("l'anti-bot", () => {
  it("avertit en production quand aucun tiers n'est branché", () => {
    // Ni « ok » ni « panne » : le leurre et le plancher de temps protègent
    // réellement, mais pas contre un robot écrit pour ce site-ci. Les deux
    // extrêmes mentiraient, chacun dans un sens.
    const c = constatAntiBot({ tiers: false, production: true });
    expect(c.gravite).toBe("attention");
    expect(c.remede).toContain("RECAPTCHA_SECRET");
  });

  it("ne dit rien en développement", () => {
    const c = constatAntiBot({ tiers: false, production: false });
    expect(c.gravite).toBe("ok");
    expect(c.remede).toBeUndefined();
  });

  it("se tait quand le tiers est branché", () => {
    const c = constatAntiBot({ tiers: true, production: true });
    expect(c.gravite).toBe("ok");
    expect(c.remede).toBeUndefined();
  });
});

describe("la limitation", () => {
  it("avertit en production quand elle compte en mémoire", () => {
    // Le pire genre de panne : celle qui a l'air de fonctionner. Les compteurs
    // tournent, la page dit « protégé », et dix instances autorisent dix fois
    // la limite.
    const c = constatLimitation({ pilote: "memoire", production: true });
    expect(c.gravite).toBe("attention");
    expect(c.remede).toContain("redis");
  });

  it("ne dit rien en développement, où c'est le bon choix", () => {
    const c = constatLimitation({ pilote: "memoire", production: false });
    expect(c.gravite).toBe("ok");
    expect(c.remede).toBeUndefined();
  });

  it("est une panne quand on a demandé à ne rien compter, en production", () => {
    const c = constatLimitation({ pilote: "aucun", production: true });
    expect(c.gravite).toBe("panne");
  });

  it("se tait quand Redis compte", () => {
    const c = constatLimitation({ pilote: "redis", production: true });
    expect(c.gravite).toBe("ok");
    expect(c.detail).toContain("redis");
  });
});

describe("le canal SMS", () => {
  it("tient le pilote « console » en production pour une panne", () => {
    // Contre-intuitif et pourtant : « console » rend `true` sans rien envoyer,
    // donc Ndank note une relance jamais partie et coupera l'accès à quelqu'un
    // que personne n'a prévenu.
    const c = constatSms({ pilote: "console", production: true });
    expect(c.gravite).toBe("panne");
    expect(c.remede).toContain("SMS_DRIVER");
  });

  it("laisse tranquille le pilote « console » en développement", () => {
    expect(constatSms({ pilote: "console", production: false }).gravite).toBe("ok");
  });

  it("avertit sans crier quand aucun opérateur n'est branché en production", () => {
    // « Aucun » ne prétend rien : le courriel part encore, et les injoignables
    // remontent. C'est un manque, pas un mensonge.
    const c = constatSms({ pilote: "aucun", production: true });
    expect(c.gravite).toBe("attention");
  });

  it("se tait quand un opérateur envoie pour de vrai", () => {
    expect(constatSms({ pilote: "twilio", production: true }).gravite).toBe("ok");
  });
});
