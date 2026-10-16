import { describe, expect, it } from "vitest";

import { numerosAMontrer } from "@/lib/createurs/pagination";

describe("les numéros de page", () => {
  it("rendent la forme de la maquette sur la première page de six", () => {
    expect(numerosAMontrer(1, 6)).toEqual([1, 2, 3, "…", 6]);
  });

  it("entourent la page courante, sans cacher une page seule derrière « … »", () => {
    expect(numerosAMontrer(4, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(numerosAMontrer(5, 10)).toEqual([1, "…", 4, 5, 6, "…", 10]);
    expect(numerosAMontrer(10, 10)).toEqual([1, "…", 8, 9, 10]);
    expect(numerosAMontrer(2, 2)).toEqual([1, 2]);
  });

  it("ne montrent qu'un numéro quand il n'y a qu'une page", () => {
    expect(numerosAMontrer(1, 1)).toEqual([1]);
    expect(numerosAMontrer(1, 0)).toEqual([1]);
  });
});
