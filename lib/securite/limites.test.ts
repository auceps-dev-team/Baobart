import { describe, expect, it } from "vitest";

import { REGLES, cleDe, juger, seauDe } from "@/lib/securite/limites";

const REGLE = { quota: 10, fenetreMs: 60_000 };

describe("la fenêtre glissante", () => {
  it("laisse passer tant qu'on est sous le quota", () => {
    const v = juger({ precedent: 0, courant: 5, regle: REGLE, ecouleMs: 0 });
    expect(v.autorise).toBe(true);
    expect(v.restant).toBe(5);
  });

  it("laisse passer le geste qui atteint exactement le quota", () => {
    // Dix essais autorisés veut dire dix, pas neuf.
    const v = juger({ precedent: 0, courant: 10, regle: REGLE, ecouleMs: 0 });
    expect(v.autorise).toBe(true);
    expect(v.restant).toBe(0);
  });

  it("refuse le onzième", () => {
    const v = juger({ precedent: 0, courant: 11, regle: REGLE, ecouleMs: 0 });
    expect(v.autorise).toBe(false);
    expect(v.restant).toBe(0);
  });

  it("ne laisse PAS passer deux fois le quota à la bascule", () => {
    // C'est toute la raison d'être de ce module. Avec un compteur remis à zéro,
    // dix essais à la fin d'une minute et dix au début de la suivante
    // passeraient tous : vingt en quelques secondes, et une attaque par
    // dictionnaire deux fois plus rapide sans qu'on s'en aperçoive.
    //
    // Ici, une seconde après la bascule, le seau précédent compte encore pour
    // presque tout.
    const v = juger({
      precedent: 10,
      courant: 1,
      regle: REGLE,
      ecouleMs: 1_000,
    });
    expect(v.autorise).toBe(false);
  });

  it("libère progressivement à mesure que le seau précédent sort", () => {
    // À mi-fenêtre, le précédent ne compte plus que pour moitié.
    const mi = juger({
      precedent: 10,
      courant: 4,
      regle: REGLE,
      ecouleMs: 30_000,
    });
    expect(mi.autorise).toBe(true); // 10 × 0,5 + 4 = 9

    const trop = juger({
      precedent: 10,
      courant: 6,
      regle: REGLE,
      ecouleMs: 30_000,
    });
    expect(trop.autorise).toBe(false); // 10 × 0,5 + 6 = 11
  });

  it("oublie complètement le seau précédent en fin de fenêtre", () => {
    const v = juger({
      precedent: 100,
      courant: 3,
      regle: REGLE,
      ecouleMs: 60_000,
    });
    expect(v.autorise).toBe(true);
    expect(v.restant).toBe(7);
  });

  it("ne rend jamais un restant négatif", () => {
    const v = juger({ precedent: 500, courant: 500, regle: REGLE, ecouleMs: 0 });
    expect(v.restant).toBe(0);
  });

  it("annonce toujours au moins une seconde d'attente", () => {
    // Zéro dirait « reviens tout de suite », et le client bouclerait.
    const v = juger({
      precedent: 50,
      courant: 50,
      regle: REGLE,
      ecouleMs: 59_999,
    });
    expect(v.dansSecondes).toBeGreaterThanOrEqual(1);
  });
});

describe("le découpage en seaux", () => {
  it("range deux instants proches dans le même seau", () => {
    const a = seauDe(1_000_000, REGLE);
    const b = seauDe(1_000_000 + 500, REGLE);
    expect(a.seau).toBe(b.seau);
    expect(b.ecouleMs).toBe(a.ecouleMs + 500);
  });

  it("change de seau à la fenêtre suivante", () => {
    const a = seauDe(1_000_000, REGLE);
    const b = seauDe(1_000_000 + REGLE.fenetreMs, REGLE);
    expect(b.seau).toBe(a.seau + 1);
  });

  it("repart de zéro au début d'un seau", () => {
    expect(seauDe(REGLE.fenetreMs * 7, REGLE).ecouleMs).toBe(0);
  });
});

describe("la clé du compteur", () => {
  it("sépare deux règles pour un même sujet", () => {
    // Sans cela, les tentatives de connexion et les demandes d'oubli d'une même
    // adresse se compteraient ensemble, et l'une fermerait l'autre.
    expect(cleDe("connexion", "1.2.3.4", 9)).not.toBe(
      cleDe("oubli", "1.2.3.4", 9),
    );
  });

  it("sépare deux sujets, et deux seaux", () => {
    expect(cleDe("connexion", "1.2.3.4", 9)).not.toBe(
      cleDe("connexion", "5.6.7.8", 9),
    );
    expect(cleDe("connexion", "1.2.3.4", 9)).not.toBe(
      cleDe("connexion", "1.2.3.4", 10),
    );
  });
});

describe("les règles posées", () => {
  it("laissent toutes de la place à un usage honnête", () => {
    // Une règle à zéro, ou à une seconde, fermerait le service. Un test bête,
    // mais il attrape la faute de frappe qui ferme la connexion à tout le monde.
    for (const [nom, regle] of Object.entries(REGLES)) {
      expect(regle.quota, nom).toBeGreaterThanOrEqual(5);
      expect(regle.fenetreMs, nom).toBeGreaterThanOrEqual(60_000);
    }
  });

  it("laissent l'opérateur de paiement rattraper un incident", () => {
    // Un opérateur qui a accumulé des rappels pendant une panne les envoie d'un
    // coup. Les refuser coûterait des ventes ; la borne est là pour l'inconnu
    // sans signature, pas pour lui.
    expect(REGLES.rappelPaiement.quota).toBeGreaterThanOrEqual(100);
  });

  it("serrent la connexion plus que le reste", () => {
    // C'est la porte qu'on force, et la seule où le coût d'un essai raté est
    // nul pour l'attaquant.
    expect(REGLES.connexion.quota).toBeLessThan(REGLES.rappelPaiement.quota);
  });
});
