import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FaitPaiement } from "@/lib/payments/encaissement/contrat";
import {
  FLUTTERWAVE,
  oublierJeton,
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

/**
 * Restreint une lecture à un fait.
 *
 * `lire()` rend trois choses : un fait, « hors sujet », ou `null`. Les deux
 * dernières ont leurs propres tests ; partout ailleurs on veut un fait, et
 * échouer bruyamment si ce n'en est pas un vaut mieux qu'un `?.` qui rend
 * silencieusement `undefined` et fait passer l'assertion.
 */
function fait(lecture: FaitPaiement | "HORS_SUJET" | null): FaitPaiement {
  if (lecture === null || lecture === "HORS_SUJET") {
    throw new Error(`attendu un fait, reçu ${String(lecture)}`);
  }
  return lecture;
}

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
    const lu = fait(FLUTTERWAVE.lire(corps()));

    expect(lu.sens).toBe("ENCAISSEMENT");
    expect(lu.issue).toBe("REUSSI");
    expect(lu.reference).toBe("cmdabc");
    expect(lu.evenement).toBe("evt_9");
    expect(lu.referenceOperateur).toBe("chg_Hq4oBRTJ4r");
    // Le franc CFA n'a pas de décimale : les deux valeurs coïncident, et c'est
    // exactement ce qui rendrait l'erreur invisible si on ne convertissait pas.
    expect(lu.montant).toBe(5_000);
  });

  it("convertit vraiment sur une devise à décimales", () => {
    // Cinquante euros valent 5 000 chez nous. Sans conversion, « 50 » serait
    // confronté à « 5000 » et tout paiement légitime serait refusé pour
    // discordance de montant.
    const lu = fait(FLUTTERWAVE.lire(corps({ amount: 50, currency: "EUR" })));
    expect(lu.montant).toBe(5_000);
    expect(lu.devise).toBe("EUR");
  });

  it("accepte un montant transmis en chaîne", () => {
    expect(fait(FLUTTERWAVE.lire(corps({ amount: "5000" }))).montant).toBe(5_000);
  });

  it("n'annonce aucun montant sur une devise inconnue", () => {
    expect(fait(FLUTTERWAVE.lire(corps({ currency: "RWF" }))).montant).toBeNull();
  });

  it("reconnaît un échec, et laisse le reste en cours", () => {
    expect(fait(FLUTTERWAVE.lire(corps({ status: "failed" }))).issue).toBe(
      "ECHOUE",
    );
    expect(fait(FLUTTERWAVE.lire(corps({ status: "cancelled" }))).issue).toBe(
      "ECHOUE",
    );
    // Un état intermédiaire ne referme pas une commande qui vit encore.
    expect(fait(FLUTTERWAVE.lire(corps({ status: "pending" }))).issue).toBe(
      "EN_COURS",
    );
  });

  it("classe hors sujet les événements qui ne sont pas des charges", () => {
    // Les virements sortants ne sont pas branchés chez Flutterwave. Leur
    // répondre par une erreur le ferait rejouer sans fin.
    expect(
      FLUTTERWAVE.lire(
        JSON.stringify({ type: "refund.completed", data: { reference: "c" } }),
      ),
    ).toBe("HORS_SUJET");
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

  it("retire ce que Flutterwave n'accepte pas mais préserve tirets et tirets bas", () => {
    // Six à quarante-deux caractères alphanumériques + tiret et tiret bas.
    expect(referencePour("cm-xyz_123.abc")).toBe("cm-xyz_123abc");
    expect(referencePour("abo-cmxyz123abc")).toBe("abo-cmxyz123abc");
  });


  it("tient les deux bornes", () => {
    expect(referencePour("ab").length).toBe(6);
    expect(referencePour("a".repeat(60)).length).toBe(42);
  });
});

// ──────────────────────────────────────────── l'ouverture d'un paiement ──
//
// Audit du 31/10/2026 (`Doc/ETAT_DU_PROJET_2026-10.md`, Q2-2) : le numéro
// saisi sur la page de paiement n'atteignait jamais ce pilote, et sans lui il
// ouvrait un paiement par CARTE alors que l'acheteur avait choisi Orange
// Money — sans rien dire. Aucun test n'exerçait l'ouverture : le réseau est
// donc simulé ici, et l'on regarde ce que le pilote envoie vraiment.

describe("l'ouverture d'un paiement", () => {
  type Appel = { url: string; corps: unknown };
  let appels: Appel[] = [];

  function simulerFlutterwave() {
    appels = [];
    vi.stubGlobal("fetch", async (url: string, init?: { body?: unknown }) => {
      const corps = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      appels.push({ url: String(url), corps });
      const repondre = (donnees: unknown) =>
        new Response(JSON.stringify(donnees), { status: 200, headers: { "content-type": "application/json" } });
      if (String(url).includes("openid-connect/token")) return repondre({ access_token: "jeton", expires_in: 600 });
      if (String(url).endsWith("/customers")) return repondre({ status: "success", data: { id: "cus_1" } });
      if (String(url).endsWith("/payment-methods")) return repondre({ status: "success", data: { id: "pm_1" } });
      if (String(url).endsWith("/charges")) {
        return repondre({ status: "success", data: { id: "chg_1", next_action: { redirect_url: { url: "https://flutterwave.test/payer" } } } });
      }
      return new Response("{}", { status: 404 });
    });
  }

  const demande = (moyen: string, telephone?: string) => ({
    reference: "commande-test-1",
    montant: 5_000,
    devise: "XOF",
    moyen,
    retour: "https://baobart.test/achat/1",
    email: "acheteur@baobart.test",
    telephone,
  });

  const moyenEnvoye = () => appels.find((a) => a.url.endsWith("/payment-methods"))?.corps;

  beforeEach(() => {
    process.env.FLUTTERWAVE_CLIENT_ID = "client";
    process.env.FLUTTERWAVE_CLIENT_SECRET = "secret";
    process.env.FLUTTERWAVE_SECRET_HASH = HASH;
    oublierJeton();
    simulerFlutterwave();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("déclare du mobile money, avec le réseau et le numéro, quand le numéro est là", async () => {
    const r = await FLUTTERWAVE.ouvrir(demande("om", "+2250700000000"));

    expect(r.ok).toBe(true);
    expect(moyenEnvoye()).toEqual({
      type: "mobile_money",
      mobile_money: { network: "ORANGE", phone_number: "+2250700000000" },
    });
  });

  it("refuse un rail mobile money sans numéro, au lieu de basculer sur la carte", async () => {
    const r = await FLUTTERWAVE.ouvrir(demande("mtn"));

    expect(r.ok).toBe(false);
    expect(moyenEnvoye()).toBeUndefined();
    expect(appels.some((a) => a.url.endsWith("/charges"))).toBe(false);
  });

  it("ouvre une carte quand l'acheteur a choisi la carte", async () => {
    const r = await FLUTTERWAVE.ouvrir(demande("carte"));

    expect(r.ok).toBe(true);
    expect(moyenEnvoye()).toEqual({ type: "card" });
  });
});
