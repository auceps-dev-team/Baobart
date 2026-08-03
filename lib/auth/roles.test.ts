import { describe, expect, it } from "vitest";

import { deduireProgression } from "./roles";

const compte = (
  produits: number,
  produitsPublies: number,
  ecrituresAuGrandLivre = 0,
) => deduireProgression({ produits, produitsPublies, ecrituresAuGrandLivre });

describe("les trois paliers", () => {
  it("un compte neuf est un acheteur", () => {
    expect(compte(0, 0).etape).toBe("ACHETEUR");
  });

  it("créer un brouillon ouvre l'atelier, pas la boutique", () => {
    const p = compte(1, 0);

    expect(p.etape).toBe("ATELIER");
    expect(p.aDesProduits).toBe(true);
    expect(p.aPublie).toBe(false);
  });

  it("publier ouvre la boutique", () => {
    expect(compte(1, 1).etape).toBe("BOUTIQUE");
  });

  it("plusieurs brouillons ne valent pas une publication", () => {
    expect(compte(5, 0).etape).toBe("ATELIER");
  });
});

describe("le profil public", () => {
  it("n'existe pas tant que rien n'est publié", () => {
    expect(compte(0, 0).profilPublicVisible).toBe(false);
    expect(compte(3, 0).profilPublicVisible).toBe(false);
  });

  it("apparaît à la première publication", () => {
    expect(compte(1, 1).profilPublicVisible).toBe(true);
  });
});

describe("la régression", () => {
  it("supprimer son unique brouillon ramène à l'état acheteur", () => {
    expect(compte(1, 0).etape).toBe("ATELIER");
    expect(compte(0, 0).etape).toBe("ACHETEUR");
  });

  it("dépublier ramène à l'atelier tant qu'il n'y a rien eu à vendre", () => {
    expect(compte(1, 0).etape).toBe("ATELIER");
  });

  it("mais l'historique bloque toute régression", () => {
    // Quelqu'un qui a vendu puis tout retiré garde sa boutique : lui masquer
    // « Gains » alors qu'on lui doit de l'argent serait une faute.
    const p = compte(0, 0, 12);

    expect(p.etape).toBe("BOUTIQUE");
    expect(p.aUnHistorique).toBe(true);
  });

  it("l'historique l'emporte même sans aucun produit restant", () => {
    expect(compte(0, 0, 1).etape).toBe("BOUTIQUE");
  });

  it("le profil public suit la publication, pas l'historique", () => {
    // Plus rien de publié : la vitrine se referme, même si les gains restent
    // consultables.
    const p = compte(0, 0, 12);

    expect(p.etape).toBe("BOUTIQUE");
    expect(p.profilPublicVisible).toBe(false);
  });
});
