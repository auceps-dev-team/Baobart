import { describe, expect, it } from "vitest";

import { meriteSignalement, normaliserPourModeration } from "./moderation";

describe("normalisation", () => {
  it("retire les accents et la casse", () => {
    expect(normaliserPourModeration("ÉNORME Créatif")).toBe("enorme creatif");
  });

  it("transforme tout ce qui n'est pas une lettre en espace", () => {
    // C'est ce qui défait l'obfuscation : sans ça, la liste n'attrape que les
    // distraits.
    expect(normaliserPourModeration("c.o.n.n.a.r.d")).toBe("c o n n a r d");
    expect(normaliserPourModeration("sup3r  tr@vail !!")).toBe("sup r tr vail");
  });

  it("rend une chaîne vide plutôt qu'une suite d'espaces", () => {
    expect(normaliserPourModeration("!!! 123 ???")).toBe("");
    expect(normaliserPourModeration("")).toBe("");
  });
});

describe("signalement", () => {
  it("laisse passer un commentaire ordinaire", () => {
    for (const texte of [
      "Superbe travail sur les motifs.",
      "Est-ce que la licence couvre l'impression ?",
      "Merci beaucoup, ça m'a bien servi !",
      "",
    ]) {
      expect(meriteSignalement(texte), texte).toBe(false);
    }
  });

  it("attrape une insulte, quelle que soit sa graphie", () => {
    for (const texte of [
      "espèce de connard",
      "espèce de CONNARD",
      "espèce de c.o.n.n.a.r.d",
      "espèce de c o n n a r d",
      "espèce de çonnard",
    ]) {
      expect(meriteSignalement(texte), texte).toBe(true);
    }
  });

  it("attrape une expression en plusieurs mots", () => {
    expect(meriteSignalement("va-t'en, sale arabe")).toBe(true);
  });

  it("ne se déclenche pas sur un mot qui commence pareil", () => {
    // « conception » ne doit pas être signalé parce qu'il partage trois
    // lettres avec une insulte. Chaque faux signalement use l'attention du
    // créateur jusqu'à ce qu'il cesse de regarder.
    for (const texte of [
      "belle conception d'ensemble",
      "j'aime la putasserie visuelle de ce pack", // pas dans la liste
      "le contraste est parfait",
      "Pape Diop a fait mieux",
    ]) {
      expect(meriteSignalement(texte), texte).toBe(false);
    }
  });

  it("ne se déclenche pas sur un texte sans lettres", () => {
    expect(meriteSignalement("!!! ??? 123")).toBe(false);
  });
});
