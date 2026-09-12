import { describe, expect, it } from "vitest";

import { appliquer, gestesDepuis, type Geste } from "@/lib/cms/cycle";

import {
  GESTES_ORGANISATEUR,
  clauseDePortee,
  couvre,
  gestePermis,
  intitule,
  porteeDe,
  type Candidat,
  type Portee,
} from "./acces";

/** Un inscrit ordinaire : pas de badge, pas d'abonnement. */
const MEMBRE: Candidat = {
  id: "u_membre",
  role: "MEMBER",
  badgeProfessionnel: false,
  abonnementOuvert: false,
};

/** Une agence en règle : badgée et à jour. */
const AGENCE: Candidat = {
  id: "u_agence",
  role: "MEMBER",
  badgeProfessionnel: true,
  abonnementOuvert: true,
};

/** L'équipe éditoriale. */
const EDITORIAL: Candidat = { ...MEMBRE, id: "u_edito", role: "CONTENT_MANAGER" };

const TOUT: Portee = { etendue: "TOUT" };
const MIENS: Portee = { etendue: "LES_MIENS", moi: "u_agence" };

describe("la portée", () => {
  it("est fermée à qui n'a ni pouvoir ni badge", () => {
    // `null`, et non une portée vide : « cet écran n'est pas pour toi » n'est
    // pas « tu n'as pas encore d'événement ».
    expect(porteeDe(null)).toBeNull();
    expect(porteeDe(MEMBRE)).toBeNull();
  });

  it("couvre tout pour qui peut publier du contenu", () => {
    expect(porteeDe(EDITORIAL)).toEqual({ etendue: "TOUT" });
    expect(porteeDe({ ...MEMBRE, role: "ADMIN" })).toEqual({ etendue: "TOUT" });
  });

  it("se limite aux siens pour une agence badgée", () => {
    expect(porteeDe(AGENCE)).toEqual({ etendue: "LES_MIENS", moi: "u_agence" });
  });

  it("exige le badge ET l'abonnement, pas l'un ou l'autre", () => {
    // Le badge dit que le compte a été vérifié une fois ; l'abonnement qu'il
    // l'est encore. Un badge accordé en janvier ne doit pas ouvrir la porte
    // en décembre à un compte qui a cessé de payer.
    expect(porteeDe({ ...AGENCE, badgeProfessionnel: false })).toBeNull();
    expect(porteeDe({ ...AGENCE, abonnementOuvert: false })).toBeNull();
  });

  it("donne le pouvoir la priorité sur le badge", () => {
    // Quelqu'un de l'équipe qui porte aussi le badge Agence administre : lui
    // rendre « LES_MIENS » lui cacherait les événements qu'il doit relire.
    const lesDeux: Candidat = { ...EDITORIAL, badgeProfessionnel: true, abonnementOuvert: true };
    expect(porteeDe(lesDeux)).toEqual({ etendue: "TOUT" });
  });
});

describe("la clause de requête", () => {
  it("ne contraint rien pour l'administration", () => {
    expect(clauseDePortee(TOUT)).toEqual({});
  });

  it("épingle l'organisateur pour une agence", () => {
    // C'est cette ligne qui empêche une agence de lire les brouillons des
    // autres en tapant leur identifiant dans l'URL.
    expect(clauseDePortee(MIENS)).toEqual({ organizerId: "u_agence" });
  });
});

describe("la couverture d'un événement précis", () => {
  it("laisse tout passer à l'administration", () => {
    expect(couvre(TOUT, "u_agence")).toBe(true);
    expect(couvre(TOUT, "n_importe_qui")).toBe(true);
  });

  it("ne laisse à une agence que les siens", () => {
    expect(couvre(MIENS, "u_agence")).toBe(true);
    expect(couvre(MIENS, "u_autre_agence")).toBe(false);
  });
});

describe("les gestes", () => {
  it("laisse l'administration faire tous ceux que la machine permet", () => {
    const tous: Geste[] = ["soumettre", "publier", "refuser", "retirer", "reprendre"];
    for (const g of tous) expect(gestePermis(TOUT, g)).toBe(true);
  });

  it("interdit à une agence de publier elle-même", () => {
    // Le cœur de l'ouverture : une agence écrit et envoie en relecture ; c'est
    // l'équipe qui met en ligne. Sans cette ligne, un compte badgé publierait
    // sans relecture une page qui collecte des noms et des adresses.
    expect(gestePermis(MIENS, "publier")).toBe(false);
  });

  it("interdit à une agence de se refuser à elle-même", () => {
    expect(gestePermis(MIENS, "refuser")).toBe(false);
  });

  it("lui laisse corriger et retirer son propre événement", () => {
    // Retirer n'est pas publier : c'est enlever de la vue. Quelqu'un qui
    // s'aperçoit d'une erreur doit pouvoir le faire tout de suite.
    expect(gestePermis(MIENS, "soumettre")).toBe(true);
    expect(gestePermis(MIENS, "retirer")).toBe(true);
    expect(gestePermis(MIENS, "reprendre")).toBe(true);
  });

  it("ne nomme que des gestes que la machine à états connaît", () => {
    // Une faute de frappe dans `GESTES_ORGANISATEUR` passerait inaperçue : le
    // geste n'existerait pas, donc ne serait jamais permis, donc le bouton
    // manquerait — sans erreur nulle part. On vérifie donc que chacun est
    // atteignable depuis au moins un état.
    const connus = new Set(
      (["BROUILLON", "SOUMIS", "PUBLIE", "REFUSE", "RETIRE"] as const).flatMap(
        gestesDepuis,
      ),
    );
    for (const g of GESTES_ORGANISATEUR) expect(connus.has(g)).toBe(true);
  });

  it("n'ouvre jamais à une agence un geste qui met en ligne", () => {
    // Le test qui doit casser si quelqu'un ajoute `publier` à la liste « pour
    // dépanner ». La règle, formulée autrement : aucun geste d'organisateur ne
    // doit mener à `PUBLIE`.
    for (const etat of ["BROUILLON", "SOUMIS", "PUBLIE", "REFUSE", "RETIRE"] as const) {
      for (const geste of gestesDepuis(etat)) {
        if (!gestePermis(MIENS, geste)) continue;
        expect(
          // On rejoue la transition : elle ne doit jamais aboutir en ligne.
          gestesVersPublie(etat, geste),
        ).toBe(false);
      }
    }
  });
});

describe("l'intitulé", () => {
  it("dit à qui lit ce qu'il regarde", () => {
    // Un titre est une garde de plus : « Événements » à une agence lui ferait
    // croire qu'elle voit ceux des autres.
    expect(intitule(TOUT).titre).toBe("Événements");
    expect(intitule(MIENS).titre).toBe("Mes événements");
    expect(intitule(MIENS).description).toContain("relit");
  });
});

/** La transition mène-t-elle en ligne ? Rejouée sur la machine, jamais devinée. */
function gestesVersPublie(
  etat: Parameters<typeof gestesDepuis>[0],
  geste: Geste,
): boolean {
  const suite = appliquer(etat, geste);
  return suite.ok && suite.vers === "PUBLIE";
}
