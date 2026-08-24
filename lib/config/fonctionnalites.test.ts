import { describe, expect, it } from "vitest";

import { estOuverte, etatDes } from "./fonctionnalites";

describe("interrupteurs d'exploitation", () => {
  describe("une variable absente laisse ouvert", () => {
    it("ouvre tout quand l'environnement est vide", () => {
      for (const etat of etatDes({})) {
        expect(etat.ouverte, etat.libelle).toBe(true);
        expect(etat.motif).toBe("ouverte");
      }
    });

    it("ne se laisse pas fermer par une variable vide", () => {
      // Un `FEATURE_X=` laissé dans un fichier d'environnement est un oubli,
      // pas une décision de fermeture.
      expect(estOuverte("envoi_fichiers", { FEATURE_ENVOI_FICHIERS: "" })).toBe(
        true,
      );
    });
  });

  describe("fermeture", () => {
    it.each(["0", "false", "off", "non", "FALSE", " 0 "])(
      "ferme sur %j",
      (valeur) => {
        expect(
          estOuverte("envoi_fichiers", { FEATURE_ENVOI_FICHIERS: valeur }),
        ).toBe(false);
      },
    );

    it.each(["1", "true", "oui", "on"])("laisse ouvert sur %j", (valeur) => {
      expect(
        estOuverte("envoi_fichiers", { FEATURE_ENVOI_FICHIERS: valeur }),
      ).toBe(true);
    });

    it("nomme la variable responsable, pour qu'on sache où chercher", () => {
      const etat = etatDes({ FEATURE_ENVOI_FICHIERS: "0" }).find(
        (e) => e.id === "envoi_fichiers",
      );
      expect(etat?.motif).toBe("fermée par FEATURE_ENVOI_FICHIERS");
    });

    it("ne ferme que la fonctionnalité visée", () => {
      const etats = etatDes({ FEATURE_ENVOI_FICHIERS: "0" });
      expect(etats.find((e) => e.id === "versements")?.ouverte).toBe(true);
    });
  });

  describe("un drapeau ne peut pas mentir", () => {
    it("ignore une fonctionnalité inconnue plutôt que de la déclarer ouverte", () => {
      // @ts-expect-error — on éprouve le comportement au bord du type.
      expect(estOuverte("passage_en_caisse", {})).toBe(false);
    });
  });

  describe("la livraison n'a pas d'interrupteur", () => {
    it("n'expose aucun drapeau capable de couper la livraison", () => {
      // Couper la livraison retirerait à des acheteurs ce qu'ils ont payé.
      // Ce test échouera le jour où quelqu'un ajoutera ce drapeau — c'est son
      // seul but : forcer la discussion plutôt que la découverte en production.
      const ids = etatDes({}).map((e) => e.id);
      expect(ids).not.toContain("livraison");
    });
  });
});
