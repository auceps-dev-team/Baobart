/**
 * Freelance et Agence — l'exclusivité, telle qu'on la vérifie sans base.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * TROIS PROPRIÉTÉS QUI FONT LOI
 *
 *   — poser un badge que le compte porte déjà est refusé (l'unicité
 *     `(userId, badgeId)` en base le refuserait aussi, mais sans motif clair) ;
 *   — poser Freelance à un compte Agence exige de retirer Agence AVANT ;
 *   — poser Freelance à un compte qui n'a rien passe sans rien retirer.
 *
 * Le module est pur : le test n'a rien à monter.
 */

import { describe, expect, it } from "vitest";

import { opposeDe, verdictPour } from "@/lib/services/badges";

describe("l'opposé de la paire", () => {
  it("Freelance ↔ Agence", () => {
    expect(opposeDe("FREELANCE")).toBe("AGENCE");
    expect(opposeDe("AGENCE")).toBe("FREELANCE");
  });
});

describe("poser un badge professionnel", () => {
  it("passe quand le compte n'a rien", () => {
    expect(verdictPour({ aPoser: "FREELANCE", badgesActuels: [] })).toEqual({
      ok: true,
      retirerAvant: null,
    });
  });

  it("passe quand le compte a un badge sans rapport", () => {
    // TOP_CREATOR ne concerne pas la paire — on pose sans rien toucher.
    expect(
      verdictPour({ aPoser: "AGENCE", badgesActuels: ["TOP_CREATOR"] }),
    ).toEqual({ ok: true, retirerAvant: null });
  });

  it("demande de retirer l'autre AVANT de poser", () => {
    expect(
      verdictPour({ aPoser: "FREELANCE", badgesActuels: ["AGENCE"] }),
    ).toEqual({ ok: true, retirerAvant: "AGENCE" });

    expect(
      verdictPour({ aPoser: "AGENCE", badgesActuels: ["FREELANCE"] }),
    ).toEqual({ ok: true, retirerAvant: "FREELANCE" });
  });

  it("refuse de reposer un badge déjà en place", () => {
    // C'est l'appelant qui doit distinguer « rien à faire » d'une vraie
    // erreur — d'où un motif nommé plutôt qu'un simple `false`.
    expect(
      verdictPour({ aPoser: "FREELANCE", badgesActuels: ["FREELANCE"] }),
    ).toEqual({ ok: false, motif: "DEJA_POSE" });
  });

  it("ignore les autres badges quand la paire est déjà posée", () => {
    // Un compte peut avoir Freelance ET VIP_CREATOR — le premier bloque la
    // pose d'un Freelance de plus, sans que le second ait quoi que ce soit à
    // dire.
    expect(
      verdictPour({
        aPoser: "FREELANCE",
        badgesActuels: ["FREELANCE", "VIP_CREATOR"],
      }),
    ).toEqual({ ok: false, motif: "DEJA_POSE" });
  });
});
