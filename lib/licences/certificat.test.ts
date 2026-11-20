import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  formaterLicenceCertificat,
  motifsRevocation,
  numeroCommandeCourt,
  numeroDeCertificat,
} from "./certificat";
import { CONDITIONS, LICENCE_PAR_DEFAUT } from "./conditions";

describe("numeroDeCertificat", () => {
  it("suit le format LC-AAAA-XXXXXXXX attendu par la spec", () => {
    const numero = numeroDeCertificat("cm2x9ab1200018f7k3p9q4r2s", new Date("2026-04-12T10:00:00Z"));
    expect(numero).toBe("LC-2026-3P9Q4R2S");
  });

  it("complète à 8 caractères si l'identifiant est court et reste déterministe", () => {
    const date = new Date("2026-11-01T00:15:00Z");
    const a = numeroDeCertificat("abc12", date);
    const b = numeroDeCertificat("abc12", date);
    expect(a).toBe("LC-2026-000ABC12");
    expect(b).toBe(a);
  });

  it("propriété fast-check : toujours LC-AAAA-8_ALPHANUM, déterministe et sans secret", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 40 }).filter((s) => /[a-zA-Z0-9]/.test(s)),
        fc.integer({ min: 2020, max: 2035 }),
        (id, annee) => {
          const date = new Date(Date.UTC(annee, 5, 15, 12, 0, 0));
          const res = numeroDeCertificat(id, date);
          expect(res).toMatch(new RegExp(`^LC-${annee}-[A-Z0-9]{8}$`));
          expect(numeroDeCertificat(id, date)).toBe(res);
        },
      ),
    );
  });
});

describe("numeroCommandeCourt", () => {
  it("produit le même numéro court #XXXXXX que l'historique des achats", () => {
    expect(numeroCommandeCourt("cm2x9ab1200018f7k3p9q4r2s")).toBe("#P9Q4R2S".slice(0, 1) + "9Q4R2S");
  });
});

describe("formaterLicenceCertificat", () => {
  it("utilise les conditions et libellés partagés quand un type est fourni", () => {
    const res = formaterLicenceCertificat({
      title: "Licence personnelle",
      description: "Usage privé uniquement.",
      conditions: { commercial: false, print: false, resale: false },
    });
    expect(res.titre).toBe("Licence personnelle");
    expect(res.description).toBe("Usage privé uniquement.");
    expect(res.permises).toEqual([]);
    expect(res.interdites).toEqual([
      CONDITIONS.commercial,
      CONDITIONS.print,
      CONDITIONS.resale,
    ]);
  });

  it("retombe sur la licence commerciale par défaut si le produit n'a pas de licence", () => {
    const res = formaterLicenceCertificat(null);
    expect(res.titre).toBe(LICENCE_PAR_DEFAUT);
    expect(res.permises).toEqual([CONDITIONS.commercial, CONDITIONS.print]);
    expect(res.interdites).toEqual([CONDITIONS.resale]);
  });
});

describe("motifsRevocation", () => {
  const base = {
    state: "SUCCESSFUL" as const,
    price: 5_000,
    quantity: 1,
    tipAmount: 0,
    refundedAmount: 0,
    chargebackAt: null,
    chargebackReversedAt: null,
    accessRevokedAt: null,
  };

  it("retourne aucun motif tant que l'achat reste valide (y compris remboursement partiel)", () => {
    expect(motifsRevocation(base)).toEqual([]);
    expect(motifsRevocation({ ...base, refundedAmount: 2_500 })).toEqual([]);
    expect(
      motifsRevocation({
        ...base,
        chargebackAt: new Date("2026-03-01"),
        chargebackReversedAt: new Date("2026-03-10"),
      }),
    ).toEqual([]);
  });

  it("détecte remboursement intégral (avec pourboire), contestation ouverte et accès retiré", () => {
    expect(motifsRevocation({ ...base, tipAmount: 500, refundedAmount: 5_000 })).toEqual([]);
    expect(motifsRevocation({ ...base, tipAmount: 500, refundedAmount: 5_500 })).toEqual(["remboursé"]);
    expect(motifsRevocation({ ...base, chargebackAt: new Date("2026-03-01") })).toEqual(["contesté"]);
    expect(motifsRevocation({ ...base, accessRevokedAt: new Date("2026-03-02") })).toEqual(["accès retiré"]);
  });
});
