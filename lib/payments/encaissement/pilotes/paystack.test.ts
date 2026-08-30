import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { formatMoney } from "@/lib/i18n/money";
import {
  PAYSTACK,
  depuisPaystack,
  versPaystack,
} from "@/lib/payments/encaissement/pilotes/paystack";

const CLE = "sk_test_0123456789abcdef";

const INITIAL = process.env.PAYSTACK_SECRET_KEY;

afterEach(() => {
  if (INITIAL === undefined) delete process.env.PAYSTACK_SECRET_KEY;
  else process.env.PAYSTACK_SECRET_KEY = INITIAL;
});

function entetes(signature?: string): Headers {
  const h = new Headers();
  if (signature !== undefined) h.set("x-paystack-signature", signature);
  return h;
}

function signer(secret: string, corps: string): string {
  return createHmac("sha512", secret).update(corps, "utf8").digest("hex");
}

describe("la conversion des montants", () => {
  /**
   * Le test qui compte.
   *
   * Paystack définit sa « sous-unité » comme le montant principal multiplié par
   * cent, **y compris pour les devises qui n'en ont pas**. Le franc CFA n'a pas
   * de décimale : cinq mille francs, que nous gardons en `5000`, se déclarent
   * `500000` chez eux. Recopier tel quel facturerait cinquante francs.
   */
  it("multiplie par cent le franc CFA, qui n'a pourtant pas de sous-unité", () => {
    expect(versPaystack(5_000, "XOF")).toBe(500_000);
    expect(formatMoney(5_000, "XOF")).toContain("5");
  });

  it("laisse le naira tel quel : notre valeur EST déjà sa sous-unité", () => {
    // Multiplier ici facturerait cent fois trop. C'est la moitié du piège que
    // la formule générale évite.
    expect(versPaystack(500_000, "NGN")).toBe(500_000);
  });

  it("fait de même pour les autres devises à deux décimales", () => {
    expect(versPaystack(1_250, "USD")).toBe(1_250);
    expect(versPaystack(9_999, "GHS")).toBe(9_999);
  });

  it("revient exactement sur ses pas", () => {
    for (const [montant, devise] of [
      [5_000, "XOF"],
      [1, "XOF"],
      [500_000, "NGN"],
      [1_250, "USD"],
    ] as const) {
      expect(depuisPaystack(versPaystack(montant, devise), devise)).toBe(montant);
    }
  });

  it("ne perd pas un franc sur les petits montants", () => {
    expect(versPaystack(1, "XOF")).toBe(100);
    expect(depuisPaystack(100, "XOF")).toBe(1);
  });
});

describe("la configuration", () => {
  it("exige une clé qui ressemble à une clé", () => {
    process.env.PAYSTACK_SECRET_KEY = CLE;
    expect(PAYSTACK.configure()).toBe(true);

    process.env.PAYSTACK_SECRET_KEY = "sk_live_0123456789abcdef";
    expect(PAYSTACK.configure()).toBe(true);
  });

  it("refuse un espace réservé recopié depuis la documentation", () => {
    for (const valeur of ["", "   ", "VOTRE_CLE_ICI", "sk_test_", "pk_test_abcdefghijkl"]) {
      process.env.PAYSTACK_SECRET_KEY = valeur;
      expect(PAYSTACK.configure()).toBe(false);
    }
  });
});

describe("l'authentification d'un rappel", () => {
  it("accepte un corps signé en SHA-512 avec la clé secrète", () => {
    process.env.PAYSTACK_SECRET_KEY = CLE;
    const corps = '{"event":"charge.success"}';
    expect(PAYSTACK.authentifier(corps, entetes(signer(CLE, corps)))).toBe(true);
  });

  it("refuse un corps modifié après signature", () => {
    process.env.PAYSTACK_SECRET_KEY = CLE;
    const signature = signer(CLE, '{"amount":100}');
    expect(PAYSTACK.authentifier('{"amount":99999999}', entetes(signature))).toBe(
      false,
    );
  });

  it("refuse une signature calculée en SHA-256", () => {
    // Paystack signe en SHA-512, Flutterwave en SHA-256 base64. Se tromper
    // d'algorithme entre les deux donne un refus permanent que rien n'explique.
    process.env.PAYSTACK_SECRET_KEY = CLE;
    const corps = "{}";
    const mauvaise = createHmac("sha256", CLE).update(corps).digest("hex");
    expect(PAYSTACK.authentifier(corps, entetes(mauvaise))).toBe(false);
  });

  it("refuse sans en-tête, et sans clé", () => {
    process.env.PAYSTACK_SECRET_KEY = CLE;
    expect(PAYSTACK.authentifier("{}", entetes())).toBe(false);

    delete process.env.PAYSTACK_SECRET_KEY;
    expect(PAYSTACK.authentifier("{}", entetes(signer(CLE, "{}")))).toBe(false);
  });
});

describe("la lecture d'un rappel", () => {
  function corps(patch: Record<string, unknown> = {}) {
    return JSON.stringify({
      event: "charge.success",
      data: {
        id: 302961,
        reference: "cmd-abc",
        amount: 500_000,
        currency: "XOF",
        status: "success",
        ...patch,
      },
    });
  }

  it("traduit un succès, montant reconverti dans nos unités", () => {
    const fait = PAYSTACK.lire(corps());

    expect(fait?.issue).toBe("REUSSI");
    expect(fait?.reference).toBe("cmd-abc");
    // 500 000 chez eux, 5 000 chez nous. C'est cette ligne qui empêche de
    // créditer cent fois trop.
    expect(fait?.montant).toBe(5_000);
    expect(fait?.devise).toBe("XOF");
    expect(fait?.referenceOperateur).toBe("302961");
  });

  it("distingue un succès d'un échec sur la même transaction", () => {
    // Sans le nom de l'événement dans la clé, le second serait pris pour un
    // rejeu du premier — et l'échec ne serait jamais traité.
    const succes = PAYSTACK.lire(corps());
    const echec = PAYSTACK.lire(
      JSON.stringify({
        event: "charge.failed",
        data: { id: 302961, reference: "cmd-abc", status: "failed" },
      }),
    );

    expect(succes?.evenement).not.toBe(echec?.evenement);
    expect(echec?.issue).toBe("ECHOUE");
  });

  it("traite un charge.success au statut non abouti comme un échec", () => {
    expect(PAYSTACK.lire(corps({ status: "abandoned" }))?.issue).toBe("ECHOUE");
  });

  it("ignore les événements dont ce module n'a pas à décider", () => {
    // Remboursements et litiges passent par `lib/domain/litiges.ts`, où ils
    // laissent une écriture inverse au lieu d'effacer la première.
    expect(
      PAYSTACK.lire(
        JSON.stringify({ event: "refund.processed", data: { reference: "c" } }),
      ),
    ).toBeNull();
  });

  it("n'annonce aucun montant sur une devise qu'il ne sait pas convertir", () => {
    // Un montant faux vaut moins que pas de montant : sans valeur, la
    // confrontation passe son tour au lieu de refuser à tort.
    expect(PAYSTACK.lire(corps({ currency: "EUR" }))?.montant).toBeNull();
  });

  it("rend null sur un corps illisible ou incomplet", () => {
    expect(PAYSTACK.lire("pas du json")).toBeNull();
    expect(PAYSTACK.lire("[]")).toBeNull();
    expect(PAYSTACK.lire('{"event":"charge.success"}')).toBeNull();
    expect(PAYSTACK.lire('{"data":{"reference":"c"}}')).toBeNull();
  });
});
