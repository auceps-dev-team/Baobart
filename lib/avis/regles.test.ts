import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { aObtenu, lireNote, lireTexte, moyenneBayesienne, noteEnToutesLettres, resumeDesNotes, type LigneObtenue } from "./regles";

const LIGNE: LigneObtenue = {
  state: "SUCCESSFUL",
  price: 2_000,
  quantity: 1,
  tipAmount: 0,
  refundedAmount: 0,
  chargebackAt: null,
  chargebackReversedAt: null,
  accessRevokedAt: null,
};

describe("qui a obtenu la ressource", () => {
  it("compte un achat encaissé, et une ressource gratuite reçue (décision du 09/11)", () => {
    expect(aObtenu([LIGNE])).toBe(true);
    expect(aObtenu([{ ...LIGNE, state: "NOT_CHARGED", price: 0 }])).toBe(true);
  });

  it("écarte un paiement qui n'a pas abouti", () => {
    expect(aObtenu([{ ...LIGNE, state: "FAILED" }])).toBe(false);
    expect(aObtenu([{ ...LIGNE, state: "IN_PROGRESS" }])).toBe(false);
    expect(aObtenu([])).toBe(false);
  });

  it("écarte ce qui ne reste plus à l'acheteur : remboursé en entier, litige ouvert, accès retiré", () => {
    expect(aObtenu([{ ...LIGNE, refundedAmount: 2_000 }])).toBe(false);
    expect(aObtenu([{ ...LIGNE, chargebackAt: new Date() }])).toBe(false);
    expect(aObtenu([{ ...LIGNE, accessRevokedAt: new Date() }])).toBe(false);
  });

  it("garde un remboursement partiel et un litige gagné", () => {
    expect(aObtenu([{ ...LIGNE, refundedAmount: 500 }])).toBe(true);
    expect(aObtenu([{ ...LIGNE, chargebackAt: new Date(), chargebackReversedAt: new Date() }])).toBe(true);
  });

  it("rend le droit à un second achat après un remboursement", () => {
    expect(aObtenu([{ ...LIGNE, refundedAmount: 2_000 }, LIGNE])).toBe(true);
  });
});

describe("ce qu'on reçoit du formulaire", () => {
  it("n'accepte qu'une note entière de 1 à 5", () => {
    expect(lireNote("4")).toBe(4);
    expect(lireNote(5)).toBe(5);
    for (const faux of ["0", "6", "3.5", "", "cinq", null, undefined, -1]) expect(lireNote(faux)).toBeNull();
  });

  it("rend un texte vide nul, et refuse un texte trop long", () => {
    expect(lireTexte("  ", 10)).toEqual({ ok: true, texte: null });
    expect(lireTexte(" bien ", 10)).toEqual({ ok: true, texte: "bien" });
    expect(lireTexte("x".repeat(11), 10)).toEqual({ ok: false, motif: "TROP_LONG" });
  });
});

describe("le résumé d'une ressource", () => {
  it("rend la moyenne au dixième et la répartition de 5 à 1", () => {
    // 1 avis à 3, 2 à 5 : (3 + 10) / 3 = 4,33… → 4,3.
    const r = resumeDesNotes([0, 0, 1, 0, 2]);
    expect(r.total).toBe(3);
    expect(r.moyenne).toBe(4.3);
    expect(r.repartition.map((x) => x.note)).toEqual([5, 4, 3, 2, 1]);
    expect(r.repartition.map((x) => x.pourcentage)).toEqual([67, 0, 33, 0, 0]);
  });

  it("rend une moyenne nulle et des parts à zéro sans avis", () => {
    const r = resumeDesNotes([0, 0, 0, 0, 0]);
    expect(r.moyenne).toBeNull();
    expect(r.repartition.every((x) => x.pourcentage === 0)).toBe(true);
  });

  it("fait toujours 100 % au total, et garde la moyenne entre 1 et 5 (fast-check)", () => {
    fc.assert(
      fc.property(fc.array(fc.nat({ max: 10_000 }), { minLength: 5, maxLength: 5 }), (etoiles) => {
        const r = resumeDesNotes(etoiles);
        const total = etoiles.reduce((s, n) => s + n, 0);
        if (total === 0) return r.moyenne === null;
        const somme = r.repartition.reduce((s, x) => s + x.pourcentage, 0);
        return somme === 100 && r.moyenne! >= 1 && r.moyenne! <= 5 && r.total === total;
      }),
    );
  });

  it("ne donne jamais plus d'un point à une part par rapport à sa valeur exacte (fast-check)", () => {
    fc.assert(
      fc.property(fc.array(fc.nat({ max: 500 }), { minLength: 5, maxLength: 5 }), (etoiles) => {
        const total = etoiles.reduce((s, n) => s + n, 0);
        if (total === 0) return true;
        return resumeDesNotes(etoiles).repartition.every((x) => Math.abs(x.pourcentage - (x.nombre * 100) / total) < 1);
      }),
    );
  });
});

describe("la moyenne bayésienne (prête, non branchée)", () => {
  it("fait passer 128 avis à 4,8 devant deux avis à 5", () => {
    const aPriori = { moyenne: 4, poids: 10 };
    const deuxCinq = moyenneBayesienne([0, 0, 0, 0, 2], aPriori)!;
    const beaucoup = moyenneBayesienne([0, 0, 0, 26, 102], aPriori)!;
    expect(beaucoup).toBeGreaterThan(deuxCinq);
  });

  it("rend la moyenne a priori sans aucun avis, et null sans rien", () => {
    expect(moyenneBayesienne([0, 0, 0, 0, 0], { moyenne: 4, poids: 10 })).toBe(4);
    expect(moyenneBayesienne([0, 0, 0, 0, 0], { moyenne: 4, poids: 0 })).toBeNull();
  });
});

describe("pour les lecteurs d'écran", () => {
  it("dit la note en toutes lettres", () => {
    expect(noteEnToutesLettres(4)).toBe("4 sur 5");
    expect(noteEnToutesLettres(4.3)).toBe("4,3 sur 5");
  });
});
