import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { entetesTdm, reservationTdm } from "@/lib/seo/tdm";

describe("la réserve de fouille de données (TDMRep)", () => {
  it("réserve tout le site, sans offrir de licence", () => {
    // `tdm-reservation: 1` = réservé. Pas de `tdm-policy` : on ne propose pas de
    // licence de fouille (voir l'en-tête de lib/seo/tdm.ts).
    expect(reservationTdm()).toEqual([{ location: "/", "tdm-reservation": 1 }]);
    expect(reservationTdm()[0]).not.toHaveProperty("tdm-policy");
  });

  it("pose l'en-tête de réserve sur les réponses", () => {
    expect(entetesTdm()).toEqual([{ key: "tdm-reservation", value: "1" }]);
  });

  it("sert le même signal dans /.well-known/tdmrep.json", () => {
    // Le fichier statique est servi tel quel par Next ; ce test l'empêche de
    // diverger de `reservationTdm()`. Deux porteurs, un seul signal.
    const brut = readFileSync(
      join(process.cwd(), "public", ".well-known", "tdmrep.json"),
      "utf8",
    );
    expect(JSON.parse(brut)).toEqual(reservationTdm());
  });
});
