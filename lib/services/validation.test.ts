/**
 * Ce qu'une saisie doit franchir pour aboutir en base.
 *
 * ─────────────────────────────────────────────────────────────────
 * QUATRE CHOSES QUE LE MODULE ENGAGE
 *
 *   — les bornes sont des nombres, pas des mots ;
 *   — le prix a un plancher (< 1 000 F : les frais mangent tout) et un plafond
 *     symbolique qui attrape un zéro de trop ;
 *   — la catégorie est obligatoire — une prestation sans catégorie ne se
 *     trouve dans aucun filtre ;
 *   — la valeur qui sort est déjà lavée : `trim`, espaces normalisées.
 */

import { describe, expect, it } from "vitest";

import { valider } from "@/lib/services/validation";

const SAISIE_OK = {
  titre: "Charte graphique complète en 10 jours",
  description:
    "Livraison en dix jours ouvrés. Comprend l'atelier de cadrage, trois pistes, deux allers-retours, un manuel d'usage PDF.",
  categoryId: "cat-identite-visuelle",
  startingPrice: "180000",
  deliveryDays: "10",
};

describe("valider une offre de service", () => {
  it("accepte une saisie complète et nettoyée", () => {
    const v = valider({ ...SAISIE_OK, titre: "  Charte   graphique  " });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.offre.titre).toBe("Charte graphique");
    expect(v.offre.startingPrice).toBe(180_000);
    expect(v.offre.deliveryDays).toBe(10);
  });

  it("refuse un titre trop court", () => {
    const v = valider({ ...SAISIE_OK, titre: "Char" });
    expect(v).toEqual({
      ok: false,
      refus: { champ: "titre", message: expect.stringMatching(/intitulé/i) },
    });
  });

  it("refuse une description trop courte", () => {
    const v = valider({ ...SAISIE_OK, description: "je fais tout" });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("description");
  });

  it("refuse une catégorie vide", () => {
    const v = valider({ ...SAISIE_OK, categoryId: "  " });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("categoryId");
  });

  it("refuse un prix en dessous du plancher", () => {
    // 500 F payés par mobile money coûtent plus en frais que la prestation.
    const v = valider({ ...SAISIE_OK, startingPrice: "500" });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("startingPrice");
  });

  it("refuse un prix qui a un zéro de trop", () => {
    // 500 000 000 F, presque un million d'euros — probable saisie fantaisiste.
    const v = valider({ ...SAISIE_OK, startingPrice: "500000000" });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("startingPrice");
  });

  it("refuse un prix qui n'est pas un nombre", () => {
    const v = valider({ ...SAISIE_OK, startingPrice: "à débattre" });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("startingPrice");
  });

  it("refuse un délai en jours nul ou négatif", () => {
    const v = valider({ ...SAISIE_OK, deliveryDays: "0" });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("deliveryDays");
  });

  it("refuse un délai supérieur à un an", () => {
    const v = valider({ ...SAISIE_OK, deliveryDays: "500" });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("deliveryDays");
  });

  it("normalise les espaces internes du titre", () => {
    const v = valider({ ...SAISIE_OK, titre: "Motion  \n\t design   pour   YouTube" });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.offre.titre).toBe("Motion design pour YouTube");
  });

  it("laisse la description telle quelle (juste trimée)", () => {
    // On ne touche pas aux retours à la ligne : la mise en forme est portée
    // par la fiche, pas retirée à l'entrée.
    const desc =
      "Ligne 1 : la mission\n\nLigne 2 : le rendu. La description doit rester\nformattée pour être lisible côté acheteur.\n";
    const v = valider({ ...SAISIE_OK, description: desc });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.offre.description).toBe(desc.trim());
  });
});
