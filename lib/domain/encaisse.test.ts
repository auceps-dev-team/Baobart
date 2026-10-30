/**
 * Ce que l'acheteur a payé pour une ligne : le prix multiplié par la quantité,
 * plus le pourboire éventuel.
 */

import { describe, expect, it } from "vitest";

import { encaisseDe } from "./encaisse";

describe("encaisseDe", () => {
  it("rend le prix quand il n'y a pas de pourboire", () => {
    expect(encaisseDe({ price: 5_000, quantity: 1, tipAmount: 0 })).toBe(5_000);
  });

  it("additionne le pourboire au prix", () => {
    expect(encaisseDe({ price: 5_000, quantity: 1, tipAmount: 1_000 })).toBe(6_000);
  });

  it("multiplie le prix par la quantité sans multiplier le pourboire", () => {
    expect(encaisseDe({ price: 5_000, quantity: 2, tipAmount: 1_000 })).toBe(11_000);
  });
});

