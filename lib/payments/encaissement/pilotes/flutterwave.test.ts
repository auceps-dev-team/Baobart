import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import {
  FLUTTERWAVE,
  referencePour,
} from "@/lib/payments/encaissement/pilotes/flutterwave";

const HASH = "un-secret-de-webhook-assez-long";

const INITIAL = {
  id: process.env.FLUTTERWAVE_CLIENT_ID,
  secret: process.env.FLUTTERWAVE_CLIENT_SECRET,
  hash: process.env.FLUTTERWAVE_SECRET_HASH,
};

afterEach(() => {
  for (const [cle, valeur] of [
    ["FLUTTERWAVE_CLIENT_ID", INITIAL.id],
    ["FLUTTERWAVE_CLIENT_SECRET", INITIAL.secret],
    ["FLUTTERWAVE_SECRET_HASH", INITIAL.hash],
  ] as const) {
    if (valeur === undefined) delete process.env[cle];
    else process.env[cle] = valeur;
  }
});

function entetes(signature?: string): Headers {
  const h = new Headers();
  if (signature !== undefined) h.set("flutterwave-signature", signature);
  return h;
}

function signer(secret: string, corps: string): string {
  return createHmac("sha256", secret).update(corps, "utf8").digest("base64");
}

describe("la configuration", () => {
  it("exige les trois secrets à la fois", () => {
    process.env.FLUTTERWAVE_CLIENT_ID = "id";
    process.env.FLUTTERWAVE_CLIENT_SECRET = "secret";
    process.env.FLUTTERWAVE_SECRET_HASH = HASH;
    expect(FLUTTERWAVE.configure()).toBe(true);

    // Sans le hash de webhook, on saurait ouvrir un paiement mais pas
    // reconnaître la réponse. C'est le pire des deux mondes : de l'argent part,
    // et rien ne le confirme.
    delete process.env.FLUTTERWAVE_SECRET_HASH;
    expect(FLUTTERWAVE.configure()).toBe(false);

    process.env.FLUTTERWAVE_SECRET_HASH = HASH;
    delete process.env.FLUTTERWAVE_CLIENT_ID;
    expect(FLUTTERWAVE.configure()).toBe(false);
  });

  it("refuse un hash trop court pour être un secret", () => {
    process.env.FLUTTERWAVE_CLIENT_ID = "id";
    process.env.FLUTTERWAVE_CLIENT_SECRET = "secret";
    process.env.FLUTTERWAVE_SECRET_HASH = "court";
    expect(FLUTTERWAVE.configure()).toBe(false);
  });
});

describe("l'authentification d'un rappel", () => {
  it("accepte un corps signé en SHA-256, rendu en base64", () => {
    process.env.FLUTTERWAVE_SECRET_HASH = HASH;
    const corps = '{"type":"charge.completed"}';
    expect(FLUTTERWAVE.authentifier(corps, entetes(signer(HASH, corps)))).toBe(
      true,
    );
  });

  it("refuse la même signature rendue en hexadécimal", () => {
    // Paystack signe en hexadécimal, Flutterwave en base64. Confondre les deux
    // formes donne un refus permanent que rien n'explique — et qu'on finit par
    // « corriger » en désactivant la vérification.
    process.env.FLUTTERWAVE_SECRET_HASH = HASH;
    const corps = "{}";
    const hexa = createHmac("sha256", HASH).update(corps).digest("hex");
    expect(FLUTTERWAVE.authentifier(corps, entetes(hexa))).toBe(false);
  });

  it("refuse un corps modifié après signature", () => {
    process.env.FLUTTERWAVE_SECRET_HASH = HASH;
    const signature = signer(HASH, '{"amount":100}');
    expect(
      FLUTTERWAVE.authentifier('{"amount":999999}', entetes(signature)),
    ).toBe(false);
  });

  it("refuse sans en-tête, et sans hash", () => {
    process.env.FLUTTERWAVE_SECRET_HASH = HASH;
    expect(FLUTTERWAVE.authentifier("{}", entetes())).toBe(false);

    delete process.env.FLUTTERWAVE_SECRET_HASH;
    expect(FLUTTERWAVE.authentifier("{}", entetes(signer(HASH, "{}")))).toBe(
      false,
    );
  });
});

describe("la lecture d'un rappel", () => {
  function corps(patch: Record<string, unknown> = {}) {
    return JSON.stringify({
      id: "evt_9",
      type: "charge.completed",
      data: {
        id: "chg_Hq4oBRTJ4r",
        reference: "cmdabc",
        status: "succeeded",
        amount: 5000,
        currency: "XOF",
        ...patch,
      },
    });
  }

  it("traduit un succès, montant converti en unités mineures", () => {
    const fait = FLUTTERWAVE.lire(corps());

    expect(fait?.issue).toBe("REUSSI");
    expect(fait?.reference).toBe("cmdabc");
    expect(fait?.evenement).toBe("evt_9");
    expect(fait?.referenceOperateur).toBe("chg_Hq4oBRTJ4r");
    // Le franc CFA n'a pas de décimale : les deux valeurs coïncident, et c'est
    // exactement ce qui rendrait l'erreur invisible si on ne convertissait pas.
    expect(fait?.montant).toBe(5_000);
  });

  it("convertit vraiment sur une devise à décimales", () => {
    // Cinquante euros valent 5 000 chez nous. Sans conversion, « 50 » serait
    // confronté à « 5000 » et tout paiement légitime serait refusé pour
    // discordance de montant.
    const fait = FLUTTERWAVE.lire(corps({ amount: 50, currency: "EUR" }));
    expect(fait?.montant).toBe(5_000);
    expect(fait?.devise).toBe("EUR");
  });

  it("accepte un montant transmis en chaîne", () => {
    expect(FLUTTERWAVE.lire(corps({ amount: "5000" }))?.montant).toBe(5_000);
  });

  it("n'annonce aucun montant sur une devise inconnue", () => {
    expect(FLUTTERWAVE.lire(corps({ currency: "RWF" }))?.montant).toBeNull();
  });

  it("reconnaît un échec, et laisse le reste en cours", () => {
    expect(FLUTTERWAVE.lire(corps({ status: "failed" }))?.issue).toBe("ECHOUE");
    expect(FLUTTERWAVE.lire(corps({ status: "cancelled" }))?.issue).toBe("ECHOUE");
    // Un état intermédiaire ne referme pas une commande qui vit encore.
    expect(FLUTTERWAVE.lire(corps({ status: "pending" }))?.issue).toBe("EN_COURS");
  });

  it("ignore les événements qui ne sont pas des charges", () => {
    expect(
      FLUTTERWAVE.lire(
        JSON.stringify({ type: "refund.completed", data: { reference: "c" } }),
      ),
    ).toBeNull();
  });

  it("rend null sur un corps illisible ou incomplet", () => {
    expect(FLUTTERWAVE.lire("pas du json")).toBeNull();
    expect(FLUTTERWAVE.lire("[]")).toBeNull();
    expect(FLUTTERWAVE.lire('{"type":"charge.completed"}')).toBeNull();
  });
});

describe("la référence transmise", () => {
  it("garde un identifiant de commande tel quel", () => {
    expect(referencePour("cmxyz123abc")).toBe("cmxyz123abc");
  });

  it("retire ce que Flutterwave n'accepte pas", () => {
    // Six à quarante-deux caractères alphanumériques, pas un de plus.
    expect(referencePour("cm-xyz_123.abc")).toBe("cmxyz123abc");
  });

  it("tient les deux bornes", () => {
    expect(referencePour("ab").length).toBe(6);
    expect(referencePour("a".repeat(60)).length).toBe(42);
  });
});
