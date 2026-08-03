import { describe, expect, it } from "vitest";

import {
  commandeTelechargeable,
  debutDuMois,
  etatCommande,
  filtreAchats,
  filtreTelechargements,
  formatsLisibles,
  libelleRepetitions,
} from "./historique";

const ligne = (p: {
  state?: string;
  price?: number;
  quantity?: number;
  refundedAmount?: number;
}) => ({
  state: p.state ?? "SUCCESSFUL",
  price: p.price ?? 10_000,
  quantity: p.quantity ?? 1,
  refundedAmount: p.refundedAmount ?? 0,
});

describe("état d'une commande", () => {
  it("annonce payée quand rien n'a été rendu", () => {
    expect(etatCommande([ligne({})])).toBe("PAYÉE");
  });

  it("distingue un remboursement partiel d'un remboursement complet", () => {
    // Sans cette distinction, l'acheteur d'un panier à deux articles dont un
    // seul a été remboursé lirait « remboursée » et appellerait le support.
    expect(etatCommande([ligne({ refundedAmount: 4_000 })])).toBe(
      "PARTIELLEMENT REMBOURSÉE",
    );
    expect(etatCommande([ligne({ refundedAmount: 10_000 })])).toBe("REMBOURSÉE");
  });

  it("raisonne sur l'ensemble des lignes, pas sur la première", () => {
    expect(
      etatCommande([ligne({}), ligne({ refundedAmount: 10_000 })]),
    ).toBe("PARTIELLEMENT REMBOURSÉE");
  });

  it("ne prend pas une commande offerte pour une commande remboursée", () => {
    // 0 F payé, 0 F rendu : le rapport n'existe pas, et « remboursée » serait
    // un contresens.
    expect(etatCommande([ligne({ state: "NOT_CHARGED", price: 0 })])).toBe(
      "PAYÉE",
    );
  });

  it("sépare l'attente de l'échec", () => {
    expect(etatCommande([ligne({ state: "IN_PROGRESS" })])).toBe("EN ATTENTE");
    expect(etatCommande([ligne({ state: "FAILED" })])).toBe("ÉCHOUÉE");
    expect(etatCommande([])).toBe("EN ATTENTE");
  });

  it("garde le droit de télécharger après un remboursement partiel", () => {
    // La ligne remboursée perd son droit, pas les autres : c'est la route de
    // téléchargement qui tranche ligne par ligne.
    expect(commandeTelechargeable("PARTIELLEMENT REMBOURSÉE")).toBe(true);
    expect(commandeTelechargeable("REMBOURSÉE")).toBe(false);
    expect(commandeTelechargeable("EN ATTENTE")).toBe(false);
  });
});

describe("filtres", () => {
  it("retient un filtre connu", () => {
    expect(filtreAchats("Payées")).toBe("Payées");
    expect(filtreTelechargements("Ce mois")).toBe("Ce mois");
  });

  it("retombe sur le filtre large plutôt que d'échouer", () => {
    // Une URL bricolée à la main ne doit pas casser la page.
    expect(filtreAchats("n'importe quoi")).toBe("Toutes");
    expect(filtreAchats(undefined)).toBe("Toutes");
    expect(filtreTelechargements("<script>")).toBe("Tous");
  });
});

describe("début du mois", () => {
  it("se cale sur le premier jour à minuit", () => {
    const d = debutDuMois(new Date(2026, 6, 18, 14, 32, 9));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it("tient sur le premier du mois lui-même", () => {
    const d = debutDuMois(new Date(2026, 0, 1, 0, 0, 1));
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });
});

describe("libellés", () => {
  it("compte les reprises comme la maquette", () => {
    expect(libelleRepetitions(1)).toBe("1 fois");
    expect(libelleRepetitions(3)).toBe("3 fois");
  });

  it("liste les formats sans doublon", () => {
    expect(formatsLisibles(["a.ai", "b.png", "c.PNG"])).toBe("AI, PNG");
  });

  it("ignore ce qui n'est pas une extension", () => {
    expect(formatsLisibles(["sans-extension", ".cache", "x.tropdlonguepourca"]))
      .toBe("");
  });

  it("rend une chaîne vide plutôt que des virgules orphelines", () => {
    expect(formatsLisibles([])).toBe("");
  });
});
