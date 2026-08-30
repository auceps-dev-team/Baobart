/**
 * La route de rappel, exercée par son vrai point d'entrée.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE FICHIER EXISTE
 *
 * `reception.integration.test.ts` éprouve la décision — ce qu'on fait d'un fait
 * une fois qu'on le croit. Il appelle `recevoir()` directement, et saute donc
 * exactement ce qui protège : la reconnaissance du fournisseur, la lecture du
 * corps **brut**, la vérification de signature, les bornes de taille, et les
 * codes de retour.
 *
 * Or c'est cette route, et elle seule, qu'un inconnu peut atteindre. Un test
 * qui ne passe pas par elle laisse sans surveillance le seul endroit du système
 * où quelqu'un d'extérieur peut faire créditer un compte.
 *
 * Les codes de retour comptent autant que les effets : un opérateur qui reçoit
 * une erreur rejoue, parfois des jours. Répondre 500 là où il fallait 200
 * transforme une anomalie en tempête.
 */

import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/paiements/[fournisseur]/webhook/route";
import { acheter } from "@/lib/checkout/achat";
import { db } from "@/lib/db";

const SECRET = "un-secret-de-bac-a-sable-assez-long";
const PRIX = 5_000;

const AVANT = {
  simulation: process.env.CHECKOUT_SIMULATION_ENABLED,
  driver: process.env.PAYMENTS_DRIVER,
  secret: process.env.PAYMENTS_SANDBOX_SECRET,
  url: process.env.APP_URL,
};

beforeEach(() => {
  delete process.env.CHECKOUT_SIMULATION_ENABLED;
  process.env.PAYMENTS_DRIVER = "bac-a-sable";
  process.env.PAYMENTS_SANDBOX_SECRET = SECRET;
  process.env.APP_URL = "https://baobart.test";
});

afterEach(() => {
  for (const [cle, valeur] of [
    ["CHECKOUT_SIMULATION_ENABLED", AVANT.simulation],
    ["PAYMENTS_DRIVER", AVANT.driver],
    ["PAYMENTS_SANDBOX_SECRET", AVANT.secret],
    ["APP_URL", AVANT.url],
  ] as const) {
    if (valeur === undefined) delete process.env[cle];
    else process.env[cle] = valeur;
  }
});

let n = 0;

async function ouvrirCommande() {
  n += 1;
  const vendeur = await db.user.create({
    data: {
      email: `v-wh-${n}@baobart.test`,
      profile: { create: { username: `v-wh-${n}`, displayName: `V ${n}` } },
    },
    select: { id: true },
  });
  const acheteur = await db.user.create({
    data: {
      email: `a-wh-${n}@baobart.test`,
      profile: { create: { username: `a-wh-${n}`, displayName: `A ${n}` } },
    },
    select: { id: true },
  });

  const produit = await db.product.create({
    data: {
      sellerId: vendeur.id,
      name: `Ressource wh ${n}`,
      slug: `ressource-wh-${n}`,
      price: PRIX,
      currency: "XOF",
      status: "PUBLISHED",
    },
    select: { id: true },
  });

  const media = await db.mediaAsset.create({
    data: {
      ownerId: vendeur.id,
      purpose: "product",
      s3Key: `produits/${produit.id}/f-${n}.zip`,
      checksum: "x",
      contentType: "application/zip",
      sizeBytes: 1024,
      status: "READY",
    },
    select: { id: true },
  });
  await db.productFile.create({
    data: {
      productId: produit.id,
      mediaId: media.id,
      filename: `f-${n}.zip`,
      sizeBytes: 1024,
      role: "SOURCE",
      position: 0,
    },
  });

  const suite = await acheter({ produitId: produit.id, acheteurId: acheteur.id });
  if (!suite.ok) throw new Error(`ouverture refusée : ${suite.motif}`);

  return { ...suite, vendeur };
}

let e = 0;

function corpsPour(orderId: string, patch: Record<string, unknown> = {}): string {
  e += 1;
  return JSON.stringify({
    event: `evt-wh-${e}`,
    reference: orderId,
    operatorRef: `op-wh-${e}`,
    status: "REUSSI",
    amount: PRIX,
    currency: "XOF",
    ...patch,
  });
}

/** Frappe la route comme le ferait l'opérateur. */
async function appeler(
  fournisseur: string,
  corps: string,
  options: { signature?: string | null; taille?: string } = {},
) {
  const entetes = new Headers({ "content-type": "application/json" });

  const signature =
    options.signature === undefined
      ? createHmac("sha256", SECRET).update(corps, "utf8").digest("hex")
      : options.signature;

  if (signature !== null) entetes.set("x-baobart-signature", signature);
  if (options.taille) entetes.set("content-length", options.taille);

  return POST(
    new Request("https://baobart.test/api/paiements/x/webhook", {
      method: "POST",
      headers: entetes,
      body: corps,
    }),
    { params: Promise.resolve({ fournisseur }) },
  );
}

async function etatDe(orderItemId: string) {
  return db.orderItem.findUniqueOrThrow({
    where: { id: orderItemId },
    select: { state: true },
  });
}

describe("ce que la route refuse avant même de lire", () => {
  it("répond 404 sur un fournisseur inconnu", async () => {
    // 404 plutôt que 400 : la liste des opérateurs branchés n'a pas à se
    // découvrir en tâtonnant sur l'URL.
    const r = await appeler("operateur-imaginaire", "{}");
    expect(r.status).toBe(404);
  });

  it("répond 503 quand le pilote existe mais n'est pas configuré", async () => {
    // Accepter sans pouvoir vérifier serait pire que refuser.
    delete process.env.PAYMENTS_SANDBOX_SECRET;
    const r = await appeler("bac-a-sable", "{}", { signature: null });
    expect(r.status).toBe(503);
  });

  it("répond 413 sur un corps annoncé trop long", async () => {
    const r = await appeler("bac-a-sable", "{}", { taille: String(200 * 1024) });
    expect(r.status).toBe(413);
  });
});

describe("la signature", () => {
  it("répond 401 sans en-tête de signature", async () => {
    const r = await appeler("bac-a-sable", "{}", { signature: null });
    expect(r.status).toBe(401);
  });

  it("répond 401 sur une signature qui ne correspond pas au corps", async () => {
    const { orderId, orderItemId } = await ouvrirCommande();
    const corps = corpsPour(orderId);

    // Le cœur de l'attaque : une signature valide pour un AUTRE corps.
    const volee = createHmac("sha256", SECRET)
      .update('{"amount":1}', "utf8")
      .digest("hex");

    const r = await appeler("bac-a-sable", corps, { signature: volee });
    expect(r.status).toBe(401);

    // Et surtout : rien n'a bougé.
    expect((await etatDe(orderItemId)).state).toBe("IN_PROGRESS");
  });

  it("garde une trace du refus, pour qu'un secret décalé se voie", async () => {
    // C'est la panne la plus fréquente d'une intégration, et la plus
    // silencieuse : rien ne casse côté acheteur, les commandes restent
    // simplement en attente.
    await appeler("bac-a-sable", '{"x":1}', { signature: "fausse" });

    const trace = await db.paymentWebhookEvent.findFirstOrThrow({
      where: { status: "REJECTED" },
      select: { error: true, provider: true },
    });
    expect(trace.error).toBe("signature invalide");
    expect(trace.provider).toBe("bac-a-sable");
  });

  it("n'écrit qu'une trace pour un même corps refusé mille fois", async () => {
    // La référence est l'empreinte du corps : c'est ce qui rend supportable
    // d'enregistrer les refus sur une route publique.
    for (let i = 0; i < 4; i += 1) {
      await appeler("bac-a-sable", '{"identique":true}', { signature: "fausse" });
    }

    expect(await db.paymentWebhookEvent.count({ where: { status: "REJECTED" } })).toBe(1);
  });
});

describe("un corps authentique mais illisible", () => {
  it("répond 400, et le dit à l'opérateur", async () => {
    // 400 et non 200 : c'est une panne de configuration chez lui, il faut la
    // lui faire remonter plutôt que de l'absorber en silence.
    const r = await appeler("bac-a-sable", "ceci n'est pas du json");
    expect(r.status).toBe(400);
  });

  it("répond 400 sur un corps lisible dont l'issue est inventée", async () => {
    const r = await appeler(
      "bac-a-sable",
      JSON.stringify({ event: "e", reference: "c", status: "PEUT_ETRE" }),
    );
    expect(r.status).toBe(400);
  });
});

describe("un rappel authentique", () => {
  it("crédite, et répond 200", async () => {
    const { orderId, orderItemId, vendeur } = await ouvrirCommande();

    const r = await appeler("bac-a-sable", corpsPour(orderId));

    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ recu: true, effet: "ENCAISSE" });

    expect((await etatDe(orderItemId)).state).toBe("SUCCESSFUL");
    expect(
      await db.balance.count({ where: { userId: vendeur.id } }),
    ).toBeGreaterThan(0);
  });

  it("répond 200 à un rejeu, sans créditer deux fois", async () => {
    const { orderId, orderItemId, vendeur } = await ouvrirCommande();
    const corps = corpsPour(orderId);

    await appeler("bac-a-sable", corps);
    const avant = await db.balanceTransaction.count({
      where: { balance: { userId: vendeur.id } },
    });

    const r = await appeler("bac-a-sable", corps);

    // 200, pas une erreur : un opérateur qui rejoue fait son travail, et lui
    // répondre 500 le ferait rejouer encore.
    expect(r.status).toBe(200);
    expect((await etatDe(orderItemId)).state).toBe("SUCCESSFUL");
    expect(
      await db.balanceTransaction.count({ where: { balance: { userId: vendeur.id } } }),
    ).toBe(avant);
  });

  it("répond 200 sur un montant discordant, mais ne crédite rien", async () => {
    const { orderId, orderItemId, vendeur } = await ouvrirCommande();

    const r = await appeler("bac-a-sable", corpsPour(orderId, { amount: 100 }));

    // 200 : l'appel est reçu et classé. Répondre 500 ferait rejouer un rappel
    // qui sera refusé à l'identique — indéfiniment.
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ effet: "MONTANT_DISCORDANT" });

    expect((await etatDe(orderItemId)).state).toBe("IN_PROGRESS");
    expect(await db.balance.count({ where: { userId: vendeur.id } })).toBe(0);
  });

  it("répond 200 sur une référence inconnue, sans rien créer", async () => {
    const r = await appeler("bac-a-sable", corpsPour("commande-imaginaire"));

    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ effet: "COMMANDE_INTROUVABLE" });
    expect(await db.order.count()).toBe(0);
  });

  it("referme la commande sur un échec annoncé", async () => {
    const { orderId, orderItemId } = await ouvrirCommande();

    const r = await appeler(
      "bac-a-sable",
      corpsPour(orderId, { status: "ECHOUE", amount: undefined }),
    );

    expect(r.status).toBe(200);
    expect((await etatDe(orderItemId)).state).toBe("FAILED");
  });
});
