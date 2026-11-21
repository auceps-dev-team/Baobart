import { describe, expect, it } from "vitest";

import { accorde } from "./accord";

describe("accorde (Q-34)", () => {
  it("le singulier jusqu'à 1, zéro compris ; le pluriel à partir de 2", () => {
    expect(accorde(0, "ressource")).toBe("ressource");
    expect(accorde(1, "ressource")).toBe("ressource");
    expect(accorde(2, "ressource")).toBe("ressources");
    expect(accorde(1_000_000, "abonné")).toBe("abonnés");
  });

  it("prend un pluriel irrégulier quand on le lui donne", () => {
    expect(accorde(1, "créatif", "créatifs")).toBe("créatif");
    expect(accorde(3, "famille de ressources", "familles de ressources")).toBe("familles de ressources");
  });

  it("un décimal entre 1 et 2 reste au singulier", () => {
    // « 1,5 kilo » : l'usage courant et l'Académie acceptent le singulier sous 2.
    expect(accorde(1.5, "étoile")).toBe("étoile");
  });
});
