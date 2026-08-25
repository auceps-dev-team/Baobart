import { describe, expect, it } from "vitest";

import {
  estAdministrateur,
  peut,
  type RolePlateforme,
} from "./administration";

describe("pouvoirs sur la plateforme", () => {
  describe("un membre ordinaire ne peut rien", () => {
    it.each([
      "consulter_le_systeme",
      "agir_sur_l_exploitation",
      "gerer_les_roles",
    ] as const)("refuse %s", (pouvoir) => {
      expect(peut("MEMBER", pouvoir)).toBe(false);
    });

    it("n'est pas administrateur", () => {
      expect(estAdministrateur("MEMBER")).toBe(false);
    });
  });

  describe("administrateur", () => {
    it("consulte et agit", () => {
      expect(peut("ADMIN", "consulter_le_systeme")).toBe(true);
      expect(peut("ADMIN", "agir_sur_l_exploitation")).toBe(true);
    });

    it("ne distribue pas les pouvoirs", () => {
      // Un compte d'astreinte doit pouvoir lire un diagnostic la nuit sans
      // pouvoir, du même geste, se nommer super administrateur.
      expect(peut("ADMIN", "gerer_les_roles")).toBe(false);
    });
  });

  describe("super administrateur", () => {
    it("peut tout, y compris gérer les rôles", () => {
      expect(peut("SUPER_ADMIN", "gerer_les_roles")).toBe(true);
      expect(estAdministrateur("SUPER_ADMIN")).toBe(true);
    });
  });

  describe("robustesse", () => {
    it("refuse un rôle inconnu au lieu d'ouvrir", () => {
      // Une valeur inattendue en base — migration à moitié jouée, donnée
      // importée — ne doit jamais se lire comme un laissez-passer.
      const inconnu = "ROI" as RolePlateforme;
      expect(peut(inconnu, "consulter_le_systeme")).toBe(false);
      expect(estAdministrateur(inconnu)).toBe(false);
    });

    it("fait de l'accès à l'administration le seuil le plus bas", () => {
      // `estAdministrateur` sert de porte : si quelqu'un ajoute un rôle qui
      // consulte sans être admin, la porte doit suivre, pas diverger.
      for (const role of ["MEMBER", "ADMIN", "SUPER_ADMIN"] as const) {
        expect(estAdministrateur(role)).toBe(peut(role, "consulter_le_systeme"));
      }
    });
  });
});
