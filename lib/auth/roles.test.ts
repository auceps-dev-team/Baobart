import { describe, expect, it } from "vitest";

import { deduireCapacites } from "./roles";

/**
 * La règle vérifiée dans `user.rb#is_buyer?` : on est acheteur quand on a
 * acheté SANS jamais publier. Publier fait basculer, quoi qu'on ait déclaré.
 */

describe("dérivation des capacités", () => {
  it("un compte neuf n'est ni l'un ni l'autre", () => {
    const c = deduireCapacites({
      produitsPublies: 0,
      achatsReussis: 0,
      intention: "ACHETEUR",
    });

    expect(c.estCreateur).toBe(false);
    expect(c.estAcheteur).toBe(false);
  });

  it("acheter sans publier fait l'acheteur", () => {
    const c = deduireCapacites({
      produitsPublies: 0,
      achatsReussis: 3,
      intention: "ACHETEUR",
    });

    expect(c).toMatchObject({ estAcheteur: true, estCreateur: false });
  });

  it("publier fait le créateur", () => {
    const c = deduireCapacites({
      produitsPublies: 1,
      achatsReussis: 0,
      intention: "ACHETEUR",
    });

    expect(c).toMatchObject({ estCreateur: true, estAcheteur: false });
  });

  it("publier ET acheter : on n'est plus « acheteur » au sens de Gumroad", () => {
    // La définition est exclusive : `!links.exists? && purchases.exists?`.
    const c = deduireCapacites({
      produitsPublies: 2,
      achatsReussis: 5,
      intention: "ACHETEUR",
    });

    expect(c.estCreateur).toBe(true);
    expect(c.estAcheteur).toBe(false);
  });
});

describe("vue par défaut", () => {
  it("suit l'intention déclarée tant que rien n'a été publié", () => {
    expect(
      deduireCapacites({
        produitsPublies: 0,
        achatsReussis: 0,
        intention: "CREATEUR",
      }).vueParDefaut,
    ).toBe("createur");

    expect(
      deduireCapacites({
        produitsPublies: 0,
        achatsReussis: 0,
        intention: "ACHETEUR",
      }).vueParDefaut,
    ).toBe("acheteur");
  });

  it("le fait l'emporte sur l'intention", () => {
    // Quelqu'un inscrit « acheteur » qui publie doit voir sa boutique, pas un
    // tableau de bord qui ignore ses ventes.
    expect(
      deduireCapacites({
        produitsPublies: 1,
        achatsReussis: 0,
        intention: "ACHETEUR",
      }).vueParDefaut,
    ).toBe("createur");
  });

  it("l'intention ne donne aucune capacité", () => {
    const c = deduireCapacites({
      produitsPublies: 0,
      achatsReussis: 0,
      intention: "CREATEUR",
    });

    // Se déclarer créateur ne suffit pas : il faut avoir publié.
    expect(c.estCreateur).toBe(false);
  });
});
