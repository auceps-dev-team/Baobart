import { describe, expect, it } from "vitest";

import { ACCES_LIBRE, fonctionsDuForfait } from "./grille";

describe("la grille tarifaire", () => {
  it("dit d'un forfait payant ce que la base en dit, sans rien ajouter", () => {
    expect(
      fonctionsDuForfait({
        downloadsPerMonth: 15,
        licenseIncluded: "PERSONAL",
        includesPaidResources: true,
        features: { resolution: "HD", services: "réserver", inconnu: "jamais affiché" },
      }),
    ).toEqual(["15 ressources payantes par mois sans les acheter", "Licence personnelle", "Résolution HD", "Services : réserver"]);
  });

  it("ne promet pas de ressource payante à un forfait qui n'en ouvre pas", () => {
    expect(fonctionsDuForfait({ downloadsPerMonth: null, licenseIncluded: null, includesPaidResources: false, features: {} })).toEqual([]);
    expect(ACCES_LIBRE.join(" ")).not.toMatch(/payantes? (sans|par mois)/);
  });
});
