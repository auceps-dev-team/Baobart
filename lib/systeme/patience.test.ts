import { describe, expect, it } from "vitest";

import { MINIMUM_SQUELETTE_MS, resteAMontrer } from "./patience";

describe("combien de temps garder le squelette", () => {
  it("ne retient rien quand le squelette n'est jamais apparu", () => {
    expect(resteAMontrer(null, 10_000)).toBe(0);
  });

  it("complète jusqu'au minimum quand le contenu arrive tôt", () => {
    // Visible à 1 000, contenu à 1 100 : il manque 300 ms.
    expect(resteAMontrer(1_000, 1_100)).toBe(MINIMUM_SQUELETTE_MS - 100);
  });

  it("ne retient rien quand le minimum est déjà atteint", () => {
    expect(resteAMontrer(1_000, 1_000 + MINIMUM_SQUELETTE_MS)).toBe(0);
    expect(resteAMontrer(1_000, 5_000)).toBe(0);
  });
});
