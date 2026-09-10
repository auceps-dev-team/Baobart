/**
 * Les phases d'un événement, et la porte des inscriptions.
 *
 * ─────────────────────────────────────────────────────────────────
 * CE QUE CES TESTS ENGAGENT
 *
 *   — la phase se déduit des dates, jamais d'une colonne : le même événement
 *     rend trois réponses différentes selon l'instant qu'on lui donne ;
 *   — les bornes ne laissent pas de trou : à la seconde du début il est en
 *     cours, à celle de la fin il est terminé ;
 *   — on s'inscrit encore PENDANT — une expo dure deux semaines — mais pas
 *     après ;
 *   — l'ordre des refus : « déjà inscrit » passe avant « complet », parce que
 *     sur un événement plein les deux sont vrais et seul le premier aide.
 */

import { describe, expect, it } from "vitest";

import {
  peutSInscrire,
  phaseDe,
  placesRestantes,
  type EtatInscription,
} from "@/lib/evenements/phases";

const DEBUT = new Date("2026-10-10T14:00:00Z");
const FIN = new Date("2026-10-24T18:00:00Z");

function etat(over: Partial<EtatInscription> = {}): EtatInscription {
  return {
    etat: "PUBLIE",
    annuleLe: null,
    debut: DEBUT,
    fin: FIN,
    capacite: null,
    inscrits: 0,
    dejaInscrit: false,
    ...over,
  };
}

describe("phaseDe", () => {
  it("rend À_VENIR avant le début", () => {
    expect(phaseDe(DEBUT, FIN, new Date("2026-10-09T23:59:59Z"))).toBe("A_VENIR");
  });

  it("rend EN_COURS à la seconde du début", () => {
    // Borne inclusive : sans elle, un événement qui commence à 14 h ne serait
    // ni à venir ni en cours à 14 h pile.
    expect(phaseDe(DEBUT, FIN, DEBUT)).toBe("EN_COURS");
  });

  it("rend EN_COURS entre les deux — une expo dure deux semaines", () => {
    expect(phaseDe(DEBUT, FIN, new Date("2026-10-17T12:00:00Z"))).toBe("EN_COURS");
  });

  it("rend TERMINE à la seconde de la fin", () => {
    // Borne exclusive, symétrique de la précédente.
    expect(phaseDe(DEBUT, FIN, FIN)).toBe("TERMINE");
  });

  it("rend TERMINE après la fin", () => {
    expect(phaseDe(DEBUT, FIN, new Date("2026-11-01T00:00:00Z"))).toBe("TERMINE");
  });
});

describe("peutSInscrire", () => {
  const avant = new Date("2026-10-01T10:00:00Z");
  const pendant = new Date("2026-10-17T12:00:00Z");
  const apres = new Date("2026-11-01T10:00:00Z");

  it("accepte avant le début", () => {
    expect(peutSInscrire(etat(), avant)).toEqual({ ok: true });
  });

  it("accepte PENDANT — c'est la fin qui ferme, pas le début", () => {
    expect(peutSInscrire(etat(), pendant)).toEqual({ ok: true });
  });

  it("refuse après la fin", () => {
    expect(peutSInscrire(etat(), apres)).toEqual({ ok: false, motif: "TERMINE" });
  });

  it("refuse un brouillon", () => {
    expect(peutSInscrire(etat({ etat: "BROUILLON" }), avant)).toEqual({
      ok: false,
      motif: "INTROUVABLE",
    });
  });

  it("refuse un événement retiré", () => {
    expect(peutSInscrire(etat({ etat: "RETIRE" }), avant)).toEqual({
      ok: false,
      motif: "INTROUVABLE",
    });
  });

  it("refuse un événement annulé, et le dit autrement que « introuvable »", () => {
    // Un annulé reste VISIBLE — les inscrits doivent comprendre. Le confondre
    // avec un retrait les laisserait devant une page absente, sans explication.
    expect(peutSInscrire(etat({ annuleLe: new Date("2026-10-02") }), avant)).toEqual({
      ok: false,
      motif: "ANNULE",
    });
  });

  it("refuse quand le plafond est atteint", () => {
    expect(peutSInscrire(etat({ capacite: 50, inscrits: 50 }), avant)).toEqual({
      ok: false,
      motif: "COMPLET",
    });
  });

  it("refuse aussi si le compteur a dépassé le plafond", () => {
    // Un plafond abaissé après coup. Le refus doit tenir quand même.
    expect(peutSInscrire(etat({ capacite: 50, inscrits: 61 }), avant)).toEqual({
      ok: false,
      motif: "COMPLET",
    });
  });

  it("accepte tant qu'il reste une place", () => {
    expect(peutSInscrire(etat({ capacite: 50, inscrits: 49 }), avant)).toEqual({
      ok: true,
    });
  });

  it("accepte sans plafond, quel que soit le nombre d'inscrits", () => {
    expect(peutSInscrire(etat({ capacite: null, inscrits: 5000 }), avant)).toEqual({
      ok: true,
    });
  });

  it("dit « déjà inscrit » plutôt que « complet » sur un événement plein", () => {
    // Les deux sont vrais. Seul le premier renseigne la personne.
    expect(
      peutSInscrire(etat({ capacite: 50, inscrits: 50, dejaInscrit: true }), avant),
    ).toEqual({ ok: false, motif: "DEJA_INSCRIT" });
  });

  it("dit « annulé » plutôt que « déjà inscrit »", () => {
    // Ce qui est définitif passe devant ce qui ne l'est pas.
    expect(
      peutSInscrire(etat({ annuleLe: new Date("2026-10-02"), dejaInscrit: true }), avant),
    ).toEqual({ ok: false, motif: "ANNULE" });
  });
});

describe("placesRestantes", () => {
  it("rend null sans plafond — une absence, pas un grand nombre", () => {
    expect(placesRestantes(null, 120)).toBeNull();
  });

  it("compte ce qui reste", () => {
    expect(placesRestantes(50, 12)).toBe(38);
  });

  it("ne descend jamais sous zéro", () => {
    // Un plafond abaissé après coup afficherait « -11 places ».
    expect(placesRestantes(50, 61)).toBe(0);
  });
});
