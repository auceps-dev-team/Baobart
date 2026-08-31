import { afterEach, describe, expect, it } from "vitest";

import {
  POUR_TESTS,
  piloteCourant,
  piloteNomme,
  sceau,
  signaturesEgales,
} from "@/lib/payments/encaissement/pilotes";

const { BAC_A_SABLE, AUCUN } = POUR_TESTS;

const SECRET = "un-secret-de-bac-a-sable-assez-long";

const INITIAL = {
  driver: process.env.PAYMENTS_DRIVER,
  secret: process.env.PAYMENTS_SANDBOX_SECRET,
};

afterEach(() => {
  for (const [cle, valeur] of [
    ["PAYMENTS_DRIVER", INITIAL.driver],
    ["PAYMENTS_SANDBOX_SECRET", INITIAL.secret],
  ] as const) {
    if (valeur === undefined) delete process.env[cle];
    else process.env[cle] = valeur;
  }
});

function entetes(signature?: string): Headers {
  const h = new Headers();
  if (signature !== undefined) h.set("x-baobart-signature", signature);
  return h;
}

describe("la comparaison de signatures", () => {
  it("reconnaît deux signatures identiques", () => {
    expect(signaturesEgales("abc123", "abc123")).toBe(true);
  });

  it("refuse deux signatures différentes de même longueur", () => {
    expect(signaturesEgales("abc123", "abc124")).toBe(false);
  });

  it("refuse des longueurs différentes sans lever", () => {
    // `timingSafeEqual` jette sur des longueurs inégales. Laisser passer
    // l'exception ferait remonter un 500 là où on veut un refus.
    expect(signaturesEgales("abc", "abcdef")).toBe(false);
    expect(signaturesEgales("", "x")).toBe(false);
  });
});

describe("le sceau", () => {
  it("est stable pour un même secret et un même corps", () => {
    expect(sceau("k", "corps")).toBe(sceau("k", "corps"));
  });

  it("change avec le secret comme avec le corps", () => {
    expect(sceau("k1", "corps")).not.toBe(sceau("k2", "corps"));
    expect(sceau("k", "corps")).not.toBe(sceau("k", "corps ")); // un espace
  });
});

describe("le bac à sable — authentification", () => {
  it("accepte un corps correctement signé", () => {
    process.env.PAYMENTS_SANDBOX_SECRET = SECRET;
    const corps = '{"event":"e1"}';
    expect(BAC_A_SABLE.authentifier(corps, entetes(sceau(SECRET, corps)))).toBe(
      true,
    );
  });

  it("refuse un corps modifié après signature", () => {
    process.env.PAYMENTS_SANDBOX_SECRET = SECRET;
    const signature = sceau(SECRET, '{"amount":100}');
    // Le cœur de l'attaque : garder la signature, changer le montant.
    expect(
      BAC_A_SABLE.authentifier('{"amount":999999}', entetes(signature)),
    ).toBe(false);
  });

  it("refuse en l'absence d'en-tête de signature", () => {
    process.env.PAYMENTS_SANDBOX_SECRET = SECRET;
    expect(BAC_A_SABLE.authentifier("{}", entetes())).toBe(false);
  });

  it("refuse tout quand le secret est trop court", () => {
    // Un bac à sable dont le webhook accepte tout n'éprouve pas le webhook.
    process.env.PAYMENTS_SANDBOX_SECRET = "court";
    const corps = "{}";
    expect(BAC_A_SABLE.authentifier(corps, entetes(sceau("court", corps)))).toBe(
      false,
    );
    expect(BAC_A_SABLE.configure()).toBe(false);
  });
});

describe("le bac à sable — lecture du corps", () => {
  it("traduit un rappel complet", () => {
    const fait = BAC_A_SABLE.lire(
      JSON.stringify({
        event: "evt-1",
        reference: "cmd-1",
        operatorRef: "op-9",
        status: "REUSSI",
        amount: 5000,
        currency: "XOF",
      }),
    );

    expect(fait).toEqual({
      sens: "ENCAISSEMENT",
      evenement: "evt-1",
      reference: "cmd-1",
      referenceOperateur: "op-9",
      issue: "REUSSI",
      montant: 5000,
      devise: "XOF",
    });
  });

  it("rend null sur un corps illisible", () => {
    expect(BAC_A_SABLE.lire("pas du json")).toBeNull();
    expect(BAC_A_SABLE.lire("null")).toBeNull();
    expect(BAC_A_SABLE.lire("[]")).toBeNull();
  });

  it("rend null quand l'essentiel manque", () => {
    expect(BAC_A_SABLE.lire('{"reference":"c","status":"REUSSI"}')).toBeNull();
    expect(BAC_A_SABLE.lire('{"event":"e","status":"REUSSI"}')).toBeNull();
  });

  it("rend null sur une issue qu'on ne connaît pas", () => {
    // Un état inventé ne doit pas se faufiler : la suite du code raisonne par
    // exhaustivité sur trois valeurs.
    expect(
      BAC_A_SABLE.lire('{"event":"e","reference":"c","status":"PEUT_ETRE"}'),
    ).toBeNull();
  });

  it("tolère l'absence de montant sans inventer de valeur", () => {
    const fait = BAC_A_SABLE.lire(
      '{"event":"e","reference":"c","status":"ECHOUE"}',
    );
    if (fait === null || fait === "HORS_SUJET") throw new Error("attendu un fait");
    expect(fait.montant).toBeNull();
    expect(fait.devise).toBeNull();
  });

  it("sait jouer un virement sortant, pour éprouver l'autre sens", () => {
    const fait = BAC_A_SABLE.lire(
      '{"event":"e","reference":"pay-1","status":"RETOURNE","kind":"VERSEMENT"}',
    );
    if (fait === null || fait === "HORS_SUJET") throw new Error("attendu un fait");
    expect(fait.sens).toBe("VERSEMENT");
    expect(fait.issue).toBe("RETOURNE");
  });
});

describe("le pilote « aucun »", () => {
  it("refuse d'ouvrir un paiement", async () => {
    const suite = await AUCUN.ouvrir({
      reference: "c",
      montant: 1,
      devise: "XOF",
      moyen: "om",
      retour: "https://baobart.test/achat/c",
      email: "acheteur@baobart.test",
    });
    expect(suite.ok).toBe(false);
  });

  it("n'authentifie rien", () => {
    // Sans opérateur branché, tout appel entrant est un inconnu.
    expect(AUCUN.authentifier("{}", entetes("peu importe"))).toBe(false);
  });
});

describe("le choix du pilote", () => {
  it("retombe sur « aucun » quand la variable est absente", () => {
    delete process.env.PAYMENTS_DRIVER;
    expect(piloteCourant().nom).toBe("aucun");
  });

  it("retombe sur « aucun » sur un nom inconnu", () => {
    process.env.PAYMENTS_DRIVER = "operateur-imaginaire";
    expect(piloteCourant().nom).toBe("aucun");
  });

  it("refuse un bac à sable sans secret", () => {
    // Un opérateur à moitié branché encaisse peut-être, mais personne ne sait
    // dire si l'argent est arrivé. On préfère le refus franc.
    process.env.PAYMENTS_DRIVER = "bac-a-sable";
    delete process.env.PAYMENTS_SANDBOX_SECRET;
    expect(piloteCourant().nom).toBe("aucun");
  });

  it("active le bac à sable quand son secret est posé", () => {
    process.env.PAYMENTS_DRIVER = "bac-a-sable";
    process.env.PAYMENTS_SANDBOX_SECRET = SECRET;
    expect(piloteCourant().nom).toBe("bac-a-sable");
  });

  it("se retrouve par son nom, sans passer par l'environnement", () => {
    expect(piloteNomme("bac-a-sable")?.nom).toBe("bac-a-sable");
    expect(piloteNomme("operateur-imaginaire")).toBeNull();
  });
});
