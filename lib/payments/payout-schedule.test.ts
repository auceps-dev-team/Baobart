import { describe, expect, it } from "vitest";

import {
  CONFIG_PAR_DEFAUT,
  RAILS_BAOBART,
  cycleInitial,
  cyclePourDateVersement,
  cycleSuivant,
  dateVersementPourCycle,
  finDePeriodePourVersement,
  prochaineDateVersement,
  projeterVersements,
  type PayoutRail,
} from "./payout-schedule";

/** Raccourci de lecture : une date UTC depuis « AAAA-MM-JJ ». */
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

const wave = RAILS_BAOBART.wave as PayoutRail; // mardi
const banque = RAILS_BAOBART.bank as PayoutRail; // lundi
const vendrediRail: PayoutRail = { id: "x", label: "Vendredi", weekday: 5 };

describe("cycles — l'ancrage est toujours un vendredi", () => {
  it("hebdomadaire : prend le vendredi de la semaine en cours", () => {
    // 2026-08-05 est un mercredi → vendredi 7.
    expect(iso(cycleInitial(d("2026-08-05"), "WEEKLY"))).toBe("2026-08-07");
  });

  it("hebdomadaire : un vendredi reste ce vendredi", () => {
    expect(iso(cycleInitial(d("2026-08-07"), "WEEKLY"))).toBe("2026-08-07");
  });

  it("mensuel : dernier vendredi du mois", () => {
    expect(iso(cycleInitial(d("2026-08-05"), "MONTHLY"))).toBe("2026-08-28");
  });

  it("trimestriel : dernier vendredi du trimestre", () => {
    // Août est dans le trimestre juillet-septembre.
    expect(iso(cycleInitial(d("2026-08-05"), "QUARTERLY"))).toBe("2026-09-25");
  });

  it("avance d'une semaine, d'un mois, d'un trimestre", () => {
    expect(iso(cycleSuivant(d("2026-08-07"), "WEEKLY"))).toBe("2026-08-14");
    expect(iso(cycleSuivant(d("2026-08-28"), "MONTHLY"))).toBe("2026-09-25");
    expect(iso(cycleSuivant(d("2026-09-25"), "QUARTERLY"))).toBe("2026-12-25");
  });

  it("ne déborde pas sur le mois suivant en fin de mois", () => {
    // 31 janvier + 1 mois ne doit pas donner le 2 ou 3 mars.
    const suivant = cycleSuivant(d("2027-01-29"), "MONTHLY");
    expect(iso(suivant)).toBe("2027-02-26");
  });
});

describe("date de cycle vs date de versement", () => {
  it("décale la date de versement au jour du rail", () => {
    const cycle = d("2026-08-07"); // vendredi

    expect(iso(dateVersementPourCycle(cycle, wave))).toBe("2026-08-04"); // mardi
    expect(iso(dateVersementPourCycle(cycle, banque))).toBe("2026-08-03"); // lundi
    expect(iso(dateVersementPourCycle(cycle, vendrediRail))).toBe("2026-08-07");
  });

  it("retrouve le cycle depuis la date de versement", () => {
    for (const rail of [wave, banque, vendrediRail]) {
      const cycle = d("2026-08-07");
      const versement = dateVersementPourCycle(cycle, rail);
      expect(iso(cyclePourDateVersement(versement, rail))).toBe("2026-08-07");
    }
  });

  it("inclut les MÊMES ventes quel que soit le rail — la règle centrale", () => {
    const cycle = d("2026-08-07");

    const finWave = finDePeriodePourVersement(
      dateVersementPourCycle(cycle, wave),
      wave,
    );
    const finBanque = finDePeriodePourVersement(
      dateVersementPourCycle(cycle, banque),
      banque,
    );

    // Payés mardi et jeudi, mais arrêtés à la même date de ventes.
    expect(iso(finWave)).toBe("2026-07-31");
    expect(iso(finWave)).toBe(iso(finBanque));
  });

  it("applique le délai de rétention de 7 jours", () => {
    const versement = dateVersementPourCycle(d("2026-08-07"), vendrediRail);
    expect(iso(finDePeriodePourVersement(versement, vendrediRail))).toBe(
      "2026-07-31",
    );
  });
});

describe("projection — « quand serai-je payé, et combien »", () => {
  /** Solde qui croît de 10 000 F par semaine écoulée depuis le 1er juillet. */
  const soldeCroissant = (date: Date) => {
    const semaines = Math.max(
      0,
      Math.floor(
        (date.getTime() - d("2026-07-01").getTime()) / (7 * 86_400_000)),
    );
    return semaines * 10_000;
  };

  it("annonce une date et un montant", () => {
    const [premier] = projeterVersements({
      frequency: "WEEKLY",
      rail: wave,
      soldeVersableJusqua: soldeCroissant,
      today: d("2026-08-03"), // lundi
      limite: 1,
    });

    expect(premier).toBeDefined();
    expect(iso(premier!.payoutDate)).toBe("2026-08-04"); // mardi, rail Wave
    expect(premier!.amount).toBeGreaterThan(0);
  });

  it("ne compte jamais deux fois la même vente", () => {
    const projection = projeterVersements({
      frequency: "WEEKLY",
      rail: vendrediRail,
      soldeVersableJusqua: soldeCroissant,
      today: d("2026-08-03"),
      limite: 4,
    });

    const cumul = projection.reduce((t, v) => t + v.amount, 0);
    const dernier = projection[projection.length - 1]!;

    expect(cumul).toBe(soldeCroissant(dernier.periodEnd));
  });

  it("rend les échéances dans l'ordre chronologique", () => {
    const projection = projeterVersements({
      frequency: "WEEKLY",
      rail: banque,
      soldeVersableJusqua: soldeCroissant,
      today: d("2026-08-03"),
      limite: 4,
    });

    for (let i = 1; i < projection.length; i += 1) {
      expect(projection[i]!.payoutDate.getTime()).toBeGreaterThan(
        projection[i - 1]!.payoutDate.getTime(),
      );
    }
  });

  it("saute le cycle si le rail est déjà passé cette semaine", () => {
    // Mercredi : le rail Wave (mardi) est passé.
    const [premier] = projeterVersements({
      frequency: "WEEKLY",
      rail: wave,
      soldeVersableJusqua: soldeCroissant,
      today: d("2026-08-05"),
      limite: 1,
    });

    expect(iso(premier!.payoutDate)).toBe("2026-08-11"); // mardi suivant
  });

  it("reporte au cycle suivant si le créateur a déjà été payé aujourd'hui", () => {
    const sansPaiement = prochaineDateVersement({
      frequency: "WEEKLY",
      rail: wave,
      soldeVersableJusqua: soldeCroissant,
      today: d("2026-08-04"),
    });
    const avecPaiement = prochaineDateVersement({
      frequency: "WEEKLY",
      rail: wave,
      soldeVersableJusqua: soldeCroissant,
      today: d("2026-08-04"),
      dejaPayeAujourdhui: true,
    });

    expect(iso(sansPaiement!)).toBe("2026-08-04");
    expect(iso(avecPaiement!)).toBe("2026-08-11");
  });
});

describe("projection — seuil minimum", () => {
  it("ne verse rien tant que le seuil n'est pas atteint", () => {
    expect(
      prochaineDateVersement({
        frequency: "WEEKLY",
        rail: wave,
        soldeVersableJusqua: () => 0,
        today: d("2026-08-03"),
      }),
    ).toBeNull();
  });

  it("fait rouler la somme sur le cycle suivant plutôt que de la perdre", () => {
    // 600 F par semaine, seuil à 1 000 F : il faut deux semaines pour verser.
    const solde = (date: Date) => {
      const semaines = Math.max(
        0,
        Math.floor(
          (date.getTime() - d("2026-07-24").getTime()) / (7 * 86_400_000)),
      );
      return semaines * 600;
    };

    const [premier] = projeterVersements({
      frequency: "WEEKLY",
      rail: vendrediRail,
      soldeVersableJusqua: solde,
      today: d("2026-08-03"),
      limite: 1,
    });

    expect(premier).toBeDefined();
    expect(premier!.amount).toBeGreaterThanOrEqual(
      CONFIG_PAR_DEFAUT.minimumAmount,
    );
    // Le versement porte bien le cumul de plusieurs semaines, pas 600 F.
    expect(premier!.amount % 600).toBe(0);
    expect(premier!.amount).toBeGreaterThan(600);
  });
});
