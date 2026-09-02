import { describe, expect, it } from "vitest";

import { INDICATIFS, masquer, versE164 } from "@/lib/sms/numero";
import { PAYS } from "@/lib/payments/rails";

/**
 * Un numéro mal mis en forme ne produit pas d'erreur : le SMS est facturé,
 * refusé quelque part, et l'abonné perd son accès sans avoir été prévenu. Ces
 * tests sont donc la seule chose qui montre le défaut.
 */

describe("les indicatifs", () => {
  it("couvrent exactement les pays où Baobart vend", () => {
    // Le vrai sujet du test : si quelqu'un ouvre un pays côté paiement, ses
    // abonnés doivent être joignables le même jour.
    expect(Object.keys(INDICATIFS).sort()).toEqual(
      PAYS.map((p) => p.code).sort(),
    );
  });
});

describe("versE164", () => {
  it("préfixe un numéro local de l'indicatif du pays", () => {
    expect(versE164("0700000000", "CI")).toBe("+2250700000000");
  });

  it("retire le zéro d'appel national là où c'en est un", () => {
    // Le Ghana écrit 024 xxx xxxx en local et +233 24 xxx xxxx dehors.
    expect(versE164("024 123 4567", "GH")).toBe("+233241234567");
    expect(versE164("077 123 456", "SN")).toBe("+22177123456");
  });

  it("garde le zéro là où il fait partie du numéro", () => {
    // Le piège du module. La Côte d'Ivoire est passée à dix chiffres en 2021 et
    // le zéro se compose depuis l'étranger : le retirer — la règle qu'on écrit
    // d'instinct — casserait tous les numéros de notre marché principal, sans
    // rien afficher.
    expect(versE164("07 07 07 07 07", "CI")).toBe("+2250707070707");
    expect(versE164("01 97 12 34 56", "BJ")).toBe("+2290197123456");
  });

  it("laisse tel quel un numéro déjà international", () => {
    expect(versE164("+225 07-00-00-00-00", "CI")).toBe("+2250700000000");
  });

  it("comprend la forme 00 comme un plus", () => {
    expect(versE164("00225 0700000000", "CI")).toBe("+2250700000000");
  });

  it("ne double pas l'indicatif d'un numéro qui le porte déjà sans plus", () => {
    expect(versE164("2250700000000", "CI")).toBe("+2250700000000");
  });

  it("respecte l'indicatif écrit même s'il n'est pas celui du pays du profil", () => {
    // Un Ivoirien avec un numéro sénégalais : c'est le numéro qui décide.
    expect(versE164("+221770000000", "CI")).toBe("+221770000000");
  });

  it("ignore le décor", () => {
    expect(versE164("  (07) 00.00.00-00 ", "CI")).toBe("+2250700000000");
  });

  it("refuse ce qui ne peut être un numéro pour personne", () => {
    expect(versE164("", "CI")).toBeNull();
    expect(versE164("   ", "CI")).toBeNull();
    expect(versE164("abc", "CI")).toBeNull();
    expect(versE164("12", "CI")).toBeNull();
    expect(versE164("+123456789012345678", "CI")).toBeNull();
  });

  it("refuse un numéro local quand le pays est inconnu", () => {
    // Préfixer avec un indicatif inventé enverrait le message à un inconnu.
    expect(versE164("0700000000", "XX")).toBeNull();
  });

  it("refuse un numéro qui ne serait que des zéros", () => {
    // « 00… » est lu comme un préfixe international, et aucun indicatif de
    // pays ne commence par zéro : « +0… » n'atteindra jamais personne.
    expect(versE164("0000000000", "CI")).toBeNull();
    expect(versE164("+0700000000", "CI")).toBeNull();
  });

  it("ne juge pas la longueur au-delà des bornes de la norme", () => {
    // La Côte d'Ivoire est passée à dix chiffres en 2021. Une règle par pays
    // écrite avant aurait refusé tous les numéros d'après.
    expect(versE164("0102030405", "CI")).toBe("+2250102030405");
    expect(versE164("01020304", "CI")).toBe("+22501020304");
  });
});

describe("masquer", () => {
  it("ne laisse que les quatre derniers chiffres", () => {
    expect(masquer("+2250700000012")).toBe("···· 0012");
  });

  it("ne casse pas sur une chaîne trop courte", () => {
    expect(masquer("+22")).toBe("····");
  });
});
