import { describe, expect, it } from "vitest";

import {
  CORPS_MAX,
  CORPS_MIN,
  PLAFOND_PAR_CREATEUR,
  PLAFOND_PAR_JOUR,
  decider,
  lireMessage,
} from "./createur";

const CORPS = "Bonjour, nous aimerions vous confier l'affiche de notre festival.";

describe("lire un message laissé à un créateur", () => {
  it("aplatit le sujet sur une ligne : il finit dans l'objet du courriel", () => {
    const l = lireMessage({ sujet: "  Une affiche\r\nBcc: x@y.z  ", corps: CORPS });
    expect(l).toEqual({ ok: true, sujet: "Une affiche Bcc: x@y.z", corps: CORPS });
  });

  it("garde les paragraphes du corps", () => {
    const l = lireMessage({ sujet: "Affiche", corps: `${CORPS}\r\n\r\nMerci.` });
    expect(l.ok && l.corps).toBe(`${CORPS}\n\nMerci.`);
  });

  it("refuse un sujet vide et nomme le champ", () => {
    expect(lireMessage({ sujet: "  ", corps: CORPS })).toMatchObject({ ok: false, champ: "sujet" });
  });

  it("refuse un corps trop court, puis trop long", () => {
    expect(lireMessage({ sujet: "Affiche", corps: "x".repeat(CORPS_MIN - 1) })).toMatchObject({ ok: false, champ: "corps" });
    expect(lireMessage({ sujet: "Affiche", corps: "x".repeat(CORPS_MIN) }).ok).toBe(true);
    expect(lireMessage({ sujet: "Affiche", corps: "x".repeat(CORPS_MAX + 1) })).toMatchObject({ ok: false, champ: "corps" });
  });
});

describe("qui peut écrire", () => {
  const base = { expediteurId: "u1", destinataireId: "u2", ouvert: true, envoyesAujourdhui: 0, envoyesAuCreateur: 0 };

  it("laisse passer un premier message", () => {
    expect(decider(base)).toEqual({ ok: true });
  });

  it("refuse de s'écrire à soi-même", () => {
    expect(decider({ ...base, destinataireId: "u1" })).toEqual({ ok: false, refus: "SOI_MEME" });
  });

  it("refuse quand le créateur a fermé son bouton", () => {
    expect(decider({ ...base, ouvert: false })).toEqual({ ok: false, refus: "FERME" });
  });

  it("arrête au plafond par créateur, avant le plafond du jour", () => {
    expect(decider({ ...base, envoyesAuCreateur: PLAFOND_PAR_CREATEUR - 1 }).ok).toBe(true);
    expect(decider({ ...base, envoyesAuCreateur: PLAFOND_PAR_CREATEUR, envoyesAujourdhui: PLAFOND_PAR_JOUR })).toEqual({
      ok: false,
      refus: "PLAFOND_CREATEUR",
    });
  });

  it("arrête au plafond du jour, tous créateurs confondus", () => {
    expect(decider({ ...base, envoyesAujourdhui: PLAFOND_PAR_JOUR - 1 }).ok).toBe(true);
    expect(decider({ ...base, envoyesAujourdhui: PLAFOND_PAR_JOUR })).toEqual({ ok: false, refus: "PLAFOND_JOUR" });
  });
});
