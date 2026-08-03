import { describe, expect, it } from "vitest";

import {
  COMMENTAIRE_MAX,
  compteurApresBascule,
  ilYA,
  peutRetirerCommentaire,
  verifierCommentaire,
  verifierSuivi,
} from "./regles";

describe("commentaire", () => {
  it("accepte un commentaire ordinaire et rend le corps nettoyé", () => {
    const v = verifierCommentaire({ corps: "  Superbe travail sur les motifs.  " });
    expect(v.accepte).toBe(true);
    expect(v.corps).toBe("Superbe travail sur les motifs.");
  });

  it("refuse le vide et l'espace seul", () => {
    expect(verifierCommentaire({ corps: "" })).toMatchObject({ refus: "VIDE" });
    expect(verifierCommentaire({ corps: "   \n\n  " })).toMatchObject({
      refus: "VIDE",
    });
  });

  it("refuse un caractère isolé", () => {
    expect(verifierCommentaire({ corps: "?" })).toMatchObject({
      refus: "TROP_COURT",
    });
  });

  it("plafonne la longueur", () => {
    expect(
      verifierCommentaire({ corps: "a".repeat(COMMENTAIRE_MAX + 1) }),
    ).toMatchObject({ refus: "TROP_LONG" });
    expect(
      verifierCommentaire({ corps: "a".repeat(COMMENTAIRE_MAX) }),
    ).toMatchObject({ accepte: true });
  });

  it("ramène les lignes vides en série à deux", () => {
    // Trente retours à la ligne pour occuper l'écran est un abus, pas une
    // mise en forme.
    const v = verifierCommentaire({ corps: "Un\n\n\n\n\n\ndeux" });
    expect(v.corps).toBe("Un\n\ndeux");
  });

  it("autorise une réponse, pas une réponse à une réponse", () => {
    expect(
      verifierCommentaire({ corps: "D'accord avec toi.", profondeurParent: 0 }),
    ).toMatchObject({ accepte: true });

    expect(
      verifierCommentaire({ corps: "Moi aussi.", profondeurParent: 1 }),
    ).toMatchObject({ refus: "TROP_PROFOND" });
  });

  it("traite l'absence de parent comme une racine", () => {
    expect(
      verifierCommentaire({ corps: "À la racine.", profondeurParent: null }),
    ).toMatchObject({ accepte: true });
  });

  it("donne toujours un message lisible avec un refus", () => {
    const v = verifierCommentaire({ corps: "" });
    expect((v.message ?? "").length).toBeGreaterThan(10);
  });
});

describe("retrait d'un commentaire", () => {
  const base = { auteurId: "auteur", proprietaireId: "createur" };

  it("laisse l'auteur retirer le sien", () => {
    expect(peutRetirerCommentaire({ ...base, userId: "auteur" })).toBe(true);
  });

  it("laisse le créateur retirer ce qui est sur sa vitrine", () => {
    // Sans ça, un créateur ne pourrait pas retirer une insulte de sa propre
    // fiche et devrait attendre une modération qui n'existe pas.
    expect(peutRetirerCommentaire({ ...base, userId: "createur" })).toBe(true);
  });

  it("refuse à un tiers", () => {
    expect(peutRetirerCommentaire({ ...base, userId: "passant" })).toBe(false);
  });
});

describe("suivi", () => {
  it("accepte de suivre quelqu'un d'autre", () => {
    expect(verifierSuivi({ suiveurId: "a", suiviId: "b" })).toMatchObject({
      accepte: true,
    });
  });

  it("refuse de se suivre soi-même", () => {
    expect(verifierSuivi({ suiveurId: "a", suiviId: "a" })).toMatchObject({
      accepte: false,
      refus: "SOI_MEME",
    });
  });

  it("refuse une cible vide", () => {
    expect(verifierSuivi({ suiveurId: "a", suiviId: "" })).toMatchObject({
      accepte: false,
    });
  });
});

describe("compteur dénormalisé", () => {
  it("monte et descend", () => {
    expect(compteurApresBascule(4, true)).toBe(5);
    expect(compteurApresBascule(4, false)).toBe(3);
  });

  it("ne passe jamais sous zéro", () => {
    // Un compteur qui a dérivé afficherait « −1 j'aime » : le bug serait
    // signalé au visiteur plutôt qu'au développeur.
    expect(compteurApresBascule(0, false)).toBe(0);
    expect(compteurApresBascule(-3, false)).toBe(0);
  });
});

describe("temps relatif", () => {
  const t = new Date(2026, 7, 3, 12, 0, 0);

  it("dit les minutes, les heures, les jours", () => {
    expect(ilYA(new Date(2026, 7, 3, 11, 59, 30), t)).toBe("à l'instant");
    expect(ilYA(new Date(2026, 7, 3, 11, 30, 0), t)).toBe("il y a 30 min");
    expect(ilYA(new Date(2026, 7, 3, 10, 0, 0), t)).toBe("il y a 2 h");
    expect(ilYA(new Date(2026, 6, 31, 12, 0, 0), t)).toBe("il y a 3 j");
  });

  it("passe à la date au-delà d'une semaine", () => {
    // « il y a 34 j » ne dit plus rien à personne.
    const vieux = ilYA(new Date(2026, 5, 30, 12, 0, 0), t);
    expect(vieux).not.toMatch(/il y a/);
    expect(vieux).toMatch(/juin/);
  });

  it("précise l'année quand elle change", () => {
    expect(ilYA(new Date(2025, 10, 2, 12, 0, 0), t)).toMatch(/2025/);
  });
});
