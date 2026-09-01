import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { formatMoney } from "@/lib/i18n/money";
import type { FaitPaiement } from "@/lib/payments/encaissement/contrat";
import {
  PAYSTACK,
  confirmerAupresDePaystack,
  rembourserChezPaystack,
  depuisPaystack,
  versPaystack,
} from "@/lib/payments/encaissement/pilotes/paystack";

const CLE = "sk_test_0123456789abcdef";

const INITIAL = process.env.PAYSTACK_SECRET_KEY;

afterEach(() => {
  if (INITIAL === undefined) delete process.env.PAYSTACK_SECRET_KEY;
  else process.env.PAYSTACK_SECRET_KEY = INITIAL;
  vi.unstubAllGlobals();
});

/**
 * Remplace `fetch` et retient ce qui lui a été demandé.
 *
 * Ces tests ne joignent pas Paystack : ils vérifient ce qu'on lui **envoie** et
 * ce qu'on fait de ce qu'il **répond**. C'est précisément ce qui manquait — la
 * conversion des montants était éprouvée comme fonction, sans que rien ne
 * prouve qu'elle soit appliquée à la requête réelle.
 */
function faireRepondre(
  statut: number,
  corps: unknown,
): { appels: Array<{ url: string; init?: RequestInit }> } {
  const appels: Array<{ url: string; init?: RequestInit }> = [];

  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    appels.push({ url: String(url), init });
    return new Response(JSON.stringify(corps), {
      status: statut,
      headers: { "content-type": "application/json" },
    });
  });

  return { appels };
}

const DEMANDE = {
  reference: "cmd-1",
  montant: 5_000,
  devise: "XOF",
  moyen: "om",
  retour: "https://baobart.test/achat/cmd-1",
  email: "acheteur@baobart.test",
};

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
    const lu = fait(PAYSTACK.lire(corps()));

    expect(lu.sens).toBe("ENCAISSEMENT");
    expect(lu.issue).toBe("REUSSI");
    expect(lu.reference).toBe("cmd-abc");
    // 500 000 chez eux, 5 000 chez nous. C'est cette ligne qui empêche de
    // créditer cent fois trop.
    expect(lu.montant).toBe(5_000);
    expect(lu.devise).toBe("XOF");
    expect(lu.referenceOperateur).toBe("302961");
  });

  it("distingue un succès d'un échec sur la même transaction", () => {
    // Sans le nom de l'événement dans la clé, le second serait pris pour un
    // rejeu du premier — et l'échec ne serait jamais traité.
    const succes = fait(PAYSTACK.lire(corps()));
    const echec = fait(
      PAYSTACK.lire(
        JSON.stringify({
          event: "charge.failed",
          data: { id: 302961, reference: "cmd-abc", status: "failed" },
        }),
      ),
    );

    expect(succes.evenement).not.toBe(echec.evenement);
    expect(echec.issue).toBe("ECHOUE");
  });

  it("traite un charge.success au statut non abouti comme un échec", () => {
    expect(fait(PAYSTACK.lire(corps({ status: "abandoned" }))).issue).toBe(
      "ECHOUE",
    );
  });

  it("classe hors sujet ce dont ce module n'a pas à décider", () => {
    // Remboursements et litiges passent par `lib/domain/litiges.ts`, où ils
    // laissent une écriture inverse au lieu d'effacer la première.
    //
    // « Hors sujet » et non `null` : Paystack n'a qu'une adresse de rappel et
    // y envoie tout. Répondre par une erreur le ferait rejouer sans fin un
    // événement parfaitement normal, et remplirait le journal des refus au
    // point d'y noyer un vrai secret décalé.
    expect(
      PAYSTACK.lire(
        JSON.stringify({ event: "refund.processed", data: { reference: "c" } }),
      ),
    ).toBe("HORS_SUJET");
  });

  it("reconnaît les virements sortants, sur la même adresse", () => {
    const reussi = fait(
      PAYSTACK.lire(
        JSON.stringify({
          event: "transfer.success",
          data: {
            reference: "pay-1",
            transfer_code: "TRF_x",
            status: "success",
            amount: 500_000,
            currency: "XOF",
          },
        }),
      ),
    );

    expect(reussi.sens).toBe("VERSEMENT");
    expect(reussi.issue).toBe("REUSSI");
    // C'est le code de transfert qu'on garde, pas l'identifiant : c'est lui
    // qu'on cite à l'opérateur le jour où un créateur dit n'avoir rien reçu.
    expect(reussi.referenceOperateur).toBe("TRF_x");
  });

  it("distingue un virement retourné d'un virement échoué", () => {
    // L'ordre est bien parti et l'argent est revenu — souvent parce que le
    // compte n'existe plus. Ce n'est pas le même état, ni le même remède.
    const echoue = fait(
      PAYSTACK.lire(
        JSON.stringify({
          event: "transfer.failed",
          data: { reference: "pay-1", status: "failed" },
        }),
      ),
    );
    const retourne = fait(
      PAYSTACK.lire(
        JSON.stringify({
          event: "transfer.reversed",
          data: { reference: "pay-1", status: "reversed" },
        }),
      ),
    );

    expect(echoue.issue).toBe("ECHOUE");
    expect(retourne.issue).toBe("RETOURNE");
    expect(echoue.evenement).not.toBe(retourne.evenement);
  });

  it("n'annonce aucun montant sur une devise qu'il ne sait pas convertir", () => {
    // Un montant faux vaut moins que pas de montant : sans valeur, la
    // confrontation passe son tour au lieu de refuser à tort.
    expect(fait(PAYSTACK.lire(corps({ currency: "EUR" }))).montant).toBeNull();
  });

  it("rend null sur un corps illisible ou incomplet", () => {
    expect(PAYSTACK.lire("pas du json")).toBeNull();
    expect(PAYSTACK.lire("[]")).toBeNull();
    expect(PAYSTACK.lire('{"event":"charge.success"}')).toBeNull();
    expect(PAYSTACK.lire('{"data":{"reference":"c"}}')).toBeNull();
  });
});


describe("l'ouverture d'une transaction", () => {
  it("envoie le montant CONVERTI, pas le nôtre", async () => {
    // Le test qui manquait. `versPaystack` était éprouvée comme fonction, sans
    // que rien ne prouve qu'elle traverse la requête. Une conversion juste mais
    // jamais appelée facture cinquante francs au lieu de cinq mille.
    process.env.PAYSTACK_SECRET_KEY = CLE;
    const { appels } = faireRepondre(200, {
      status: true,
      data: { authorization_url: "https://checkout.paystack.com/x", reference: "r" },
    });

    const suite = await PAYSTACK.ouvrir(DEMANDE);

    expect(suite.ok).toBe(true);
    expect(suite.ok === true && suite.redirection).toBe(
      "https://checkout.paystack.com/x",
    );

    const envoye = JSON.parse(String(appels[0]!.init!.body));
    expect(envoye.amount).toBe(500_000);
    expect(envoye.currency).toBe("XOF");
    expect(envoye.reference).toBe("cmd-1");
    expect(envoye.email).toBe("acheteur@baobart.test");
    expect(envoye.callback_url).toBe("https://baobart.test/achat/cmd-1");
  });

  it("frappe le bon point d'entrée, avec la clé en porteur", async () => {
    // Une URL fautive échouerait silencieusement à l'ouverture, et personne ne
    // saurait dire pourquoi la caisse est fermée.
    process.env.PAYSTACK_SECRET_KEY = CLE;
    const { appels } = faireRepondre(200, {
      status: true,
      data: { authorization_url: "https://checkout.paystack.com/x" },
    });

    await PAYSTACK.ouvrir(DEMANDE);

    expect(appels[0]!.url).toBe("https://api.paystack.co/transaction/initialize");
    expect(
      (appels[0]!.init!.headers as Record<string, string>).authorization,
    ).toBe(`Bearer ${CLE}`);
  });

  it("refuse une devise que Paystack ne règle pas, sans appeler personne", async () => {
    process.env.PAYSTACK_SECRET_KEY = CLE;
    const { appels } = faireRepondre(200, { status: true });

    const suite = await PAYSTACK.ouvrir({ ...DEMANDE, devise: "EUR" });

    expect(suite.ok).toBe(false);
    expect(suite.ok === false && suite.definitif).toBe(true);
    expect(appels).toHaveLength(0);
  });

  it("distingue une faute de notre côté d'une panne de leur côté", async () => {
    process.env.PAYSTACK_SECRET_KEY = CLE;

    // 4xx : la clé, la devise ou le montant. Réessayer n'y changera rien.
    faireRepondre(400, { status: false, message: "Invalid key" });
    const notre = await PAYSTACK.ouvrir(DEMANDE);
    expect(notre.ok === false && notre.definitif).toBe(true);

    // 5xx : chez eux. Ce sera peut-être passé dans dix minutes.
    faireRepondre(503, { status: false });
    const leur = await PAYSTACK.ouvrir(DEMANDE);
    expect(leur.ok === false && leur.definitif).toBe(false);
  });

  it("ne se prend pas les pieds dans une panne réseau", async () => {
    process.env.PAYSTACK_SECRET_KEY = CLE;
    vi.stubGlobal("fetch", async () => {
      throw new Error("ECONNREFUSED");
    });

    const suite = await PAYSTACK.ouvrir(DEMANDE);
    expect(suite.ok).toBe(false);
    // Réessayable : l'acheteur peut recommencer dans deux minutes.
    expect(suite.ok === false && suite.definitif).toBe(false);
  });

  it("refuse une réponse « réussie » sans page de paiement", async () => {
    // Sans lien, on n'a nulle part où envoyer l'acheteur. Dire « ok » ici
    // laisserait une commande ouverte et un acheteur sur une page morte.
    process.env.PAYSTACK_SECRET_KEY = CLE;
    faireRepondre(200, { status: true, data: {} });

    expect((await PAYSTACK.ouvrir(DEMANDE)).ok).toBe(false);
  });
});

describe("la confirmation auprès de Paystack", () => {
  it("confirme, et reconvertit le montant dans nos unités", async () => {
    process.env.PAYSTACK_SECRET_KEY = CLE;
    const { appels } = faireRepondre(200, {
      status: true,
      data: { status: "success", amount: 500_000, currency: "XOF" },
    });

    const verdict = await confirmerAupresDePaystack("cmd-1");

    expect(verdict.confirme).toBe(true);
    expect(verdict.montant).toBe(5_000);
    expect(appels[0]!.url).toBe(
      "https://api.paystack.co/transaction/verify/cmd-1",
    );
  });

  it("ne confirme pas une transaction que Paystack dit non aboutie", async () => {
    process.env.PAYSTACK_SECRET_KEY = CLE;
    faireRepondre(200, {
      status: true,
      data: { status: "abandoned", amount: 500_000, currency: "XOF" },
    });

    expect((await confirmerAupresDePaystack("cmd-1")).confirme).toBe(false);
  });

  it("ne confirme rien quand Paystack est injoignable", async () => {
    // On ne confirme pas, donc on ne crédite pas. Le rappel sera rejoué.
    process.env.PAYSTACK_SECRET_KEY = CLE;
    vi.stubGlobal("fetch", async () => {
      throw new Error("ETIMEDOUT");
    });

    expect((await confirmerAupresDePaystack("cmd-1")).confirme).toBe(false);
  });

  it("ne confirme rien sur une réponse en erreur", async () => {
    process.env.PAYSTACK_SECRET_KEY = CLE;
    faireRepondre(404, { status: false });

    expect((await confirmerAupresDePaystack("cmd-1")).confirme).toBe(false);
  });

  it("ne confirme rien sans clé, et n'appelle personne", async () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    const { appels } = faireRepondre(200, {
      status: true,
      data: { status: "success" },
    });

    expect((await confirmerAupresDePaystack("cmd-1")).confirme).toBe(false);
    expect(appels).toHaveLength(0);
  });

  it("échappe la référence dans l'URL", async () => {
    // Une référence contenant une barre oblique changerait le chemin appelé.
    process.env.PAYSTACK_SECRET_KEY = CLE;
    const { appels } = faireRepondre(200, {
      status: true,
      data: { status: "success" },
    });

    await confirmerAupresDePaystack("a/b?c=1");

    expect(appels[0]!.url).toBe(
      "https://api.paystack.co/transaction/verify/a%2Fb%3Fc%3D1",
    );
  });
});


describe("le remboursement", () => {
  const DEMANDE = {
    referenceOperateur: "302961",
    montant: 5_000,
    devise: "XOF",
    motifClient: "Remboursement Baobart",
    motifInterne: "Demandé par le vendeur",
  };

  it("envoie le montant converti, et la transaction de l'opérateur", async () => {
    // Deux pièges dans le même appel. Le montant suit la règle des cent — se
    // tromper rembourse cinquante francs au lieu de cinq mille. Et la
    // référence doit être celle de PAYSTACK : leur envoyer notre identifiant de
    // commande ne rembourserait rien, ils ne connaissent pas nos numéros.
    process.env.PAYSTACK_SECRET_KEY = CLE;
    const { appels } = faireRepondre(200, { status: true, data: { id: 8812 } });

    const suite = await rembourserChezPaystack(DEMANDE);

    expect(suite.ok).toBe(true);
    expect(suite.ok === true && suite.referenceOperateur).toBe("8812");

    expect(appels[0]!.url).toBe("https://api.paystack.co/refund");
    const envoye = JSON.parse(String(appels[0]!.init!.body));
    expect(envoye.amount).toBe(500_000);
    expect(envoye.transaction).toBe("302961");
    expect(envoye.currency).toBe("XOF");
  });

  it("refuse une devise que Paystack ne rembourse pas, sans appeler personne", async () => {
    process.env.PAYSTACK_SECRET_KEY = CLE;
    const { appels } = faireRepondre(200, { status: true });

    const suite = await rembourserChezPaystack({ ...DEMANDE, devise: "EUR" });

    expect(suite.ok).toBe(false);
    expect(suite.ok === false && suite.definitif).toBe(true);
    expect(appels).toHaveLength(0);
  });

  it("distingue un refus définitif d'une panne passagère", async () => {
    process.env.PAYSTACK_SECRET_KEY = CLE;

    // 4xx : transaction inconnue, montant trop grand. Réessayer n'y changera
    // rien, et le vendeur doit le savoir tout de suite.
    faireRepondre(400, { status: false, message: "Transaction not found" });
    const notre = await rembourserChezPaystack(DEMANDE);
    expect(notre.ok === false && notre.definitif).toBe(true);
    expect(notre.ok === false && notre.message).toContain("Transaction");

    faireRepondre(503, { status: false });
    const leur = await rembourserChezPaystack(DEMANDE);
    expect(leur.ok === false && leur.definitif).toBe(false);
  });

  it("ne se prend pas les pieds dans une panne réseau", async () => {
    process.env.PAYSTACK_SECRET_KEY = CLE;
    vi.stubGlobal("fetch", async () => {
      throw new Error("ECONNRESET");
    });

    const suite = await rembourserChezPaystack(DEMANDE);
    expect(suite.ok).toBe(false);
    // Réessayable : rien n'a bougé, ni chez eux ni chez nous.
    expect(suite.ok === false && suite.definitif).toBe(false);
  });

  it("ne rembourse rien sans clé, et n'appelle personne", async () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    const { appels } = faireRepondre(200, { status: true, data: { id: 1 } });

    expect((await rembourserChezPaystack(DEMANDE)).ok).toBe(false);
    expect(appels).toHaveLength(0);
  });

  it("refuse une réponse dont le statut n'est pas vrai", async () => {
    // Paystack peut rendre 200 avec `status: false`. Le croire sur le code HTTP
    // ferait débiter le vendeur pour un remboursement jamais parti.
    process.env.PAYSTACK_SECRET_KEY = CLE;
    faireRepondre(200, { status: false, message: "Insufficient balance" });

    const suite = await rembourserChezPaystack(DEMANDE);
    expect(suite.ok).toBe(false);
    expect(suite.ok === false && suite.message).toContain("Insufficient");
  });
});
