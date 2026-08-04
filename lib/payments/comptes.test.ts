import { describe, expect, it } from "vitest";

import {
  normaliserIban,
  normaliserNumero,
  verifierCompte,
} from "./comptes";

describe("normalisation d'un numéro", () => {
  it("accepte les dix façons d'écrire le même numéro", () => {
    // Refuser sur la mise en forme ferait abandonner quelqu'un qui avait
    // pourtant tapé le bon numéro.
    for (const ecriture of [
      "+221 77 000 00 01",
      "+221-77-000-00-01",
      "+221.77.000.00.01",
      "00221770000001",
      " +221770000001 ",
    ]) {
      expect(normaliserNumero(ecriture), ecriture).toBe("+221770000001");
    }
  });

  it("met l'IBAN en majuscules sans espaces", () => {
    expect(normaliserIban(" sn08 sn01 0152 0000 ")).toBe("SN08SN0101520000");
  });
});

describe("compte mobile money", () => {
  const wave = (reference: string) =>
    verifierCompte({ provider: "wave", reference });

  it("accepte un numéro avec indicatif", () => {
    expect(wave("+221 77 000 00 01")).toMatchObject({
      accepte: true,
      reference: "+221770000001",
      method: "MOBILE_MONEY",
    });
  });

  it("accepte un numéro national", () => {
    expect(wave("77 000 00 01")).toMatchObject({ accepte: true });
  });

  it("refuse ce qui n'est pas un numéro", () => {
    for (const mauvais of ["", "   ", "abcdefgh", "12345", "+221 77 ABC 00 01"]) {
      expect(wave(mauvais).accepte, mauvais).toBe(false);
    }
  });

  it("ne réclame pas le nom du titulaire", () => {
    // L'opérateur l'associe déjà au numéro : le demander serait une friction
    // pour rien.
    expect(wave("+221770000001").accepte).toBe(true);
  });

  it("refuse un rail qu'on ne propose pas", () => {
    expect(
      verifierCompte({ provider: "paypal", reference: "+221770000001" }),
    ).toMatchObject({ refus: "RAIL_INCONNU" });
  });
});

describe("compte bancaire", () => {
  const banque = (reference: string, titulaire?: string) =>
    verifierCompte({ provider: "bank", reference, titulaire });

  it("accepte un IBAN complet avec son titulaire", () => {
    expect(banque("SN08 SN01 0152 0000 1234 5678 90", "Awa Diallo")).toMatchObject({
      accepte: true,
      reference: "SN08SN010152000012345678 90".replace(/\s/g, ""),
      method: "BANK",
    });
  });

  it("refuse un IBAN trop court", () => {
    expect(banque("SN08", "Awa Diallo")).toMatchObject({
      refus: "IBAN_INVALIDE",
    });
  });

  it("réclame le nom du titulaire", () => {
    // Un écart avec le nom du compte est le premier motif de rejet d'un
    // virement : mieux vaut le demander que rejeter une semaine plus tard.
    expect(banque("SN08SN0101520000123456789012")).toMatchObject({
      refus: "TITULAIRE_MANQUANT",
    });
    expect(banque("SN08SN0101520000123456789012", " A ")).toMatchObject({
      refus: "TITULAIRE_MANQUANT",
    });
  });
});

describe("messages", () => {
  it("chaque refus explique quoi corriger", () => {
    const cas = [
      { provider: "inconnu", reference: "x" },
      { provider: "wave", reference: "" },
      { provider: "wave", reference: "pas-un-numero" },
      { provider: "bank", reference: "trop-court" },
      { provider: "bank", reference: "SN08SN0101520000123456789012" },
    ];

    for (const c of cas) {
      const v = verifierCompte(c);
      expect(v.accepte).toBe(false);
      expect((v.message ?? "").length).toBeGreaterThan(20);
    }
  });
});
