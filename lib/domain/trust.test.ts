import { describe, expect, it } from "vitest";

import {
  AUTEUR_CONTROLE_SOLDE,
  LOW_BALANCE_PAR_DEFAUT,
  SuspensionNonAutoriseeError,
  TransitionInterditeError,
  applyRiskEvent,
  decideLowBalance,
  estSuspendu,
  type RiskState,
} from "./trust";

describe("machine à états — transitions autorisées", () => {
  it("part de « non revu » et peut être déclaré conforme", () => {
    expect(applyRiskEvent({ from: "NOT_REVIEWED", event: "MARK_COMPLIANT" }).to)
      .toBe("COMPLIANT");
  });

  it("permet de signaler un compte conforme", () => {
    expect(applyRiskEvent({ from: "COMPLIANT", event: "FLAG_FRAUD" }).to).toBe(
      "FLAGGED_FRAUD",
    );
    expect(applyRiskEvent({ from: "COMPLIANT", event: "FLAG_TOS" }).to).toBe(
      "FLAGGED_TOS",
    );
  });

  it("permet de basculer d'un signalement à l'autre", () => {
    expect(applyRiskEvent({ from: "FLAGGED_TOS", event: "FLAG_FRAUD" }).to).toBe(
      "FLAGGED_FRAUD",
    );
  });

  it("ne remet « non revu » que depuis la probation", () => {
    expect(
      applyRiskEvent({ from: "ON_PROBATION", event: "MARK_NOT_REVIEWED" }).to,
    ).toBe("NOT_REVIEWED");

    // Un compte signalé ne redevient pas « à revoir » : on tranche.
    expect(() =>
      applyRiskEvent({ from: "FLAGGED_FRAUD", event: "MARK_NOT_REVIEWED" }),
    ).toThrow(TransitionInterditeError);
  });

  it("refuse de signaler un compte déjà suspendu", () => {
    expect(() =>
      applyRiskEvent({ from: "SUSPENDED_FRAUD", event: "FLAG_FRAUD" }),
    ).toThrow(TransitionInterditeError);
  });

  it("refuse de sanctionner un compte non vérifié", () => {
    expect(() =>
      applyRiskEvent({
        from: "NOT_REVIEWED",
        event: "SUSPEND_FRAUD",
        isVerified: false,
      }),
    ).toThrow(TransitionInterditeError);
  });
});

describe("machine à états — le garde-fou de la suspension", () => {
  const etatsRehabilitants = [
    { event: "MARK_COMPLIANT", to: "COMPLIANT" },
    { event: "PUT_ON_PROBATION", to: "ON_PROBATION" },
  ] as const;

  for (const suspendu of ["SUSPENDED_FRAUD", "SUSPENDED_TOS"] as RiskState[]) {
    for (const { event, to } of etatsRehabilitants) {
      it(`refuse ${suspendu} → ${to} sans intention explicite`, () => {
        expect(() => applyRiskEvent({ from: suspendu, event })).toThrow(
          SuspensionNonAutoriseeError,
        );
      });

      it(`autorise ${suspendu} → ${to} avec clearSuspension`, () => {
        expect(
          applyRiskEvent({ from: suspendu, event, clearSuspension: true }).to,
        ).toBe(to);
      });
    }
  }

  it("garde aussi la probation, parce qu'elle réhabilite autant que la conformité", () => {
    // C'est le piège : on pourrait croire que seule « conforme » lève une
    // suspension. La probation remet les produits en vente elle aussi.
    expect(() =>
      applyRiskEvent({ from: "SUSPENDED_TOS", event: "PUT_ON_PROBATION" }),
    ).toThrow(SuspensionNonAutoriseeError);
  });

  it("n'exige rien pour une transition qui ne sort d'aucune suspension", () => {
    expect(() =>
      applyRiskEvent({ from: "FLAGGED_FRAUD", event: "MARK_COMPLIANT" }),
    ).not.toThrow();
  });
});

describe("machine à états — effets de bord", () => {
  it("coupe tout à la suspension", () => {
    const { effects } = applyRiskEvent({
      from: "COMPLIANT",
      event: "SUSPEND_FRAUD",
    });

    expect(effects).toEqual(
      expect.arrayContaining([
        "INVALIDER_SESSIONS",
        "DESACTIVER_PRODUITS",
        "BLOQUER_IP",
        "RETIRER_ABONNES",
        "SUPPRIMER_DOMAINE_PERSO",
        "SUSPENDRE_AUTRES_COMPTES",
        "AJOUTER_FILTRE_ANTI_ABUS",
      ]),
    );
  });

  it("remet tout en place à la réintégration", () => {
    const { effects } = applyRiskEvent({
      from: "SUSPENDED_FRAUD",
      event: "MARK_COMPLIANT",
      clearSuspension: true,
    });

    expect(effects).toEqual(
      expect.arrayContaining([
        "DEBLOQUER_IP",
        "REACTIVER_PRODUITS",
        "REACTIVER_AUTRES_COMPTES",
        "RETIRER_FILTRE_ANTI_ABUS",
      ]),
    );
    expect(effects).not.toContain("BLOQUER_IP");
  });

  it("journalise chaque transition, sans exception", () => {
    const cas = [
      { from: "NOT_REVIEWED", event: "MARK_COMPLIANT" },
      { from: "COMPLIANT", event: "PUT_ON_PROBATION" },
      { from: "COMPLIANT", event: "FLAG_TOS" },
    ] as const;

    for (const c of cas) {
      expect(applyRiskEvent(c).effects).toContain("JOURNALISER");
    }
  });

  it("ne rejoue pas les effets entre deux états suspendus", () => {
    const { effects } = applyRiskEvent({
      from: "SUSPENDED_TOS",
      event: "PUT_ON_PROBATION",
      clearSuspension: true,
    });
    expect(effects).toContain("DEBLOQUER_IP");

    const versSuspension = applyRiskEvent({
      from: "FLAGGED_TOS",
      event: "SUSPEND_TOS",
    });
    expect(versSuspension.effects).toContain("BLOQUER_IP");
  });
});

describe("contrôle du solde négatif", () => {
  const { seuilBas, seuilHaut } = LOW_BALANCE_PAR_DEFAUT;

  it("met en probation et coupe les remboursements sous le seuil bas", () => {
    const d = decideLowBalance({
      unpaidBalance: seuilBas - 1,
      state: "COMPLIANT",
    });

    expect(d.action).toBe("PROBATION");
    expect(d).toMatchObject({ desactiverRemboursements: true });
  });

  it("ne fait rien tant que le solde reste entre les deux seuils", () => {
    expect(decideLowBalance({ unpaidBalance: 0, state: "COMPLIANT" }).action)
      .toBe("RIEN");
    expect(
      decideLowBalance({ unpaidBalance: seuilBas + 1, state: "COMPLIANT" })
        .action,
    ).toBe("RIEN");
  });

  it("n'oscille pas : sortir demande plus que rentrer", () => {
    // Un solde qui remonte juste au-dessus du seuil bas ne lève rien.
    const d = decideLowBalance({
      unpaidBalance: seuilBas + 1,
      state: "ON_PROBATION",
      derniereProbationParCeControle: new Date("2026-01-01"),
    });

    expect(d.action).toBe("RIEN");
  });

  it("lève la probation quand le solde repasse au-dessus du seuil haut", () => {
    const d = decideLowBalance({
      unpaidBalance: seuilHaut,
      state: "ON_PROBATION",
      derniereProbationParCeControle: new Date("2026-01-01"),
      etatAvantProbation: "COMPLIANT",
    });

    expect(d).toMatchObject({ action: "LEVER_PROBATION", versEtat: "COMPLIANT" });
  });

  it("ne lève pas une probation posée par quelqu'un d'autre", () => {
    const d = decideLowBalance({
      unpaidBalance: seuilHaut * 2,
      state: "ON_PROBATION",
      derniereProbationParCeControle: null,
    });

    expect(d.action).toBe("RIEN");
  });

  it("ne revient pas sur une décision plus récente", () => {
    const d = decideLowBalance({
      unpaidBalance: seuilHaut * 2,
      state: "ON_PROBATION",
      derniereProbationParCeControle: new Date("2026-01-01"),
      decisionPlusRecenteExiste: true,
    });

    expect(d.action).toBe("RIEN");
  });

  it("retombe sur « non revu » quand l'état d'avant est inconnu", () => {
    const d = decideLowBalance({
      unpaidBalance: seuilHaut,
      state: "ON_PROBATION",
      derniereProbationParCeControle: new Date("2026-01-01"),
      etatAvantProbation: null,
    });

    // Jamais « conforme » par défaut : ce serait accorder une confiance
    // que personne n'a décidée.
    expect(d).toMatchObject({ action: "LEVER_PROBATION", versEtat: "NOT_REVIEWED" });
  });

  it("ne re-sanctionne pas dans le délai de carence", () => {
    const today = new Date("2026-03-01");
    const d = decideLowBalance({
      unpaidBalance: seuilBas * 2,
      state: "ON_PROBATION",
      derniereProbationParCeControle: new Date("2026-02-20"),
      today,
    });

    expect(d.action).toBe("RIEN");
  });

  it("re-sanctionne une fois le délai passé", () => {
    const d = decideLowBalance({
      unpaidBalance: seuilBas * 2,
      state: "ON_PROBATION",
      derniereProbationParCeControle: new Date("2026-01-01"),
      today: new Date("2026-06-01"),
    });

    expect(d.action).toBe("PROBATION");
  });

  it("ne touche jamais à un compte suspendu, dans aucun sens", () => {
    for (const state of ["SUSPENDED_FRAUD", "SUSPENDED_TOS"] as RiskState[]) {
      expect(
        decideLowBalance({ unpaidBalance: seuilBas * 10, state }).action,
      ).toBe("RIEN");
      expect(
        decideLowBalance({ unpaidBalance: seuilHaut * 10, state }).action,
      ).toBe("RIEN");
    }
  });
});

describe("utilitaires", () => {
  it("reconnaît les états suspendus", () => {
    expect(estSuspendu("SUSPENDED_FRAUD")).toBe(true);
    expect(estSuspendu("SUSPENDED_TOS")).toBe(true);
    expect(estSuspendu("ON_PROBATION")).toBe(false);
  });

  it("expose un nom d'auteur pour reconnaître ses propres décisions", () => {
    expect(AUTEUR_CONTROLE_SOLDE).toBeTruthy();
  });
});
