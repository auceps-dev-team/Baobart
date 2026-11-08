import { describe, expect, it } from "vitest";

import { ecussonDeVignette, ecussonsDuCompte, estCodeStatut, gestesSur, lireGeste, nomDuStatut, STATUTS } from "./statuts";

const cles = (actuels: Parameters<typeof gestesSur>[0]) => gestesSur(actuels).map((g) => g.cle);

describe("les gestes possibles sur un compte", () => {
  it("propose d'accorder chacun des quatre statuts à un compte qui n'en a aucun", () => {
    expect(cles([])).toEqual(STATUTS.map((s) => `ACCORDER:${s.code}`));
  });

  it("propose de retirer ce que le compte porte, et seulement cela", () => {
    expect(cles(["VERIFIED_CREATOR"])).toContain("RETIRER:VERIFIED_CREATOR");
    expect(cles(["VERIFIED_CREATOR"])).not.toContain("ACCORDER:VERIFIED_CREATOR");
  });

  it("passe d'Agence à Freelance au lieu de poser les deux", () => {
    const gestes = gestesSur(["AGENCE"]);
    expect(gestes.map((g) => g.cle)).toEqual(
      expect.arrayContaining(["RETIRER:AGENCE", "ACCORDER:FREELANCE"]),
    );
    expect(gestes.find((g) => g.cle === "ACCORDER:FREELANCE")!.libelle).toBe("Passer en Freelance (retire Agence)");
  });

  it("ne touche pas aux mérites que le compte porte", () => {
    // Un mérite se recalcule, il ne se retire pas à la main.
    expect(cles(["TOP_CREATOR"]).some((c) => c.includes("TOP_CREATOR"))).toBe(false);
  });
});

describe("la clé reçue du navigateur", () => {
  it("se relit quand elle est connue", () => {
    expect(lireGeste("ACCORDER:FREELANCE")).toEqual({ sens: "ACCORDER", code: "FREELANCE" });
    expect(lireGeste("RETIRER:VERIFIED_RECRUITER")).toEqual({ sens: "RETIRER", code: "VERIFIED_RECRUITER" });
  });

  it("se refuse quand elle vise un mérite, un code inconnu ou un sens inventé", () => {
    expect(lireGeste("ACCORDER:TOP_CREATOR")).toBeNull();
    expect(lireGeste("ACCORDER:ADMIN")).toBeNull();
    expect(lireGeste("SUPPRIMER:FREELANCE")).toBeNull();
    expect(lireGeste("")).toBeNull();
  });
});

describe("les écussons", () => {
  const compte = (statuts: Parameters<typeof ecussonsDuCompte>[0]["statuts"], autre: Partial<Parameters<typeof ecussonsDuCompte>[0]> = {}) =>
    ecussonsDuCompte({ statuts, identiteVerifiee: false, abonnementOuvert: true, ...autre });

  it("suivent l'ordre de la maquette, « Identité vérifiée » lue sur le KYC", () => {
    const e = compte(["FREELANCE", "VERIFIED_CREATOR"], { identiteVerifiee: true });
    expect(e.map((x) => x.code)).toEqual(["VERIFIED_CREATOR", "FREELANCE", "KYC_VERIFIED"]);
  });

  it("ne montrent jamais un mérite rangé en base, VIP compris", () => {
    expect(compte(["VIP_CREATOR", "TOP_CREATOR"])).toEqual([]);
  });

  it("endorment Freelance et Agence sans abonnement ouvert, et eux seuls", () => {
    const e = compte(["AGENCE", "VERIFIED_CREATOR"], { abonnementOuvert: false });
    expect(e.find((x) => x.code === "AGENCE")!.dormant).toBe(true);
    expect(e.find((x) => x.code === "VERIFIED_CREATOR")!.dormant).toBe(false);
  });

  it("n'en gardent qu'un sur la vignette : la vérification d'abord, puis l'identité", () => {
    expect(ecussonDeVignette({ statuts: ["FREELANCE", "VERIFIED_CREATOR"], identiteVerifiee: true })!.nom).toBe("Créateur vérifié");
    expect(ecussonDeVignette({ statuts: ["FREELANCE"], identiteVerifiee: true })!.nom).toBe("Identité vérifiée");
    expect(ecussonDeVignette({ statuts: ["AGENCE"], identiteVerifiee: false })).toBeNull();
  });
});

// Ajoutés le 08/11/2026 après le premier passage de Stryker.
describe("ce que Stryker a trouvé de non vérifié", () => {
  it("nomme un statut lu dans une trace, ou rend le code tel quel s'il a disparu", () => {
    expect(nomDuStatut("FREELANCE")).toBe("Freelance");
    expect(nomDuStatut("ANCIEN_CODE")).toBe("ANCIEN_CODE");
  });

  it("ne reconnaît comme statut que les quatre codes accordables", () => {
    expect(estCodeStatut("VERIFIED_RECRUITER")).toBe(true);
    expect(estCodeStatut("TOP_CREATOR")).toBe(false);
  });

  it("propose d'accorder Recruteur vérifié à côté d'un badge pro, sans l'échanger", () => {
    const gestes = gestesSur(["FREELANCE"]);
    expect(gestes.find((g) => g.code === "VERIFIED_RECRUITER")!.libelle).toBe("Accorder « Recruteur vérifié »");
    expect(gestes.find((g) => g.code === "VERIFIED_CREATOR")!.libelle).toBe("Accorder « Créateur vérifié »");
    expect(gestes.map((g) => g.cle)).not.toContain("ACCORDER:FREELANCE");
  });

  it("dessine chaque écusson avec le nom, le glyphe et la couleur de la maquette", () => {
    const tous = ecussonsDuCompte({
      statuts: ["VERIFIED_CREATOR", "AGENCE", "VERIFIED_RECRUITER"],
      identiteVerifiee: true,
      abonnementOuvert: false,
    });
    expect(tous.map(({ code, nom, glyphe, fond, dormant }) => ({ code, nom, glyphe, fond, dormant }))).toEqual([
      { code: "VERIFIED_CREATOR", nom: "Créateur vérifié", glyphe: "✓", fond: "#FFD84A", dormant: false },
      { code: "AGENCE", nom: "Agence", glyphe: "A", fond: "#C9A8F5", dormant: true },
      { code: "VERIFIED_RECRUITER", nom: "Recruteur vérifié", glyphe: "R", fond: "#FFD84A", dormant: false },
      { code: "KYC_VERIFIED", nom: "Identité vérifiée", glyphe: "ID", fond: "#B9E8C0", dormant: false },
    ]);
    expect(ecussonsDuCompte({ statuts: ["FREELANCE"], identiteVerifiee: false, abonnementOuvert: true })[0]!.dormant).toBe(false);
  });
});

describe("ce que le second passage de Stryker a trouvé (08/11)", () => {
  it("propose de passer de Freelance à Agence, comme d'Agence à Freelance", () => {
    expect(gestesSur(["FREELANCE"]).find((g) => g.code === "AGENCE")!.libelle).toBe("Passer en Agence (retire Freelance)");
  });

  it("endort Freelance comme Agence quand l'abonnement est fermé", () => {
    expect(ecussonsDuCompte({ statuts: ["FREELANCE"], identiteVerifiee: false, abonnementOuvert: false })[0]!.dormant).toBe(true);
  });
});

describe("l'apparence publiée des écussons", () => {
  // Même raison que l'instantané des mérites : un écusson engage Baobart.
  it("ne change pas sans qu'on le voie", () => {
    expect(
      ecussonsDuCompte({ statuts: ["VERIFIED_CREATOR", "FREELANCE", "AGENCE", "VERIFIED_RECRUITER"], identiteVerifiee: true, abonnementOuvert: true }),
    ).toMatchSnapshot();
    expect(STATUTS).toMatchSnapshot();
  });
});
