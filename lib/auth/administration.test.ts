import { describe, expect, it } from "vitest";

import {
  LIBELLE_POUVOIR,
  LIBELLE_ROLE,
  aAccesAuBackOffice,
  estAdministrateur,
  peut,
  pouvoirsDe,
  type Pouvoir,
  type RolePlateforme,
} from "./administration";

/** Tous les rôles, pour que rien ne soit oublié par un `it.each` écrit à la main. */
const ROLES = Object.keys(LIBELLE_ROLE) as RolePlateforme[];
const POUVOIRS = Object.keys(LIBELLE_POUVOIR) as Pouvoir[];

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

describe("les rôles fonctionnels", () => {
  it("donnent chacun exactement leur métier, et rien d'autre", () => {
    // Une matrice se relit mal ; ces quatre lignes disent ce qu'elle vaut.
    expect(pouvoirsDe("CONTENT_MANAGER")).toEqual(["publier_du_contenu"]);
    expect(pouvoirsDe("MARKETING")).toEqual(["promouvoir_du_contenu"]);
    expect(pouvoirsDe("MODERATOR")).toEqual(["moderer_le_contenu"]);
    expect(pouvoirsDe("SUPPORT")).toEqual(["traiter_les_litiges"]);
  });

  it("n'ouvrent jamais les écrans techniques", () => {
    // Le piège de cette version : `estAdministrateur` gardait les écrans
    // Système. Confondre « a accès au back-office » et « peut lire l'état
    // technique » aurait ouvert la base et les interrupteurs à six rôles d'un
    // coup, sans qu'aucun écran ne change d'apparence.
    for (const role of [
      "CONTENT_MANAGER",
      "MARKETING",
      "MODERATOR",
      "SUPPORT",
      "ACCOUNTANT",
      "COMPLIANCE",
    ] as const) {
      expect(peut(role, "consulter_le_systeme")).toBe(false);
      expect(estAdministrateur(role)).toBe(false);
      // Mais ils entrent bien dans le back-office : leur écran existe.
      expect(aAccesAuBackOffice(role)).toBe(true);
    }
  });

  it("ne laissent personne d'autre que le super admin distribuer les pouvoirs", () => {
    // La garde qui empêche l'escalade : si un rôle pouvait se nommer
    // lui-même, tous les autres contrôles seraient décoratifs.
    for (const role of ROLES) {
      expect(peut(role, "gerer_les_roles")).toBe(role === "SUPER_ADMIN");
    }
  });

  it("réservent l'argent à la comptabilité et aux généralistes", () => {
    for (const role of ROLES) {
      const attendu =
        role === "ACCOUNTANT" || role === "ADMIN" || role === "SUPER_ADMIN";
      expect(peut(role, "agir_sur_l_argent")).toBe(attendu);
    }
  });
});

describe("la matrice elle-même", () => {
  it("couvre tous les rôles", () => {
    // Un rôle ajouté à l'enum sans ligne dans la matrice serait silencieusement
    // sans pouvoir — ce qui est le bon défaut, mais mérite d'être vu.
    for (const role of ROLES) {
      expect(Array.isArray(pouvoirsDe(role))).toBe(true);
    }
  });

  it("n'attribue aucun pouvoir qui n'existe pas", () => {
    for (const role of ROLES) {
      for (const p of pouvoirsDe(role)) {
        expect(POUVOIRS).toContain(p);
      }
    }
  });

  it("laisse chaque pouvoir atteignable par quelqu'un", () => {
    // Un pouvoir que personne ne porte est une garde qui refuse tout le monde :
    // l'écran qu'elle protège serait écrit et inatteignable.
    for (const p of POUVOIRS) {
      expect(ROLES.some((r) => peut(r, p))).toBe(true);
    }
  });

  it("nomme chaque rôle et chaque pouvoir", () => {
    // Les libellés servent à l'écran qui distribue les rôles. Un trou y
    // afficherait « undefined » à quelqu'un en train d'accorder des droits.
    for (const role of ROLES) expect(LIBELLE_ROLE[role].length).toBeGreaterThan(0);
    for (const p of POUVOIRS) expect(LIBELLE_POUVOIR[p].length).toBeGreaterThan(0);
  });

  it("donne au généraliste tout sauf la distribution des pouvoirs", () => {
    expect(pouvoirsDe("ADMIN")).toEqual(
      POUVOIRS.filter((p) => p !== "gerer_les_roles"),
    );
    expect(pouvoirsDe("SUPER_ADMIN")).toEqual(POUVOIRS);
  });
});
