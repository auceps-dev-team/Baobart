import { describe, expect, it } from "vitest";

import {
  BAREME_XOF,
  computeFees,
  minimumViablePrice,
  partDuCreateur,
  partProportionnelle,
  type FeeSchedule,
} from "./fees";

describe("la part du créateur, telle que le site l'annonce", () => {
  it("dit ce que computeFees crédite vraiment, frais d'opérateur compris", () => {
    // Mesuré le 25/09 (Qualitytest S-90pc) : 10 000 F → 8 850 F crédités.
    // L'accueil et l'inscription annonçaient pourtant « 90 % ».
    const vente = computeFees({ unitPrice: 10_000 });
    const dire = (net: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(net / 100)} %`;

    expect(partDuCreateur()).toBe(dire(vente.sellerNet));
    expect(partDuCreateur()).toBe("88,5 %");
  });
});

describe("computeFees — une seule commission", () => {
  it("prélève 10 % de commission et 1,5 % de passerelle", () => {
    const f = computeFees({ unitPrice: 10_000 });

    expect(f.gross).toBe(10_000);
    expect(f.platformFee).toBe(1_000); // 10 %
    expect(f.processorFee).toBe(150); // 1,5 %
    expect(f.sellerNet).toBe(8_850);
  });

  it("multiplie par la quantité", () => {
    const f = computeFees({ unitPrice: 5_000, quantity: 3 });

    expect(f.gross).toBe(15_000);
    expect(f.platformFee).toBe(1_500);
    expect(f.sellerNet).toBe(15_000 - 1_500 - 225);
  });
});

describe("le barème — une commission, qui que soit celui qui amène l'acheteur", () => {
  it("n'a qu'un taux de commission, et il vaut 10 %", () => {
    // Décision du 10/10/2026 : le régime « découverte » (30 % quand Baobart
    // amène l'acheteur) est retiré. Il n'avait jamais été appliqué, mais il
    // attendait dans le barème et un audit l'a lu comme la règle. Figer le
    // barème entier fait tomber ce test si un second taux revient.
    expect(BAREME_XOF).toEqual({
      commissionBp: 1_000,
      processorRateBp: 150,
      fixedFee: 0,
      processorFixedFee: 0,
    });
  });
});

describe("computeFees — produit gratuit", () => {
  it("ne prélève rien du tout", () => {
    const f = computeFees({ unitPrice: 0 });

    expect(f.gross).toBe(0);
    expect(f.platformFee).toBe(0);
    expect(f.processorFee).toBe(0);
    expect(f.sellerNet).toBe(0);
  });

  it("reste gratuit même avec une part fixe au barème", () => {
    const bareme: FeeSchedule = { ...BAREME_XOF, fixedFee: 100 };
    const f = computeFees({ unitPrice: 0, schedule: bareme });

    expect(f.platformFee).toBe(0);
    expect(f.sellerNet).toBe(0);
  });
});

describe("computeFees — affiliation", () => {
  it("verse à l'affilié son pourcentage du brut, moins sa quote-part de commission", () => {
    const f = computeFees({
      unitPrice: 10_000,
      affiliateBasisPoints: 1_000, // 10 %
    });

    // 10 % de 10 000 = 1 000, moins 10 % de la commission (1 000) = 100
    expect(f.affiliateCredit).toBe(900);
    expect(f.sellerNet).toBe(10_000 - 1_000 - 150 - 900);
  });

  it("verse le pourcentage plein quand le vendeur absorbe la quote-part", () => {
    const f = computeFees({
      unitPrice: 10_000,
      affiliateBasisPoints: 1_000,
      sellerBearsAffiliateFee: true,
    });

    expect(f.affiliateCredit).toBe(1_000);
    expect(f.sellerNet).toBe(10_000 - 1_000 - 150 - 1_000);
  });

  it("ne verse rien sans affilié", () => {
    expect(computeFees({ unitPrice: 10_000 }).affiliateCredit)
      .toBe(0);
  });
});

describe("computeFees — la taxe n'appartient pas au vendeur", () => {
  it("s'ajoute à ce que paie l'acheteur sans toucher au net vendeur", () => {
    const sansTaxe = computeFees({ unitPrice: 10_000 });
    const avecTaxe = computeFees({
      unitPrice: 10_000,
      taxAmount: 1_800,
    });

    expect(avecTaxe.buyerTotal).toBe(11_800);
    expect(avecTaxe.sellerNet).toBe(sansTaxe.sellerNet);
  });
});

describe("computeFees — invariante comptable", () => {
  const cas = [0, 1, 99, 500, 1_000, 3_333, 10_000, 180_000, 1_000_000];
  const affiliations = [0, 500, 1_000, 2_500, 10_000];

  it("brut = net vendeur + commission + passerelle + affiliation, sans exception", () => {
    for (const unitPrice of cas) {
      for (const affiliateBasisPoints of affiliations) {
        const f = computeFees({ unitPrice, affiliateBasisPoints });

        expect(
          f.sellerNet + f.platformFee + f.processorFee + f.affiliateCredit,
          `${unitPrice} @ ${affiliateBasisPoints}bp`,
        ).toBe(f.gross);
      }
    }
  });

  it("ne produit que des entiers", () => {
    const f = computeFees({
      unitPrice: 3_333,
      quantity: 7,
      affiliateBasisPoints: 1_234,
    });

    for (const [cle, valeur] of Object.entries(f)) {
      if (typeof valeur === "number") {
        expect(Number.isInteger(valeur), `${cle} = ${valeur}`).toBe(true);
      }
    }
  });
});

describe("computeFees — entrées invalides", () => {
  it("refuse un montant décimal (une fraction de FCFA n'existe pas)", () => {
    expect(() => computeFees({ unitPrice: 1_000.5 })).toThrow(
      TypeError,
    );
  });

  it("refuse un prix négatif", () => {
    expect(() => computeFees({ unitPrice: -1 })).toThrow(
      RangeError,
    );
  });

  it("refuse une quantité nulle", () => {
    expect(() =>
      computeFees({ unitPrice: 1_000, quantity: 0 }),
    ).toThrow(RangeError);
  });

  it("refuse une part d'affilié supérieure à 100 %", () => {
    expect(() =>
      computeFees({
        unitPrice: 1_000,
        affiliateBasisPoints: 10_001,
      }),
    ).toThrow(RangeError);
  });
});

describe("minimumViablePrice", () => {
  it("vaut zéro tant qu'aucune part fixe n'est au barème", () => {
    expect(minimumViablePrice()).toBe(0);
  });

  it("garantit un net vendeur positif dès qu'une part fixe existe", () => {
    const bareme: FeeSchedule = {
      ...BAREME_XOF,
      fixedFee: 100,
      processorFixedFee: 50,
    };
    const plancher = minimumViablePrice(bareme);

    expect(plancher).toBeGreaterThan(0);
    expect(
      computeFees({ unitPrice: plancher, schedule: bareme })
        .sellerNet,
    ).toBeGreaterThanOrEqual(0);
    expect(
      computeFees({ unitPrice: plancher - 1, schedule: bareme })
        .sellerNet,
    ).toBeLessThan(0);
  });
});

describe("répartition proportionnelle sur remboursements successifs", () => {
  it("rend la part entière sur un remboursement intégral", () => {
    expect(
      partProportionnelle({ brut: 10_000, part: 8_500, dejaRembourse: 0, montant: 10_000 }),
    ).toBe(8_500);
  });

  it("rend la moitié de la part sur la moitié du brut", () => {
    expect(
      partProportionnelle({ brut: 10_000, part: 8_500, dejaRembourse: 0, montant: 5_000 }),
    ).toBe(4_250);
  });

  it("ne rend rien quand la ligne était offerte", () => {
    expect(
      partProportionnelle({ brut: 0, part: 0, dejaRembourse: 0, montant: 0 }),
    ).toBe(0);
  });

  it("ne rend jamais plus que la part, même si le cumul dépasse", () => {
    const p = partProportionnelle({
      brut: 10_000,
      part: 8_500,
      dejaRembourse: 9_000,
      montant: 5_000,
    });
    expect(p).toBe(8_500 - Math.round((9_000 * 8_500) / 10_000));
  });

  it("une suite de remboursements partiels rend exactement la part, jamais un franc de plus", () => {
    // Le défaut anticipé : un arrondi par remboursement fait payer au créateur
    // la monnaie d'une division. Un franc n'est rien ; un franc pris sans
    // raison est un défaut.
    const cas: Array<{ brut: number; part: number; parts: number[] }> = [
      { brut: 10_000, part: 8_500, parts: [3_333, 3_333, 3_334] },
      { brut: 7_777, part: 6_611, parts: [1_111, 2_222, 4_444] },
      { brut: 999, part: 849, parts: [333, 333, 333] },
      { brut: 3, part: 2, parts: [1, 1, 1] },
      { brut: 15_000, part: 10_500, parts: [1, 14_998, 1] },
      { brut: 100, part: 71, parts: Array.from({ length: 100 }, () => 1) },
    ];

    for (const { brut, part, parts } of cas) {
      let cumul = 0;
      let rendu = 0;

      for (const montant of parts) {
        rendu += partProportionnelle({ brut, part, dejaRembourse: cumul, montant });
        cumul += montant;
      }

      expect(cumul, `${brut}/${part}`).toBe(brut);
      expect(rendu, `${brut}/${part}`).toBe(part);
    }
  });

  it("chaque part reste positive ou nulle", () => {
    for (let brut = 1; brut <= 60; brut += 1) {
      for (let valeur = 0; valeur <= brut; valeur += 1) {
        let cumul = 0;
        while (cumul < brut) {
          const montant = Math.min(7, brut - cumul);
          const rendue = partProportionnelle({
            brut,
            part: valeur,
            dejaRembourse: cumul,
            montant,
          });
          expect(rendue, `${brut}/${valeur}@${cumul}`).toBeGreaterThanOrEqual(0);
          cumul += montant;
        }
      }
    }
  });
});
