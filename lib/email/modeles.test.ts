import { describe, expect, it } from "vitest";

import { ChargeInvalide, MODELES, rendre, type Modele } from "./modeles";

const CHARGES: Record<Modele, Record<string, unknown>> = {
  BIENVENUE: { nom: "Awa" },
  REINITIALISATION_MOT_DE_PASSE: {
    nom: "Awa",
    lien: "https://baobart.com/reinit?j=abc",
    heures: 2,
  },
  RECU_ACHAT: { nom: "Awa", ressource: "Pack textures", montant: "4 500 F" },
  LIEN_TELECHARGEMENT: {
    nom: "Awa",
    ressource: "Pack textures",
    lien: "https://media.baobart.com/x?sig=abc",
  },
  AVIS_VERSEMENT: { nom: "Awa", montant: "12 000 F", compte: "···· 4821" },
  RELANCE_ABONNEMENT: {
    nom: "Awa",
    offre: "Pass Créateur",
    montant: "2 000 F",
    lien: "https://baobart.com/abonnement/ab1/renouveler",
    jours: 3,
  },
  RECU_ABONNEMENT: {
    nom: "Awa",
    offre: "Pass Créateur",
    montant: "2 000 F",
    prochaine: "2 octobre 2026",
    lien: "https://baobart.com/dashboard/abonnements",
  },
};

describe("modèles de courriel", () => {
  describe("chaque modèle se rend", () => {
    it.each(MODELES)("%s produit un sujet et un corps non vides", (modele) => {
      const m = rendre(modele, CHARGES[modele]);
      expect(m.sujet.length).toBeGreaterThan(0);
      expect(m.texte.length).toBeGreaterThan(0);
    });

    it.each(MODELES)("%s ne laisse aucun trou dans le texte", (modele) => {
      // Un champ manquant produirait « Bonjour undefined » — parti chez
      // l'utilisateur avant que quiconque le voie.
      const m = rendre(modele, CHARGES[modele]);
      expect(m.texte).not.toContain("undefined");
      expect(m.texte).not.toContain("[object Object]");
      expect(m.sujet).not.toContain("undefined");
    });

    it("place le nom et le montant dans l'avis de versement", () => {
      const m = rendre("AVIS_VERSEMENT", CHARGES.AVIS_VERSEMENT);
      expect(m.texte).toContain("Awa");
      expect(m.texte).toContain("12 000 F");
      expect(m.texte).toContain("···· 4821");
    });
  });

  describe("le sujet ne porte jamais de saut de ligne", () => {
    it("aplatit un nom multiligne", () => {
      // Un saut de ligne dans un sujet permet historiquement d'injecter un
      // en-tête — un `Bcc:` et le message part à des inconnus.
      const m = rendre("BIENVENUE", { nom: "Awa\nBcc: voleur@exemple.com" });
      expect(m.sujet).not.toContain("\n");
      expect(m.sujet).not.toContain("\r");
    });

    it("borne la longueur du sujet", () => {
      const m = rendre("RECU_ACHAT", {
        ...CHARGES.RECU_ACHAT,
        ressource: "x".repeat(199),
      });
      expect(m.sujet.length).toBeLessThanOrEqual(200);
    });
  });

  describe("charge invalide", () => {
    it("refuse un champ manquant plutôt que d'écrire un texte à trous", () => {
      expect(() => rendre("BIENVENUE", {})).toThrow(ChargeInvalide);
    });

    it("refuse un lien qui n'en est pas un", () => {
      expect(() =>
        rendre("LIEN_TELECHARGEMENT", {
          nom: "Awa",
          ressource: "Pack",
          lien: "javascript:alert(1)",
        }),
      ).toThrow(ChargeInvalide);
    });

    it("refuse null et les valeurs non objets", () => {
      expect(() => rendre("BIENVENUE", null)).toThrow(ChargeInvalide);
      expect(() => rendre("BIENVENUE", "Awa")).toThrow(ChargeInvalide);
    });

    it("nomme le champ fautif, pour qu'on sache quoi corriger", () => {
      try {
        rendre("REINITIALISATION_MOT_DE_PASSE", {
          nom: "Awa",
          lien: "https://x.test",
          heures: -1,
        });
        expect.unreachable("aurait dû lever");
      } catch (cause) {
        expect(cause).toBeInstanceOf(ChargeInvalide);
        expect((cause as Error).message).toContain("heures");
      }
    });

    it("refuse un modèle inconnu", () => {
      expect(() => rendre("INEXISTANT" as Modele, {})).toThrow(ChargeInvalide);
    });
  });
});
