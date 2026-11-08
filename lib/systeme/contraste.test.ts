import { describe, expect, it } from "vitest";

import { BLANC, ENCRE, JAUNE, LAVANDE, MAUVE, ORANGE, VERT } from "./charte";
import { encreLisible, luminance, rapportDeContraste, seuilPour } from "./contraste";

describe("le contraste WCAG", () => {
  it("retrouve les valeurs de référence : noir sur blanc 21:1, blanc sur blanc 1:1", () => {
    expect(rapportDeContraste("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(rapportDeContraste(BLANC, BLANC)).toBeCloseTo(1, 5);
  });

  it("mesure le blanc sur l'orange de la charte à 3,5:1 — insuffisant pour un petit texte", () => {
    expect(rapportDeContraste(BLANC, ORANGE)).toBeCloseTo(3.49, 1);
    expect(seuilPour(15, true)).toBe(4.5);
    expect(seuilPour(19, true)).toBe(3);
    expect(seuilPour(19, false)).toBe(4.5);
  });

  it("garde la couleur de la maquette quand elle passe, la remplace sinon", () => {
    // « ◈ » sur un jeton de 44 px : 19 px, un grand texte gras — le blanc passe.
    expect(encreLisible(ORANGE, BLANC, 19)).toBe(BLANC);
    // « 1K » sur le même jeton : 15 px — l'encre le remplace.
    expect(encreLisible(ORANGE, BLANC, 15)).toBe(ENCRE);
  });

  it("laisse passer chaque fond de jeton avec son encre à toutes les tailles utilisées", () => {
    for (const fond of [JAUNE, LAVANDE, MAUVE, VERT, ORANGE]) {
      for (const taille of [8, 13, 15, 19, 24]) {
        const encre = encreLisible(fond, ENCRE, taille);
        expect(rapportDeContraste(encre, fond)).toBeGreaterThanOrEqual(seuilPour(taille, true));
      }
    }
    // Le jaune sur l'encre (« Créateur du mois », « VIP »).
    expect(rapportDeContraste(JAUNE, ENCRE)).toBeGreaterThanOrEqual(4.5);
  });

  it("rend la date de fin du titre lisible sur blanc", () => {
    expect(rapportDeContraste("#B4471A", BLANC)).toBeGreaterThanOrEqual(4.5);
  });
});

// Ajoutés le 08/11/2026 après le premier passage de Stryker.
describe("ce que Stryker a trouvé de non vérifié", () => {
  it("traite les canaux très sombres par la branche linéaire de sRGB", () => {
    // #050505 : chaque canal sous 0,04045 → 5/255/12,92.
    expect(luminance("#050505")).toBeCloseTo(5 / 255 / 12.92, 8);
    expect(luminance("#0B0B0B")).toBeCloseTo(((11 / 255 + 0.055) / 1.055) ** 2.4, 8);
  });

  it("refuse une couleur qui n'est pas #RRGGBB", () => {
    for (const faux of ["#FFF", "FFD84A", "#GGGGGG", "#FFD84A00", " #FFD84A"]) {
      expect(() => luminance(faux)).toThrow(/couleur illisible/);
    }
  });

  it("place les seuils de « grand texte » exactement où WCAG les met", () => {
    expect(seuilPour(24, false)).toBe(3);
    expect(seuilPour(23.9, false)).toBe(4.5);
    expect(seuilPour(18.66, true)).toBe(3);
    expect(seuilPour(18.6, true)).toBe(4.5);
  });

  it("garde une encre exactement au seuil, et choisit le blanc sur un fond sombre", () => {
    // Le gris #767676 sur blanc vaut 4,54:1, juste au-dessus du seuil.
    expect(encreLisible(BLANC, "#767676", 12)).toBe("#767676");
    expect(encreLisible(BLANC, "#777777", 12)).toBe(ENCRE);
    expect(encreLisible("#1A1A40", "#2A2A60", 12)).toBe(BLANC);
  });
});
