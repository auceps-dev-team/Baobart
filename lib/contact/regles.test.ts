import { describe, expect, it } from "vitest";

import { CORPS_MAX, CORPS_MIN, validerMessage } from "./regles";

const base = { genre: "CONTACT" as const, nom: "Awa Koné", email: "Awa@Exemple.ci ", sujet: "Un bug", corps: "La page Gains reste blanche." };

describe("un message de contact", () => {
  it("s'enregistre propre : nom resserré, adresse en minuscules", () => {
    const v = validerMessage({ ...base, nom: "  Awa   Koné " });
    expect(v).toEqual({ ok: true, message: { genre: "CONTACT", nom: "Awa Koné", email: "awa@exemple.ci", sujet: "Un bug", corps: "La page Gains reste blanche.", budget: null } });
  });

  it("refuse ce qui ne permet pas de répondre", () => {
    expect(validerMessage({ ...base, email: "awa" })).toMatchObject({ ok: false, champ: "email" });
    expect(validerMessage({ ...base, nom: "A" })).toMatchObject({ ok: false, champ: "nom" });
    expect(validerMessage({ ...base, sujet: "" })).toMatchObject({ ok: false, champ: "sujet" });
  });

  it("borne le message des deux côtés", () => {
    expect(validerMessage({ ...base, corps: "x".repeat(CORPS_MIN - 1) })).toMatchObject({ ok: false, champ: "corps" });
    expect(validerMessage({ ...base, corps: "x".repeat(CORPS_MAX + 1) })).toMatchObject({ ok: false, champ: "corps" });
    expect(validerMessage({ ...base, corps: "x".repeat(CORPS_MAX) }).ok).toBe(true);
  });

  it("une demande de sponsoring n'a pas de sujet à choisir, et garde son budget", () => {
    const v = validerMessage({ ...base, genre: "SPONSOR", sujet: "", budget: " 200 000 F " });
    expect(v).toMatchObject({ ok: true, message: { genre: "SPONSOR", sujet: "Sponsoriser", budget: "200 000 F" } });
  });
});
