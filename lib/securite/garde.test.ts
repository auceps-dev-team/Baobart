import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { verifierLimite, verifierLimiteHttp } from "@/lib/securite/garde";
import { REGLES } from "@/lib/securite/limites";
import { oublierCompteurs, piloteLimite } from "@/lib/securite/pilotes";

const AVANT = process.env.RATE_LIMIT_DRIVER;

beforeEach(() => {
  process.env.RATE_LIMIT_DRIVER = "memoire";
  oublierCompteurs();
});

afterEach(() => {
  if (AVANT === undefined) delete process.env.RATE_LIMIT_DRIVER;
  else process.env.RATE_LIMIT_DRIVER = AVANT;
  oublierCompteurs();
});

describe("le comptage bout en bout", () => {
  it("laisse passer jusqu'au quota, puis refuse", async () => {
    const quota = REGLES.connexion.quota;

    for (let i = 1; i <= quota; i += 1) {
      const p = await verifierLimite("connexion", "1.2.3.4");
      expect(p.autorise, `essai ${i}`).toBe(true);
    }

    const refuse = await verifierLimite("connexion", "1.2.3.4");
    expect(refuse.autorise).toBe(false);
    expect(refuse.dansSecondes).toBeGreaterThan(0);
  });

  it("décompte ce qu'il reste", async () => {
    const premier = await verifierLimite("connexion", "5.6.7.8");
    const second = await verifierLimite("connexion", "5.6.7.8");

    expect(premier.restant).toBe(REGLES.connexion.quota - 1);
    expect(second.restant).toBe(REGLES.connexion.quota - 2);
  });

  it("ne mélange pas deux sujets", async () => {
    for (let i = 0; i < REGLES.connexion.quota + 3; i += 1) {
      await verifierLimite("connexion", "9.9.9.9");
    }

    // Le voisin n'a rien fait : il passe.
    expect((await verifierLimite("connexion", "8.8.8.8")).autorise).toBe(true);
  });

  it("ne mélange pas deux règles pour un même sujet", async () => {
    // Sans le nom de la règle dans la clé, épuiser ses essais de connexion
    // fermerait aussi la demande d'oubli — et l'on empêcherait quelqu'un de
    // récupérer son compte précisément parce qu'il n'arrive pas à s'y connecter.
    for (let i = 0; i < REGLES.connexion.quota + 3; i += 1) {
      await verifierLimite("connexion", "7.7.7.7");
    }

    expect((await verifierLimite("oubli", "7.7.7.7")).autorise).toBe(true);
  });
});

describe("ce qui laisse passer sans compter", () => {
  it("un sujet absent", async () => {
    // Pas d'adresse : développement, tunnel, test. On autorise plutôt que de
    // fermer le service à qui n'a pas d'adresse identifiable.
    const p = await verifierLimite("connexion", null);
    expect(p).toEqual({ autorise: true, restant: null, dansSecondes: 0 });
  });

  it("une requête sans en-tête d'adresse", async () => {
    const requete = new Request("https://baobart.test/x");
    for (let i = 0; i < REGLES.connexion.quota + 5; i += 1) {
      expect((await verifierLimiteHttp("connexion", requete)).autorise).toBe(true);
    }
  });

  it("un compteur hors service", async () => {
    // Le pilote « aucun » rend null, comme le ferait un Redis injoignable. Un
    // limiteur en panne ne doit pas fermer la connexion à tout le monde.
    process.env.RATE_LIMIT_DRIVER = "aucun";
    expect(piloteLimite().nom).toBe("aucun");

    for (let i = 0; i < REGLES.connexion.quota + 5; i += 1) {
      expect((await verifierLimite("connexion", "1.1.1.1")).autorise).toBe(true);
    }
  });
});

describe("le choix du pilote", () => {
  it("retombe en mémoire sur un nom inconnu", async () => {
    // Un nom mal orthographié ne doit pas désactiver silencieusement la
    // limitation : mieux vaut compter en mémoire — imparfait mais réel — que
    // ne rien compter du tout.
    process.env.RATE_LIMIT_DRIVER = "reddis";
    expect(piloteLimite().nom).toBe("memoire");
  });

  it("compte en mémoire quand rien n'est réglé", async () => {
    delete process.env.RATE_LIMIT_DRIVER;
    expect(piloteLimite().nom).toBe("memoire");
  });
});

describe("la requête bornée par son adresse", () => {
  function requete(adresse: string): Request {
    return new Request("https://baobart.test/x", {
      headers: { "x-real-ip": adresse },
    });
  }

  it("épuise le quota d'une adresse et pas d'une autre", async () => {
    const quota = REGLES.oubli.quota;

    for (let i = 0; i < quota; i += 1) {
      expect((await verifierLimiteHttp("oubli", requete("4.4.4.4"))).autorise).toBe(
        true,
      );
    }

    expect((await verifierLimiteHttp("oubli", requete("4.4.4.4"))).autorise).toBe(
      false,
    );
    expect((await verifierLimiteHttp("oubli", requete("3.3.3.3"))).autorise).toBe(
      true,
    );
  });
});
