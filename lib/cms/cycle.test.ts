import { describe, expect, it } from "vitest";

import {
  LIBELLE_ETAT,
  LIBELLE_GESTE,
  appliquer,
  attendUneRelecture,
  estExpire,
  estPublic,
  gestesDepuis,
  type EtatContenu,
  type Geste,
} from "./cycle";

const ETATS = Object.keys(LIBELLE_ETAT) as EtatContenu[];
const GESTES = Object.keys(LIBELLE_GESTE) as Geste[];

describe("le chemin ordinaire d'un contenu soumis", () => {
  it("va du brouillon à la relecture, puis en ligne", () => {
    expect(appliquer("BROUILLON", "soumettre")).toEqual({ ok: true, vers: "SOUMIS" });
    expect(appliquer("SOUMIS", "publier")).toEqual({ ok: true, vers: "PUBLIE" });
  });

  it("laisse publier directement qui en a déjà le droit", () => {
    // Le chemin du blog et des événements : leur auteur porte le droit de
    // publier. L'obliger à passer par la relecture reviendrait à lui faire
    // s'auto-approuver, c'est-à-dire à faire semblant.
    expect(appliquer("BROUILLON", "publier")).toEqual({ ok: true, vers: "PUBLIE" });
  });
});

describe("ce qui n'est pas permis", () => {
  it("ne laisse pas une offre paraître sans passer par un état publié", () => {
    // La garde qui compte pour Jobs : rien ne va du brouillon au public sans
    // qu'une transition l'ait décidé.
    expect(estPublic("BROUILLON")).toBe(false);
    expect(estPublic("SOUMIS")).toBe(false);
    expect(estPublic("REFUSE")).toBe(false);
    expect(estPublic("RETIRE")).toBe(false);
    expect(estPublic("PUBLIE")).toBe(true);
  });

  it("ne laisse pas resoumettre un contenu refusé tel quel", () => {
    // Sinon on sature la file de modération en cliquant, sans rien corriger.
    expect(appliquer("REFUSE", "soumettre")).toEqual({
      ok: false,
      motif: "TRANSITION_INTERDITE",
    });
    // Le chemin existe, il passe par la correction.
    expect(appliquer("REFUSE", "reprendre")).toEqual({ ok: true, vers: "BROUILLON" });
  });

  it("ne refuse pas ce qui n'a pas été soumis", () => {
    expect(appliquer("BROUILLON", "refuser").ok).toBe(false);
    expect(appliquer("PUBLIE", "refuser").ok).toBe(false);
  });

  it("n'offre aucun chemin vers la suppression", () => {
    // Une offre frauduleuse effacée emporte la preuve de la fraude, et il n'y
    // a plus rien à montrer au plaignant.
    for (const etat of ETATS) {
      for (const geste of GESTES) {
        const suite = appliquer(etat, geste);
        if (suite.ok) expect(ETATS).toContain(suite.vers);
      }
    }
  });
});

describe("la file de modération", () => {
  it("ne contient que ce qui attend une décision", () => {
    for (const etat of ETATS) {
      expect(attendUneRelecture(etat)).toBe(etat === "SOUMIS");
    }
  });

  it("laisse retirer une soumission jamais lue", () => {
    // Le cas d'un compte suspendu : ses contenus en attente ne doivent plus
    // pouvoir paraître, même si personne ne les a encore ouverts.
    expect(appliquer("SOUMIS", "retirer")).toEqual({ ok: true, vers: "RETIRE" });
  });
});

describe("réparer un retrait", () => {
  it("remet en ligne sans repasser par la relecture", () => {
    // Ce qui a été retiré par erreur se répare d'un geste. L'audit garde les
    // deux mouvements, donc rien ne se perd.
    expect(appliquer("RETIRE", "publier")).toEqual({ ok: true, vers: "PUBLIE" });
  });
});

describe("la machine elle-même", () => {
  it("n'annonce que des gestes qui aboutissent", () => {
    // Un écran n'affiche que `gestesDepuis` : si l'un d'eux était refusé par
    // `appliquer`, le bouton existerait et ne ferait rien.
    for (const etat of ETATS) {
      for (const geste of gestesDepuis(etat)) {
        expect(appliquer(etat, geste).ok).toBe(true);
      }
    }
  });

  it("laisse chaque état atteignable", () => {
    // Un état que rien n'atteint est du code écrit pour personne.
    const atteints = new Set<EtatContenu>(["BROUILLON"]);
    for (const etat of ETATS) {
      for (const geste of gestesDepuis(etat)) {
        const suite = appliquer(etat, geste);
        if (suite.ok) atteints.add(suite.vers);
      }
    }
    for (const etat of ETATS) expect(atteints.has(etat)).toBe(true);
  });

  it("nomme chaque état et chaque geste", () => {
    for (const e of ETATS) expect(LIBELLE_ETAT[e].length).toBeGreaterThan(0);
    for (const g of GESTES) expect(LIBELLE_GESTE[g].length).toBeGreaterThan(0);
  });
});

describe("l'échéance", () => {
  const LE_2 = new Date("2026-09-02T12:00:00Z");
  const LE_1 = new Date("2026-09-01T12:00:00Z");
  const LE_3 = new Date("2026-09-03T12:00:00Z");

  it("retire du public une offre dont la date est passée", () => {
    // Sans cela, un annuaire d'offres périmées se vide de ses lecteurs plus
    // vite qu'il ne se remplit.
    expect(estPublic("PUBLIE", LE_1, LE_2)).toBe(false);
    expect(estPublic("PUBLIE", LE_3, LE_2)).toBe(true);
  });

  it("laisse passer une offre sans échéance", () => {
    // `deadline` est facultative : toutes les offres n'en ont pas.
    expect(estPublic("PUBLIE", null, LE_2)).toBe(true);
    expect(estPublic("PUBLIE", undefined, LE_2)).toBe(true);
  });

  it("expire à l'instant même, sans zone grise", () => {
    expect(estPublic("PUBLIE", LE_2, LE_2)).toBe(false);
    expect(estExpire(LE_2, LE_2)).toBe(true);
    expect(estExpire(LE_3, LE_2)).toBe(false);
  });

  it("ne ressuscite rien : une échéance lointaine ne publie pas un brouillon", () => {
    // Le piège de l'ordre des conditions. Si l'échéance était vérifiée avant
    // l'état, une offre en relecture avec une date au loin deviendrait
    // publique — c'est-à-dire visible sans avoir été lue.
    for (const etat of ["BROUILLON", "SOUMIS", "REFUSE", "RETIRE"] as const) {
      expect(estPublic(etat, LE_3, LE_2)).toBe(false);
    }
  });

  it("distingue « expirée » de « retirée » pour son auteur", () => {
    // Le public ne voit ni l'une ni l'autre. Mais l'auteur d'une offre expirée
    // doit comprendre POURQUOI elle a disparu — lui dire « retirée » lui
    // ferait croire qu'on la lui a refusée.
    expect(estExpire(LE_1, LE_2)).toBe(true);
    expect(estExpire(null, LE_2)).toBe(false);
  });
});
