import { describe, expect, it } from "vitest";

import {
  FAMILLES_MERITE,
  MERITES,
  PIONNIERS,
  cyclesPayesDAffilee,
  lesPlusProches,
  meriteDe,
  meritesObtenus,
  tetesDuMois,
  vitrineDesMerites,
  type Mesures,
} from "./merites";

const JOUR = 86_400_000;
const MAINTENANT = new Date("2026-11-05T12:00:00Z");

function mesures(partiel: Partial<Mesures> = {}): Mesures {
  return {
    maintenant: MAINTENANT,
    inscritLe: new Date(MAINTENANT.getTime() - 200 * JOUR),
    rangDInscription: 5_000,
    ressourcesPubliees: 0,
    acheteurs: 0,
    acheteursDepuisLeDernierLitige: 0,
    abonnes: 0,
    cyclesPayesDAffilee: 0,
    abonnementOuvert: true,
    avisRecus: { nombre: 0, moyenne: null },
    avisRediges: 0,
    createurDuMoisJusquAu: null,
    vip: false,
    ...partiel,
  };
}

const codes = (m: Mesures) => meritesObtenus(m).map((x) => x.code);

describe("le catalogue", () => {
  it("porte les vingt mérites de la maquette, chacun une fois", () => {
    expect(MERITES).toHaveLength(20);
    expect(new Set(MERITES.map((m) => m.code)).size).toBe(20);
  });

  // Jusqu'au 09/11, « Bien noté » et « Bon public » étaient ici aussi : le lot 4
  // (avis notés) les rend mesurables. Seul « Répond vite » attend (lot 10).
  it("garde « Répond vite » hors d'atteinte, avec sa raison", () => {
    const enAttente = MERITES.filter((m) => m.enAttente !== null).map((m) => m.code).sort();
    expect(enAttente).toEqual(["FAST_RESPONDER"]);
    // Un compte qui coche tout le reste ne les obtient pas pour autant.
    const tout = mesures({ ressourcesPubliees: 500, acheteurs: 5_000, acheteursDepuisLeDernierLitige: 5_000, abonnes: 9_000 });
    expect(codes(tout)).not.toContain("WELL_RATED");
    expect(codes(tout)).not.toContain("FAST_RESPONDER");
  });

  it("publie « Répond vite » sous 24 h, comme tranché le 04/11", () => {
    expect(MERITES.find((m) => m.code === "FAST_RESPONDER")!.critere).toContain("24 h");
  });
});

describe("l'ancienneté", () => {
  it("fait du 200e inscrit un Pionnier, et pas du 201e", () => {
    expect(PIONNIERS).toBe(200);
    expect(codes(mesures({ rangDInscription: 200 }))).toContain("PIONEER");
    expect(codes(mesures({ rangDInscription: 201 }))).not.toContain("PIONEER");
  });

  it("donne « Nouveau talent » avant le 90e jour, à condition d'avoir publié", () => {
    const jeune = { inscritLe: new Date(MAINTENANT.getTime() - 89 * JOUR) };
    expect(codes(mesures({ ...jeune, ressourcesPubliees: 1 }))).toContain("NEW_TALENT");
    expect(codes(mesures({ ...jeune, ressourcesPubliees: 0 }))).not.toContain("NEW_TALENT");
    // « Disparaît au 91e jour — c'est voulu. »
    const vieux = { inscritLe: new Date(MAINTENANT.getTime() - 91 * JOUR), ressourcesPubliees: 1 };
    expect(codes(mesures(vieux))).not.toContain("NEW_TALENT");
  });

  it("compte « Un an » au jour anniversaire, pas la veille", () => {
    expect(codes(mesures({ inscritLe: new Date("2025-11-05T12:00:00Z") }))).toContain("ONE_YEAR");
    expect(codes(mesures({ inscritLe: new Date("2025-11-06T12:00:00Z") }))).not.toContain("ONE_YEAR");
  });
});

describe("les paliers", () => {
  it("tient compte des seuils exacts : 10 ventes oui, 9 non", () => {
    expect(codes(mesures({ acheteurs: 10 }))).toEqual(expect.arrayContaining(["FIRST_SALE", "TEN_SALES"]));
    expect(codes(mesures({ acheteurs: 9 }))).not.toContain("TEN_SALES");
  });

  it("lit « Sans litige » sur les ventes depuis le dernier litige, pas sur le total", () => {
    expect(codes(mesures({ acheteurs: 300, acheteursDepuisLeDernierLitige: 49 }))).not.toContain("NO_DISPUTE");
    expect(codes(mesures({ acheteurs: 300, acheteursDepuisLeDernierLitige: 50 }))).toContain("NO_DISPUTE");
  });
});

describe("la vitrine publique", () => {
  it("range du plus rare au plus courant, et coupe à six", () => {
    const riche = mesures({
      rangDInscription: 12,
      inscritLe: new Date("2022-01-01T00:00:00Z"),
      ressourcesPubliees: 120,
      acheteurs: 1_200,
      acheteursDepuisLeDernierLitige: 80,
      abonnes: 600,
      createurDuMoisJusquAu: new Date(MAINTENANT.getTime() + 10 * JOUR),
    });
    const obtenus = meritesObtenus(riche);
    expect(obtenus[0]!.code).toBe("TOP_CREATOR");
    expect(obtenus.at(-1)!.code).toBe("FIRST_PUBLICATION");

    const { visibles, reste } = vitrineDesMerites(obtenus);
    expect(visibles).toHaveLength(6);
    expect(reste).toHaveLength(obtenus.length - 6);
  });
});

describe("les trois plus proches", () => {
  it("montre la distance chiffrée, du plus avancé au moins avancé", () => {
    const m = mesures({ acheteurs: 997, ressourcesPubliees: 8, abonnes: 412 });
    const proches = lesPlusProches(m);
    expect(proches.map((p) => p.merite.code)).toEqual(["THOUSAND_SALES", "COMMUNITY_PILLAR", "TEN_RESOURCES"]);
    expect(proches[0]!.progression.ecart).toBe("il te manque 3 ventes à de nouveaux acheteurs");
    expect(proches[0]!.pourcentage).toBe(99);
  });

  it("n'affiche pas à un acheteur ce qu'il n'a pas commencé", () => {
    const acheteur = mesures();
    const proches = lesPlusProches(acheteur).map((p) => p.merite.code);
    expect(proches).not.toContain("FIRST_SALE");
    expect(proches).not.toContain("HUNDRED_RESOURCES");
    // Le temps, lui, avance pour tout le monde.
    expect(proches).toContain("ONE_YEAR");
  });

  it("n'y met jamais ce qui ne se rapproche pas, ni ce qui ne se mesure pas", () => {
    const proches = lesPlusProches(mesures({ acheteurs: 15 }), 20).map((p) => p.merite.code);
    for (const code of ["PIONEER", "TOP_CREATOR", "VIP_CREATOR", "WELL_RATED", "FAST_RESPONDER"]) {
      expect(proches).not.toContain(code);
    }
  });
});

describe("Fidèle : les cycles payés d'affilée", () => {
  const debut = new Date("2025-11-01T00:00:00Z").getTime();
  const mensuel = (i: number, retardJours = 0, abonnementId = "a1") => ({
    abonnementId,
    echeance: new Date(debut + i * 30 * JOUR),
    payeLe: new Date(debut + i * 30 * JOUR + retardJours * JOUR),
    joursDuCycle: 30,
  });
  const apres = (i: number) => new Date(debut + i * 30 * JOUR + 10 * JOUR);

  it("compte douze cycles payés à temps", () => {
    const paiements = Array.from({ length: 12 }, (_, i) => mensuel(i));
    expect(cyclesPayesDAffilee(paiements, apres(11), 7)).toBe(12);
  });

  it("repart de un quand une échéance n'a pas été payée", () => {
    const paiements = [0, 1, 2, 4, 5].map((i) => mensuel(i));
    expect(cyclesPayesDAffilee(paiements, apres(5), 7)).toBe(2);
  });

  it("repart de un quand un paiement arrive après la grâce", () => {
    const paiements = [mensuel(0), mensuel(1), mensuel(2, 9), mensuel(3)];
    expect(cyclesPayesDAffilee(paiements, apres(3), 7)).toBe(2);
  });

  it("tombe à zéro quand la série ne court plus", () => {
    const paiements = Array.from({ length: 12 }, (_, i) => mensuel(i));
    // Le dernier cycle payé est fini, grâce comprise, sans paiement suivant.
    expect(cyclesPayesDAffilee(paiements, new Date(debut + 11 * 30 * JOUR + 38 * JOUR), 7)).toBe(0);
  });

  it("ne raccorde pas deux abonnements différents", () => {
    const paiements = [mensuel(0, 0, "a1"), mensuel(1, 0, "a2")];
    expect(cyclesPayesDAffilee(paiements, apres(1), 7)).toBe(1);
  });
});

describe("Créateur du mois", () => {
  it("retient la part de tête, arrondie au-dessus, au-dessus du plancher", () => {
    const classement = [
      { vendeurId: "a", ventes: 40 },
      { vendeurId: "b", ventes: 25 },
      { vendeurId: "c", ventes: 19 },
    ];
    // 30 créateurs actifs : 5 % → 1,5 → 2 places.
    expect([...tetesDuMois(classement, 30)].sort()).toEqual(["a", "b"]);
  });

  it("ne retient personne sous le plancher de 20 ventes", () => {
    expect(tetesDuMois([{ vendeurId: "a", ventes: 19 }], 1).size).toBe(0);
  });

  it("garde tous les ex æquo du dernier rang retenu", () => {
    const classement = [
      { vendeurId: "a", ventes: 30 },
      { vendeurId: "b", ventes: 30 },
    ];
    // 10 actifs : une place, mais deux créateurs à égalité.
    expect(tetesDuMois(classement, 10).size).toBe(2);
  });
});

describe("le titre rangé de Créateur du mois", () => {
  it("se porte tant que sa date n'est pas passée, et s'éteint seul ensuite", () => {
    const enCours = mesures({ createurDuMoisJusquAu: new Date(MAINTENANT.getTime() + JOUR) });
    const eteint = mesures({ createurDuMoisJusquAu: new Date(MAINTENANT.getTime() - 1) });
    expect(codes(enCours)).toContain("TOP_CREATOR");
    expect(codes(eteint)).not.toContain("TOP_CREATOR");
    expect(codes(mesures())).not.toContain("TOP_CREATOR");
  });
});

describe("l'anti-triche (décision du 08/11)", () => {
  it("publie la règle des acheteurs différents et des abonnés qui comptent", () => {
    const critere = (code: string) => MERITES.find((m) => m.code === code)!.critere;
    expect(critere("HUNDRED_SALES")).toContain("cent acheteurs différents");
    expect(critere("COMMUNITY_PILLAR")).toContain("7 jours");
    expect(critere("TOP_CREATOR")).toContain("acheteurs");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Ajoutés le 08/11/2026 après le premier passage de Stryker (score 58 %) :
// chacun tue une mutation qui avait survécu — une borne, un tri, une valeur.

describe("ce que Stryker a trouvé de non vérifié", () => {
  it("garde les vingt codes de la maquette, dans l'ordre de ses familles", () => {
    expect(MERITES.map((m) => m.code)).toEqual([
      "NEW_TALENT", "PIONEER", "ONE_YEAR", "THREE_YEARS", "LOYAL_SUBSCRIBER",
      "FIRST_PUBLICATION", "TEN_RESOURCES", "FIFTY_RESOURCES", "HUNDRED_RESOURCES",
      "FIRST_SALE", "TEN_SALES", "HUNDRED_SALES", "THOUSAND_SALES", "TOP_CREATOR",
      "WELL_RATED", "NO_DISPUTE", "FAST_RESPONDER",
      "COMMUNITY_PILLAR", "HELPFUL_REVIEWER", "VIP_CREATOR",
    ]);
    expect(FAMILLES_MERITE.map((f) => f.code)).toEqual(["ANCIENNETE", "PRODUCTION", "VENTES", "QUALITE", "COMMUNAUTE"]);
    for (const m of MERITES) expect(FAMILLES_MERITE.some((f) => f.code === m.famille)).toBe(true);
    expect(meriteDe("PIONEER").nom).toBe("Pionnier");
  });

  it("accorde le singulier et le pluriel de la distance", () => {
    expect(meriteDe("FIRST_SALE").progression(mesures())!.ecart).toBe("il te manque 1 vente à un nouvel acheteur");
    expect(meriteDe("TEN_SALES").progression(mesures({ acheteurs: 8 }))!.ecart).toBe("il te manque 2 ventes à de nouveaux acheteurs");
    expect(meriteDe("TEN_SALES").progression(mesures({ acheteurs: 8 }))!.detail).toBe("8 acheteurs différents sur 10");
  });

  it("compte les jours qui restent avant un anniversaire, au jour près", () => {
    // Inscrit 200 jours avant le 05/11/2026 : le 19 avril 2026.
    const p = meriteDe("ONE_YEAR").progression(mesures())!;
    expect(p.ecart).toBe("encore 165 jours");
    expect(p.detail).toBe("inscrit le 19 avril 2026");
  });

  it("borne « Nouveau talent » : 90 jours pile, c'est fini, et la distance le dit", () => {
    const pile = mesures({ inscritLe: new Date(MAINTENANT.getTime() - 90 * JOUR), ressourcesPubliees: 1 });
    expect(codes(pile)).not.toContain("NEW_TALENT");
    expect(meriteDe("NEW_TALENT").progression(pile)).toBeNull();

    const avantDernierJour = mesures({ inscritLe: new Date(MAINTENANT.getTime() - 89 * JOUR) });
    expect(meriteDe("NEW_TALENT").progression(avantDernierJour)).toEqual({
      valeur: 0,
      cible: 1,
      ecart: "il te manque 1 ressource publiée",
      detail: "à publier d'ici 1 jour",
    });
    const publie = mesures({ inscritLe: new Date(MAINTENANT.getTime() - 60 * JOUR), ressourcesPubliees: 4 });
    expect(meriteDe("NEW_TALENT").progression(publie)!.valeur).toBe(1);
  });

  it("éteint « Créateur du mois » à l'instant même de sa fin", () => {
    expect(codes(mesures({ createurDuMoisJusquAu: MAINTENANT }))).not.toContain("TOP_CREATOR");
    expect(meriteDe("TOP_CREATOR").critere).toContain("5 %");
  });

  it("rend false, pas un vide, pour ce qui ne se mesure pas, et null pour ce qui ne se rapproche pas", () => {
    expect(meriteDe("WELL_RATED").obtenu(mesures())).toBe(false);
    expect(meriteDe("PIONEER").progression(mesures())).toBeNull();
    expect(meriteDe("VIP_CREATOR").obtenu(mesures({ vip: true }))).toBe(true);
  });

  it("écarte des plus proches tout ce qui est à zéro, même au-delà de trois", () => {
    const tous = lesPlusProches(mesures(), 20).map((p) => p.merite.code);
    expect(tous).toEqual(["ONE_YEAR", "THREE_YEARS"]);
  });
});

describe("Fidèle, cas limites", () => {
  const debut = new Date("2025-11-01T00:00:00Z").getTime();
  const p = (i: number, retardJours = 0) => ({
    abonnementId: "a1",
    echeance: new Date(debut + i * 30 * JOUR),
    payeLe: new Date(debut + i * 30 * JOUR + retardJours * JOUR),
    joursDuCycle: 30,
  });

  it("ne dépend pas de l'ordre où les paiements arrivent", () => {
    const desordre = [p(2), p(0), p(3), p(1)];
    expect(cyclesPayesDAffilee(desordre, new Date(debut + 3 * 30 * JOUR + JOUR), 7)).toBe(4);
  });

  it("rend zéro sans aucun paiement", () => {
    expect(cyclesPayesDAffilee([], MAINTENANT, 7)).toBe(0);
  });

  it("compte un paiement arrivé au dernier instant de la grâce, pas une seconde après", () => {
    const pile = [p(0), p(1, 7)];
    expect(cyclesPayesDAffilee(pile, new Date(debut + 30 * JOUR + 8 * JOUR), 7)).toBe(2);
    const tard = [p(0), { ...p(1, 7), payeLe: new Date(debut + 30 * JOUR + 7 * JOUR + 1) }];
    expect(cyclesPayesDAffilee(tard, new Date(debut + 30 * JOUR + 8 * JOUR), 7)).toBe(1);
  });

  it("court jusqu'au dernier instant de la grâce du cycle payé, et plus après", () => {
    const serie = [p(0), p(1)];
    const fin = debut + 30 * JOUR + (30 + 7) * JOUR;
    expect(cyclesPayesDAffilee(serie, new Date(fin), 7)).toBe(2);
    expect(cyclesPayesDAffilee(serie, new Date(fin + 1), 7)).toBe(0);
    // Pendant la grâce, avant son terme : la série court encore.
    expect(cyclesPayesDAffilee(serie, new Date(fin - 3 * JOUR), 7)).toBe(2);
  });
});

describe("Créateur du mois, cas limites", () => {
  it("compte 5 % des actifs, pas des actifs divisés par 5 %", () => {
    const classement = Array.from({ length: 10 }, (_, i) => ({ vendeurId: `v${i}`, ventes: 100 - i }));
    // 100 actifs : 5 places, sur 10 créateurs au-dessus du plancher.
    expect([...tetesDuMois(classement, 100)].sort()).toEqual(["v0", "v1", "v2", "v3", "v4"]);
  });

  it("classe quel que soit l'ordre reçu", () => {
    const desordre = [
      { vendeurId: "petit", ventes: 21 },
      { vendeurId: "grand", ventes: 80 },
      { vendeurId: "moyen", ventes: 40 },
    ];
    expect([...tetesDuMois(desordre, 20)]).toEqual(["grand"]);
  });

  it("retient vingt acheteurs pile, et personne quand il n'y a aucun actif", () => {
    expect([...tetesDuMois([{ vendeurId: "a", ventes: 20 }], 1)]).toEqual(["a"]);
    expect(tetesDuMois([{ vendeurId: "a", ventes: 30 }], 0).size).toBe(0);
  });
});

describe("ce que le second passage de Stryker a trouvé (08/11)", () => {
  it("dit la distance de chaque palier avec son unité, jamais « undefined »", () => {
    const m = mesures({ ressourcesPubliees: 7, cyclesPayesDAffilee: 9, acheteurs: 60, acheteursDepuisLeDernierLitige: 41, abonnes: 499 });
    const distance = (code: Parameters<typeof meriteDe>[0]) => {
      const p = meriteDe(code).progression(m)!;
      return `${p.ecart} · ${p.detail}`;
    };
    expect(distance("TEN_RESOURCES")).toBe("il te manque 3 ressources · 7 ressources publiées sur 10");
    expect(distance("FIFTY_RESOURCES")).toBe("il te manque 43 ressources · 7 ressources publiées sur 50");
    expect(distance("HUNDRED_RESOURCES")).toBe("il te manque 93 ressources · 7 ressources publiées sur 100");
    expect(meriteDe("FIRST_PUBLICATION").progression(mesures())!.ecart).toBe("il te manque 1 ressource");
    expect(distance("LOYAL_SUBSCRIBER")).toBe("il te manque 3 cycles payés · 9 cycles payés d'affilée sur 12 · un cycle manqué remet à zéro");
    expect(distance("NO_DISPUTE")).toBe("il te manque 9 ventes à de nouveaux acheteurs · 41 acheteurs servis sans litige sur 50 · un litige remet à zéro");
    expect(distance("COMMUNITY_PILLAR")).toBe("il te manque 1 abonné · 499 abonnés sur 500");
  });

  /**
   * Le catalogue PUBLIÉ : noms, chiffres des jetons, couleurs, critères.
   * « Critères transparents et publiés » (`SPEC_GAMIFICATION` §1) : changer
   * un critère est une décision, pas une retouche. L'instantané rend chaque
   * changement visible dans la revue — à accepter avec `vitest -u`, exprès.
   */
  it("ne change pas de critère publié sans qu'on le voie", () => {
    expect(
      MERITES.map(({ code, nom, famille, glyphe, fond, encre, critere, enAttente }) => ({ code, nom, famille, glyphe, fond, encre, critere, enAttente })),
    ).toMatchSnapshot();
  });
});

describe("l'accord de la ligne de détail (vu sur la capture du 08/11)", () => {
  it("met 0 et 1 au singulier, comme le français", () => {
    expect(meriteDe("TEN_RESOURCES").progression(mesures({ ressourcesPubliees: 1 }))!.detail).toBe("1 ressource publiée sur 10");
    expect(meriteDe("TEN_SALES").progression(mesures({ acheteurs: 1 }))!.detail).toBe("1 acheteur différent sur 10");
    expect(meriteDe("COMMUNITY_PILLAR").progression(mesures({ abonnes: 0 }))!.detail).toBe("0 abonné sur 500");
    expect(meriteDe("NO_DISPUTE").progression(mesures({ acheteursDepuisLeDernierLitige: 1 }))!.detail).toBe(
      "1 acheteur servi sans litige sur 50 · un litige remet à zéro",
    );
    expect(meriteDe("LOYAL_SUBSCRIBER").progression(mesures({ cyclesPayesDAffilee: 1 }))!.detail).toBe(
      "1 cycle payé d'affilée sur 12 · un cycle manqué remet à zéro",
    );
  });
});

describe("« Bien noté » et « Bon public », mesurables depuis le lot 4 (09/11)", () => {
  it("exige la note ET le nombre : 4,5 sur 20 avis, pas 5,0 sur deux", () => {
    expect(codes(mesures({ avisRecus: { nombre: 20, moyenne: 4.5 } }))).toContain("WELL_RATED");
    expect(codes(mesures({ avisRecus: { nombre: 19, moyenne: 5 } }))).not.toContain("WELL_RATED");
    expect(codes(mesures({ avisRecus: { nombre: 200, moyenne: 4.4 } }))).not.toContain("WELL_RATED");
  });

  it("dit la distance en avis tant qu'il en manque, et rien quand c'est la note qui manque", () => {
    const p = meriteDe("WELL_RATED").progression(mesures({ avisRecus: { nombre: 12, moyenne: 4.8 } }))!;
    expect(p.ecart).toBe("il te manque 8 avis");
    expect(p.detail).toBe("12 avis comptés sur 20 · note actuelle 4,8");
    expect(meriteDe("WELL_RATED").progression(mesures({ avisRecus: { nombre: 1, moyenne: 5 } }))!.detail).toBe(
      "1 avis compté sur 20 · note actuelle 5",
    );
    expect(meriteDe("WELL_RATED").progression(mesures({ avisRecus: { nombre: 30, moyenne: 4.2 } }))).toBeNull();
  });

  it("donne « Bon public » au 25e avis rédigé", () => {
    expect(codes(mesures({ avisRediges: 25 }))).toContain("HELPFUL_REVIEWER");
    expect(codes(mesures({ avisRediges: 24 }))).not.toContain("HELPFUL_REVIEWER");
    expect(meriteDe("HELPFUL_REVIEWER").progression(mesures({ avisRediges: 1 }))!.detail).toBe("1 avis rédigé sur 25");
  });
});
