import { describe, expect, it } from "vitest";

import { DELAIS, delaiValide, eligibilite, libelleDelai, passeAuSupportLe, type FaitsAchat } from "./regles";

const JOUR = 86_400_000;
const paye = new Date("2026-10-01T10:00:00Z");
const base: FaitsAchat = { etat: "SUCCESSFUL", paye: 5_000, rembourse: 0, conteste: false, delaiJours: 30, payeLe: paye, dejaDemande: false };

describe("l'éligibilité d'un achat au remboursement", () => {
  it("vaut jusqu'au bout du délai, et pas une seconde de plus", () => {
    expect(eligibilite(base, new Date(paye.getTime() + 30 * JOUR))).toEqual({ ok: true, jusquA: new Date(paye.getTime() + 30 * JOUR) });
    expect(eligibilite(base, new Date(paye.getTime() + 30 * JOUR + 1))).toEqual({ ok: false, motif: "DELAI_DEPASSE" });
  });

  it("refuse ce qui n'a pas été payé, ce qui était offert, ce qui est déjà rendu", () => {
    expect(eligibilite({ ...base, etat: "IN_PROGRESS" }, paye)).toEqual({ ok: false, motif: "NON_PAYE" });
    expect(eligibilite({ ...base, etat: "NOT_CHARGED" }, paye)).toEqual({ ok: false, motif: "GRATUIT" });
    expect(eligibilite({ ...base, rembourse: 5_000 }, paye)).toEqual({ ok: false, motif: "DEJA_REMBOURSE" });
    expect(eligibilite({ ...base, dejaDemande: true }, paye)).toEqual({ ok: false, motif: "DEJA_DEMANDE" });
  });

  it("ne rembourse pas en plus un paiement contesté à la banque", () => {
    // Les conditions de Gumroad, §7.2 b : la banque tranche, pas nous en double.
    expect(eligibilite({ ...base, conteste: true }, paye)).toEqual({ ok: false, motif: "CONTESTE" });
  });

  it("respecte le « aucun remboursement » du créateur", () => {
    expect(eligibilite({ ...base, delaiJours: 0 }, paye)).toEqual({ ok: false, motif: "SANS_REMBOURSEMENT" });
  });
});

describe("le délai et ses mots", () => {
  it("ne vaut que dans la liste fermée", () => {
    expect(DELAIS).toEqual([0, 7, 14, 30]);
    expect(delaiValide(14)).toBe(true);
    expect(delaiValide(183)).toBe(false);
  });

  it("se dit sur la fiche, et passe au support après sept jours", () => {
    expect(libelleDelai(0)).toBe("aucun remboursement");
    expect(libelleDelai(14)).toBe("remboursable sous 14 jours");
    expect(passeAuSupportLe(paye).getTime() - paye.getTime()).toBe(7 * JOUR);
  });
});
