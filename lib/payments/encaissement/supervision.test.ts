import { describe, expect, it } from "vitest";

import {
  constatBloquees,
  constatDiscordances,
  constatOperateur,
  constatRefus,
  graviteEncaissement,
  graviteRappel,
  LIBELLE_RAPPEL,
  type FaitsEncaissement,
} from "@/lib/payments/encaissement/supervision";

const SAIN: FaitsEncaissement = {
  pilote: "bac-a-sable",
  refusRecents: 0,
  discordancesRecentes: 0,
  bloquees: 0,
  traites24h: 12,
};

describe("l'opérateur", () => {
  it("est une panne quand aucun n'est branché", () => {
    // Sans opérateur, aucun achat payant n'est possible. Ce n'est pas un
    // avertissement : c'est la boutique fermée.
    const c = constatOperateur({ ...SAIN, pilote: null });
    expect(c.gravite).toBe("panne");
    expect(c.remede).toContain("PAYMENTS_DRIVER");
  });

  it("annonce le pilote et son activité quand il est là", () => {
    const c = constatOperateur(SAIN);
    expect(c.gravite).toBe("ok");
    expect(c.detail).toContain("bac-a-sable");
    expect(c.detail).toContain("12");
  });
});

describe("les appels refusés", () => {
  it("passent en attention dès le premier", () => {
    expect(constatRefus({ ...SAIN, refusRecents: 1 }).gravite).toBe("attention");
  });

  it("deviennent une panne au-delà du seuil", () => {
    const c = constatRefus({ ...SAIN, refusRecents: 5 });
    expect(c.gravite).toBe("panne");
    // La panne la plus fréquente d'une intégration, et la plus silencieuse.
    expect(c.remede).toContain("secret");
  });

  it("sont paisibles quand il n'y en a aucun", () => {
    expect(constatRefus(SAIN).gravite).toBe("ok");
  });
});

describe("les montants discordants", () => {
  it("sont une panne dès le premier", () => {
    // Soit quelqu'un forge des rappels, soit on reçoit ceux d'un autre
    // marchand. Aucun des deux ne se laisse dormir jusqu'au matin.
    const c = constatDiscordances({ ...SAIN, discordancesRecentes: 1 });
    expect(c.gravite).toBe("panne");
    expect(c.remede).toContain("crédité");
  });

  it("ne disent rien quand il n'y en a pas", () => {
    expect(constatDiscordances(SAIN).gravite).toBe("ok");
  });
});

describe("les commandes en attente", () => {
  it("restent normales en petit nombre", () => {
    // Des acheteurs abandonnent : c'est une information commerciale, pas une
    // panne. Peindre cela en orange apprendrait à ignorer l'orange.
    const c = constatBloquees({ ...SAIN, bloquees: 3 });
    expect(c.gravite).toBe("ok");
    expect(c.detail).toContain("3");
  });

  it("passent en attention à partir du seuil", () => {
    expect(constatBloquees({ ...SAIN, bloquees: 5 }).gravite).toBe("attention");
  });

  it("deviennent une panne quand le tuyau semble coupé", () => {
    const c = constatBloquees({ ...SAIN, bloquees: 20 });
    expect(c.gravite).toBe("panne");
    expect(c.remede).toContain("rappel");
  });
});

describe("la gravité d'ensemble", () => {
  it("est verte quand tout va", () => {
    expect(graviteEncaissement(SAIN)).toBe("ok");
  });

  it("prend le pire, pas la moyenne", () => {
    // Un bandeau vert au-dessus d'une panne ne sert personne.
    expect(
      graviteEncaissement({ ...SAIN, bloquees: 5, discordancesRecentes: 1 }),
    ).toBe("panne");
    expect(graviteEncaissement({ ...SAIN, refusRecents: 1 })).toBe("attention");
  });
});

describe("la gravité d'une ligne", () => {
  it("peint un refus en panne", () => {
    expect(graviteRappel("REJECTED")).toBe("panne");
  });

  it("peint un reçu jamais traité en attention", () => {
    expect(graviteRappel("RECEIVED")).toBe("attention");
  });

  it("laisse un rejeu tranquille", () => {
    // Un opérateur qui rejoue fait son travail.
    expect(graviteRappel("IGNORED")).toBe("ok");
    expect(graviteRappel("PROCESSED")).toBe("ok");
  });

  it("nomme chaque statut en français", () => {
    expect(LIBELLE_RAPPEL.IGNORED).toBe("SANS EFFET");
    expect(LIBELLE_RAPPEL.REJECTED).toBe("REFUSÉ");
  });
});
