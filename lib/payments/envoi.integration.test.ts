/**
 * L'envoi des versements, contre la vraie base.
 *
 * C'est le seul geste du système qui sorte de l'argent. Ce qu'on éprouve ici
 * n'est donc pas que ça marche : c'est ce qui doit se passer quand ça ne marche
 * pas. Un opérateur qui refuse, un bénéficiaire impossible à inscrire, un
 * réglage qui bloque tout — chacun a un remède différent, et les confondre
 * coûte soit un cycle de retard au créateur, soit un virement en double.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { envoyerLesVersements } from "@/lib/payments/envoi";
import { oublierCatalogue } from "@/lib/payments/encaissement/pilotes/paystack-versements";

/**
 * Un compte de versement enregistré avant-hier.
 *
 * `peutEtrePaye` retient vingt-quatre heures un compte fraîchement enregistré —
 * la défense contre le détournement de versement. Les fixtures l'antédatent
 * pour éprouver ce qu'elles visent, et non cette retenue-là.
 */
const HIER = new Date(Date.now() - 48 * 3_600_000);

const CLE = "sk_test_0123456789abcdef";

const AVANT = {
  driver: process.env.PAYMENTS_DRIVER,
  cle: process.env.PAYSTACK_SECRET_KEY,
};

beforeEach(() => {
  process.env.PAYMENTS_DRIVER = "paystack";
  process.env.PAYSTACK_SECRET_KEY = CLE;
  oublierCatalogue();
});

afterEach(() => {
  for (const [cle, valeur] of [
    ["PAYMENTS_DRIVER", AVANT.driver],
    ["PAYSTACK_SECRET_KEY", AVANT.cle],
  ] as const) {
    if (valeur === undefined) delete process.env[cle];
    else process.env[cle] = valeur;
  }
  vi.unstubAllGlobals();
  oublierCatalogue();
});

/**
 * Joue l'opérateur.
 *
 * Chaque appel est reconnu à son chemin, et on retient ce qui a été envoyé :
 * c'est le corps de la requête qui dit si le bon montant part au bon
 * bénéficiaire, et aucun autre test ne peut le dire.
 */
function jouerPaystack(reponses: {
  banques?: unknown;
  beneficiaire?: { statut: number; corps: unknown };
  virement?: { statut: number; corps: unknown };
}) {
  const appels: Array<{ url: string; corps: unknown }> = [];

  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const adresse = String(url);
    const corps = init?.body ? JSON.parse(String(init.body)) : null;
    appels.push({ url: adresse, corps });

    if (adresse.includes("/bank")) {
      return new Response(
        JSON.stringify(
          reponses.banques ?? {
            status: true,
            data: [
              { name: "Orange Money CI", code: "ORANGE_CI" },
              { name: "MTN Mobile Money", code: "MTN_CI" },
            ],
          },
        ),
        { status: 200 },
      );
    }

    if (adresse.includes("/transferrecipient")) {
      const r =
        reponses.beneficiaire ??
        { statut: 200, corps: { status: true, data: { recipient_code: "RCP_1" } } };
      return new Response(JSON.stringify(r.corps), { status: r.statut });
    }

    const r =
      reponses.virement ??
      { statut: 200, corps: { status: true, data: { transfer_code: "TRF_1" } } };
    return new Response(JSON.stringify(r.corps), { status: r.statut });
  });

  return { appels };
}

let n = 0;

async function creerVersement(options: { avecNom?: boolean } = {}) {
  n += 1;
  const createur = await db.user.create({
    data: {
      email: `c-env-${n}@baobart.test`,
      profile: { create: { username: `c-env-${n}`, displayName: `C ${n}` } },
    },
    select: { id: true },
  });

  await db.payoutAccount.create({
    data: {
      userId: createur.id,
      method: "MOBILE_MONEY",
      provider: "om",
      accountRef: `2250700000${n}`,
      holderName: options.avecNom === false ? null : `Awa Diallo ${n}`,
      createdAt: HIER,
    },
  });

  const versement = await db.payout.create({
    data: {
      userId: createur.id,
      method: "MOBILE_MONEY",
      provider: "om",
      accountRef: `2250700000${n}`,
      amount: 12_000,
      currency: "XOF",
      status: "CREATING",
    },
    select: { id: true },
  });

  return { createur, versement };
}

async function etatDe(payoutId: string) {
  return db.payout.findUniqueOrThrow({
    where: { id: payoutId },
    select: { status: true, providerRef: true, failureReason: true },
  });
}

describe("un envoi qui aboutit", () => {
  it("inscrit le bénéficiaire, ordonne le virement et marque envoyé", async () => {
    const { versement } = await creerVersement();
    const { appels } = jouerPaystack({});

    const passage = await envoyerLesVersements();

    expect(passage.envoyes).toBe(1);

    const apres = await etatDe(versement.id);
    expect(apres.status).toBe("PROCESSING");
    // La référence de l'opérateur est gardée : c'est elle qu'on cite le jour
    // où le créateur dit n'avoir rien reçu.
    expect(apres.providerRef).toBe("TRF_1");

    // Le montant part converti : douze mille francs valent 1 200 000 chez eux.
    const virement = appels.find((a) => a.url.endsWith("/transfer"));
    expect((virement!.corps as { amount: number }).amount).toBe(1_200_000);
    expect((virement!.corps as { reference: string }).reference).toBe(
      versement.id,
    );
    expect((virement!.corps as { recipient: string }).recipient).toBe("RCP_1");
  });

  it("demande le code de l'opérateur à Paystack, sans jamais l'inventer", async () => {
    // Un code approximatif enverrait l'argent chez quelqu'un d'autre. C'est la
    // seule erreur de ce module qui ne se rattrape pas.
    await creerVersement();
    const { appels } = jouerPaystack({});

    await envoyerLesVersements();

    const inscription = appels.find((a) => a.url.includes("/transferrecipient"));
    expect((inscription!.corps as { bank_code: string }).bank_code).toBe(
      "ORANGE_CI",
    );
    expect((inscription!.corps as { type: string }).type).toBe("mobile_money");
  });

  it("réutilise le bénéficiaire au lieu d'en créer un second", async () => {
    const { createur, versement } = await creerVersement();
    await db.payoutAccount.updateMany({
      where: { userId: createur.id },
      data: { providerRecipientRef: "RCP_DEJA", recipientProvider: "paystack" },
    });

    const { appels } = jouerPaystack({});
    await envoyerLesVersements();

    // Aucun appel d'inscription : recréer le bénéficiaire à chaque virement
    // multiplierait les doublons chez l'opérateur.
    expect(appels.some((a) => a.url.includes("/transferrecipient"))).toBe(false);
    expect((await etatDe(versement.id)).status).toBe("PROCESSING");
  });

  it("refait le bénéficiaire quand il vient d'un autre opérateur", async () => {
    // Un code Paystack envoyé à Flutterwave ne désigne personne.
    const { createur } = await creerVersement();
    await db.payoutAccount.updateMany({
      where: { userId: createur.id },
      data: { providerRecipientRef: "RCP_AILLEURS", recipientProvider: "flutterwave" },
    });

    const { appels } = jouerPaystack({});
    await envoyerLesVersements();

    expect(appels.some((a) => a.url.includes("/transferrecipient"))).toBe(true);
  });
});

describe("ce qui empêche d'envoyer", () => {
  it("laisse le versement en attente quand le bénéficiaire est refusé", async () => {
    const { versement } = await creerVersement();
    jouerPaystack({
      beneficiaire: { statut: 400, corps: { status: false, message: "Invalid account" } },
    });

    const passage = await envoyerLesVersements();

    expect(passage.ignores).toBe(1);
    expect(passage.echoues).toBe(0);
    // On ne fait pas échouer : le compte est peut-être simplement incomplet, et
    // l'échouer rendrait les soldes pour rien.
    expect((await etatDe(versement.id)).status).toBe("CREATING");
  });

  it("refuse d'inscrire un rail que Paystack ne déclare pas", async () => {
    const { versement } = await creerVersement();
    // Paystack ne connaît que MTN dans ce pays : Orange Money n'y est pas.
    jouerPaystack({
      banques: { status: true, data: [{ name: "MTN Mobile Money", code: "MTN" }] },
    });

    const passage = await envoyerLesVersements();

    expect(passage.ignores).toBe(1);
    expect((await etatDe(versement.id)).status).toBe("CREATING");
  });

  it("laisse en attente sur une panne passagère de l'opérateur", async () => {
    const { versement } = await creerVersement();
    jouerPaystack({ virement: { statut: 503, corps: { status: false } } });

    const passage = await envoyerLesVersements();

    expect(passage.ignores).toBe(1);
    // CREATING et non FAILED : l'échouer rendrait les soldes et repousserait le
    // créateur d'un cycle entier pour une panne de dix minutes.
    expect((await etatDe(versement.id)).status).toBe("CREATING");
  });

  it("fait échouer sur un refus définitif, et rend les soldes", async () => {
    const { versement } = await creerVersement();
    jouerPaystack({
      virement: {
        statut: 400,
        corps: { status: false, message: "Insufficient balance" },
      },
    });

    const passage = await envoyerLesVersements();

    expect(passage.echoues).toBe(1);
    const apres = await etatDe(versement.id);
    expect(apres.status).toBe("FAILED");
    expect(apres.failureReason).toContain("Insufficient");
  });

  it("s'arrête net quand l'opérateur exige un code à usage unique", async () => {
    // Ce n'est pas une panne, c'est un réglage : tant qu'il est actif, aucun
    // versement automatique n'est possible. Continuer la liste ferait échouer
    // tout le monde pour la même raison.
    await creerVersement();
    await creerVersement();

    jouerPaystack({
      virement: { statut: 200, corps: { status: true, data: { status: "otp" } } },
    });

    const passage = await envoyerLesVersements();

    expect(passage.bloqueParOtp).toBe(true);
    expect(passage.envoyes).toBe(0);
    expect(await db.payout.count({ where: { status: "CREATING" } })).toBe(2);
  });

  it("ne tente rien sans nom de titulaire", async () => {
    // Un écart entre ce nom et celui du compte est le premier motif de rejet
    // d'un virement chez l'opérateur.
    const { versement } = await creerVersement({ avecNom: false });
    const { appels } = jouerPaystack({
      beneficiaire: {
        statut: 400,
        corps: { status: false, message: "name is required" },
      },
    });

    const passage = await envoyerLesVersements();

    expect(passage.ignores).toBe(1);
    expect((await etatDe(versement.id)).status).toBe("CREATING");
    expect(appels.some((a) => a.url.endsWith("/transfer"))).toBe(false);
  });
});

describe("sans opérateur qui sache verser", () => {
  it("ne fait rien, et ce n'est pas une panne", async () => {
    // Le cycle continue de préparer, l'écran admin fait avancer à la main.
    // C'est exactement ce qui se passait avant cette intégration.
    const { versement } = await creerVersement();
    process.env.PAYMENTS_DRIVER = "bac-a-sable";
    process.env.PAYMENTS_SANDBOX_SECRET = "un-secret-de-bac-a-sable-assez-long";

    const passage = await envoyerLesVersements();

    expect(passage).toEqual({
      envoyes: 0,
      echoues: 0,
      ignores: 0,
      bloqueParOtp: false,
    });
    expect((await etatDe(versement.id)).status).toBe("CREATING");
  });
});
