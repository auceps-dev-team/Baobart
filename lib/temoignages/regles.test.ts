import { describe, expect, it } from "vitest";

import { CORPS_MAX, motifAcceptable, validerTemoignage } from "@/lib/temoignages/regles";

const saisie = (s: Partial<{ corps: string; role: string; accord: boolean }> = {}) => ({
  corps: "J'ai vendu mon premier pack de polices ici, payé en Orange Money.",
  role: "Typographe, Abidjan",
  accord: true,
  ...s,
});

describe("un témoignage proposé", () => {
  it("passe quand il dit quelque chose, avec l'accord de son auteur", () => {
    expect(validerTemoignage(saisie())).toEqual({
      ok: true,
      temoignage: { body: "J'ai vendu mon premier pack de polices ici, payé en Orange Money.", role: "Typographe, Abidjan" },
    });
  });

  it("refuse sans accord : il paraît avec un nom et un avatar", () => {
    expect(validerTemoignage(saisie({ accord: false }))).toMatchObject({ ok: false, champ: "accord" });
  });

  it("borne la longueur, espaces en trop retirés", () => {
    expect(validerTemoignage(saisie({ corps: "Super.          " }))).toMatchObject({ ok: false, champ: "corps" });
    expect(validerTemoignage(saisie({ corps: "x".repeat(CORPS_MAX + 1) }))).toMatchObject({ ok: false, champ: "corps" });
    expect(validerTemoignage(saisie({ role: "y".repeat(61) }))).toMatchObject({ ok: false, champ: "role" });
  });

  it("garde la présentation facultative", () => {
    const v = validerTemoignage(saisie({ role: "   " }));
    expect(v.ok && v.temoignage.role).toBeNull();
  });
});

describe("un refus", () => {
  it("exige un motif qui dise quelque chose", () => {
    expect(motifAcceptable("non")).toBe(false);
    expect(motifAcceptable("Parle d'un autre site que Baobart.")).toBe(true);
  });
});
