/**
 * Ce qu'un rappel d'opérateur fait — et surtout ce qu'il ne doit pas faire.
 *
 * Cette chaîne est le seul endroit où un inconnu peut faire créditer un compte.
 * Les tests qui comptent ici ne sont donc pas ceux du cas nominal : ce sont le
 * rejeu, le montant qui ne correspond pas, et l'échec qui arrive après un
 * succès. Chacun, laissé ouvert, se solde par de l'argent créé de rien.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { acheter } from "@/lib/checkout/achat";
import { db } from "@/lib/db";
import type { FaitPaiement } from "@/lib/payments/encaissement/pilotes";
import { recevoir } from "@/lib/payments/encaissement/reception";
import { perimerCommandesOubliees } from "@/lib/payments/encaissement/reglement";

const AVANT = {
  simulation: process.env.CHECKOUT_SIMULATION_ENABLED,
  driver: process.env.PAYMENTS_DRIVER,
  secret: process.env.PAYMENTS_SANDBOX_SECRET,
  url: process.env.APP_URL,
};

const PRIX = 5_000;

beforeEach(() => {
  // Pas de simulation : on veut le vrai chemin, celui qui laisse la commande
  // ouverte en attendant le rappel.
  delete process.env.CHECKOUT_SIMULATION_ENABLED;
  process.env.PAYMENTS_DRIVER = "bac-a-sable";
  process.env.PAYMENTS_SANDBOX_SECRET = "un-secret-de-bac-a-sable-assez-long";
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

async function creerUtilisateur(role: string) {
  n += 1;
  return db.user.create({
    data: {
      email: `${role}-${n}@baobart.test`,
      profile: { create: { username: `${role}-${n}`, displayName: `${role} ${n}` } },
    },
    select: { id: true, email: true },
  });
}

async function creerProduit(vendeurId: string, prix = PRIX) {
  n += 1;
  const produit = await db.product.create({
    data: {
      sellerId: vendeurId,
      name: `Ressource ${n}`,
      slug: `ressource-${n}`,
      price: prix,
      currency: "XOF",
      status: "PUBLISHED",
    },
    select: { id: true },
  });

  const media = await db.mediaAsset.create({
    data: {
      ownerId: vendeurId,
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

  return produit;
}

/** Ouvre une commande par le vrai tunnel, et la laisse en attente. */
async function ouvrirCommande(prix = PRIX) {
  const vendeur = await creerUtilisateur("vendeur");
  const acheteur = await creerUtilisateur("acheteur");
  const produit = await creerProduit(vendeur.id, prix);

  const suite = await acheter({ produitId: produit.id, acheteurId: acheteur.id });
  if (!suite.ok) throw new Error(`ouverture refusée : ${suite.motif}`);

  return { ...suite, vendeur, acheteur, produit };
}

let e = 0;

function fait(reference: string, patch: Partial<FaitPaiement> = {}): FaitPaiement {
  e += 1;
  return {
    sens: "ENCAISSEMENT",
    evenement: `evt-${e}`,
    reference,
    referenceOperateur: `op-${e}`,
    issue: "REUSSI",
    montant: PRIX,
    devise: "XOF",
    ...patch,
  };
}

async function etatDe(orderItemId: string) {
  return db.orderItem.findUniqueOrThrow({
    where: { id: orderItemId },
    select: { state: true, order: { select: { status: true } } },
  });
}

describe("l'ouverture du paiement", () => {
  it("laisse la commande en attente, sans rien créditer", async () => {
    const { orderId, orderItemId, vendeur, paye } = await ouvrirCommande();

    expect(paye).toBe(false);

    const ligne = await etatDe(orderItemId);
    expect(ligne.state).toBe("IN_PROGRESS");
    expect(ligne.order.status).toBe("IN_PROGRESS");

    // Rien n'est crédité tant que l'opérateur n'a pas parlé. C'est toute la
    // différence avec la simulation.
    const soldes = await db.balance.count({ where: { userId: vendeur.id } });
    expect(soldes).toBe(0);

    // Et aucun reçu : il dirait « tu as payé » à quelqu'un qui n'a pas payé.
    expect(await db.emailOutbox.count({ where: { idempotencyKey: `recu-${orderItemId}` } })).toBe(0);

    expect(orderId).toBeTruthy();
  });
});

describe("un rappel qui annonce un succès", () => {
  it("crédite le vendeur, clôt la commande et dépose le reçu", async () => {
    const { orderId, orderItemId, vendeur, acheteur } = await ouvrirCommande();

    const suite = await recevoir("bac-a-sable", fait(orderId), {});
    expect(suite).toEqual({ recu: true, effet: "ENCAISSE" });

    const ligne = await etatDe(orderItemId);
    expect(ligne.state).toBe("SUCCESSFUL");
    expect(ligne.order.status).toBe("COMPLETED");

    const soldes = await db.balance.count({ where: { userId: vendeur.id } });
    expect(soldes).toBeGreaterThan(0);

    const recu = await db.emailOutbox.findUniqueOrThrow({
      where: { idempotencyKey: `recu-${orderItemId}` },
      select: { recipient: true, template: true },
    });
    expect(recu.recipient).toBe(acheteur.email);
    expect(recu.template).toBe("RECU_ACHAT");
  });

  it("garde la référence de l'opérateur sur la commande", async () => {
    const { orderId } = await ouvrirCommande();
    const f = fait(orderId);

    await recevoir("bac-a-sable", f, {});

    const commande = await db.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { providerRef: true },
    });
    expect(commande.providerRef).toBe(f.referenceOperateur);
  });
});

describe("le rejeu", () => {
  it("ne crédite pas deux fois quand le même événement revient", async () => {
    const { orderId, orderItemId, vendeur } = await ouvrirCommande();
    const f = fait(orderId);

    expect(await recevoir("bac-a-sable", f, {})).toEqual({
      recu: true,
      effet: "ENCAISSE",
    });

    // Le même identifiant d'événement : la clé unique tranche avant tout
    // traitement.
    const second = await recevoir("bac-a-sable", f, {});
    expect(second).toEqual({ recu: false, motif: "REJEU", detail: f.evenement });

    const mouvements = await db.balanceTransaction.count({
      where: { balance: { userId: vendeur.id } },
    });
    const apres = await etatDe(orderItemId);
    expect(apres.state).toBe("SUCCESSFUL");
    expect(mouvements).toBeGreaterThan(0);

    // Rien n'a bougé une seconde fois : un seul reçu.
    expect(
      await db.emailOutbox.count({ where: { idempotencyKey: `recu-${orderItemId}` } }),
    ).toBe(1);
  });

  it("reprend un rappel resté sans décision au lieu de l'enterrer", async () => {
    const { orderId, orderItemId, vendeur } = await ouvrirCommande();
    const f = fait(orderId);

    // On simule un passage mort entre l'enregistrement et la décision : la
    // ligne existe, en RECEIVED, et rien n'a été crédité. C'est l'état que
    // laisse un déploiement au mauvais moment, ou une base qui coupe.
    await db.paymentWebhookEvent.create({
      data: {
        provider: "bac-a-sable",
        eventRef: f.evenement,
        providerRef: f.referenceOperateur,
        payload: {},
        status: "RECEIVED",
      },
    });

    // L'opérateur rejoue. Répondre « rejeu » ici enterrerait la commande pour
    // de bon : il ne rejouera pas indéfiniment.
    const suite = await recevoir("bac-a-sable", f, {});
    expect(suite).toEqual({ recu: true, effet: "ENCAISSE" });

    expect((await etatDe(orderItemId)).state).toBe("SUCCESSFUL");
    expect(
      await db.balance.count({ where: { userId: vendeur.id } }),
    ).toBeGreaterThan(0);
  });

  it("tient toujours le rejeu d'un rappel DÉJÀ traité", async () => {
    const { orderId } = await ouvrirCommande();
    const f = fait(orderId);

    await recevoir("bac-a-sable", f, {});

    // La ligne est PROCESSED : celui-ci est un vrai rejeu, et il ne doit rien
    // reprendre.
    expect(await recevoir("bac-a-sable", f, {})).toEqual({
      recu: false,
      motif: "REJEU",
      detail: f.evenement,
    });
  });

  it("ne crédite pas deux fois quand l'opérateur change d'identifiant", async () => {
    const { orderId, vendeur } = await ouvrirCommande();

    await recevoir("bac-a-sable", fait(orderId), {});
    const avant = await db.balanceTransaction.count({
      where: { balance: { userId: vendeur.id } },
    });

    // Deuxième événement, même succès. La clé unique ne protège plus : c'est la
    // condition d'état dans le `WHERE` de l'encaissement qui tient.
    const second = await recevoir("bac-a-sable", fait(orderId), {});
    expect(second).toEqual({ recu: true, effet: "SANS_EFFET" });

    const apres = await db.balanceTransaction.count({
      where: { balance: { userId: vendeur.id } },
    });
    expect(apres).toBe(avant);
  });
});

describe("un rappel qui ne correspond pas", () => {
  it("refuse un montant différent du nôtre, sans rien créditer", async () => {
    const { orderId, orderItemId, vendeur } = await ouvrirCommande();

    const suite = await recevoir("bac-a-sable", fait(orderId, { montant: 100 }), {});

    expect(suite.recu).toBe(false);
    expect(suite.recu === false && suite.motif).toBe("MONTANT_DISCORDANT");

    const ligne = await etatDe(orderItemId);
    expect(ligne.state).toBe("IN_PROGRESS");
    expect(await db.balance.count({ where: { userId: vendeur.id } })).toBe(0);
  });

  it("refuse une autre devise", async () => {
    const { orderId, orderItemId } = await ouvrirCommande();

    const suite = await recevoir("bac-a-sable", fait(orderId, { devise: "EUR" }), {});

    expect(suite.recu).toBe(false);
    expect(suite.recu === false && suite.motif).toBe("DEVISE_DISCORDANTE");
    expect((await etatDe(orderItemId)).state).toBe("IN_PROGRESS");
  });

  it("refuse une référence qui ne mène à aucune commande", async () => {
    const suite = await recevoir("bac-a-sable", fait("commande-imaginaire"), {});

    expect(suite.recu).toBe(false);
    expect(suite.recu === false && suite.motif).toBe("COMMANDE_INTROUVABLE");
  });

  it("garde une trace refusée de tout cela", async () => {
    const { orderId } = await ouvrirCommande();
    const f = fait(orderId, { montant: 42 });

    await recevoir("bac-a-sable", f, {});

    const trace = await db.paymentWebhookEvent.findFirstOrThrow({
      where: { eventRef: f.evenement },
      select: { status: true, error: true },
    });
    expect(trace.status).toBe("REJECTED");
    expect(trace.error).toContain("42");
  });
});

describe("un rappel qui annonce un échec", () => {
  it("referme la commande sans rien créditer", async () => {
    const { orderId, orderItemId, vendeur } = await ouvrirCommande();

    const suite = await recevoir(
      "bac-a-sable",
      fait(orderId, { issue: "ECHOUE", montant: null, devise: null }),
      {},
    );
    expect(suite).toEqual({ recu: true, effet: "ABANDONNE" });

    const ligne = await etatDe(orderItemId);
    expect(ligne.state).toBe("FAILED");
    expect(ligne.order.status).toBe("ABANDONED");
    expect(await db.balance.count({ where: { userId: vendeur.id } })).toBe(0);
  });

  it("ne défait rien s'il arrive APRÈS un succès", async () => {
    const { orderId, orderItemId, vendeur } = await ouvrirCommande();

    await recevoir("bac-a-sable", fait(orderId), {});
    const avant = await db.balanceTransaction.count({
      where: { balance: { userId: vendeur.id } },
    });

    // Un opérateur se dédit. On ne renverse pas un encaissement sur cette
    // base : un renversement est un litige, et il laisse une écriture inverse
    // au lieu d'effacer la première.
    const suite = await recevoir(
      "bac-a-sable",
      fait(orderId, { issue: "ECHOUE", montant: null, devise: null }),
      {},
    );
    expect(suite).toEqual({ recu: true, effet: "SANS_EFFET" });

    const ligne = await etatDe(orderItemId);
    expect(ligne.state).toBe("SUCCESSFUL");
    expect(
      await db.balanceTransaction.count({ where: { balance: { userId: vendeur.id } } }),
    ).toBe(avant);
  });
});

describe("un rappel d'étape", () => {
  it("ne décide de rien et attend la suite", async () => {
    const { orderId, orderItemId } = await ouvrirCommande();

    const suite = await recevoir(
      "bac-a-sable",
      fait(orderId, { issue: "EN_COURS", montant: null, devise: null }),
      {},
    );
    expect(suite).toEqual({ recu: true, effet: "SANS_EFFET" });
    expect((await etatDe(orderItemId)).state).toBe("IN_PROGRESS");
  });
});

describe("la péremption des commandes oubliées", () => {
  it("referme une commande qu'aucun rappel n'a conclue", async () => {
    const { orderId, orderItemId, vendeur } = await ouvrirCommande();

    // Vingt-cinq heures plus tard : au-delà de tout rappel plausible.
    await db.order.update({
      where: { id: orderId },
      data: { createdAt: new Date(Date.now() - 25 * 3_600_000) },
    });

    expect(await perimerCommandesOubliees()).toBe(1);

    const ligne = await etatDe(orderItemId);
    expect(ligne.state).toBe("FAILED");
    expect(ligne.order.status).toBe("ABANDONED");

    // Rien n'a jamais été encaissé : rien n'est rendu, rien n'est débité.
    expect(await db.balance.count({ where: { userId: vendeur.id } })).toBe(0);
  });

  it("laisse tranquille une commande encore fraîche", async () => {
    const { orderItemId } = await ouvrirCommande();

    expect(await perimerCommandesOubliees()).toBe(0);
    expect((await etatDe(orderItemId)).state).toBe("IN_PROGRESS");
  });

  it("ne touche pas une commande déjà encaissée", async () => {
    const { orderId, orderItemId } = await ouvrirCommande();
    await recevoir("bac-a-sable", fait(orderId), {});

    await db.order.update({
      where: { id: orderId },
      data: { createdAt: new Date(Date.now() - 25 * 3_600_000) },
    });

    expect(await perimerCommandesOubliees()).toBe(0);
    expect((await etatDe(orderItemId)).state).toBe("SUCCESSFUL");
  });

  it("crie quand un paiement arrive sur une commande refermée", async () => {
    // Le pire cas du mobile money : l'acheteur a payé, et on avait refermé.
    // Aucun code ne répare cela tout seul — il faut qu'un humain le voie.
    const { orderId, orderItemId } = await ouvrirCommande();

    await db.order.update({
      where: { id: orderId },
      data: { createdAt: new Date(Date.now() - 25 * 3_600_000) },
    });
    await perimerCommandesOubliees();

    const suite = await recevoir("bac-a-sable", fait(orderId), {});

    expect(suite.recu).toBe(false);
    expect(suite.recu === false && suite.motif).toBe("COMMANDE_REFERMEE");

    // Et la ligne reste en échec : on ne crédite pas en douce.
    expect((await etatDe(orderItemId)).state).toBe("FAILED");

    // La trace est marquée refusée, donc visible à l'écran Système.
    const trace = await db.paymentWebhookEvent.findFirstOrThrow({
      where: { status: "REJECTED" },
      select: { error: true },
    });
    expect(trace.error).toContain("refermée");
  });
});

describe("un rappel qui parle d'un virement sortant", () => {
  /**
   * Un versement déjà parti, en attente de confirmation.
   *
   * C'est l'état dans lequel le rappel de l'opérateur le trouve : l'argent est
   * DÉJÀ sorti. On n'attend plus une autorisation, on enregistre une issue.
   */
  async function versementEnCours() {
    n += 1;
    const createur = await db.user.create({
      data: {
        email: `c-vers-${n}@baobart.test`,
        profile: { create: { username: `c-vers-${n}`, displayName: `C ${n}` } },
      },
      select: { id: true },
    });

    const versement = await db.payout.create({
      data: {
        userId: createur.id,
        method: "MOBILE_MONEY",
        provider: "om",
        accountRef: `2250700${n}`,
        amount: 9_000,
        currency: "XOF",
        status: "PROCESSING",
        providerRef: "TRF_x",
      },
      select: { id: true },
    });

    return { createur, versement };
  }

  function faitVersement(
    reference: string,
    issue: "REUSSI" | "ECHOUE" | "RETOURNE" | "EN_COURS",
  ) {
    e += 1;
    return {
      sens: "VERSEMENT" as const,
      evenement: `evt-v-${e}`,
      reference,
      referenceOperateur: "TRF_x",
      issue,
      montant: null,
      devise: null,
    };
  }

  async function etatVersement(payoutId: string) {
    return db.payout.findUniqueOrThrow({
      where: { id: payoutId },
      select: { status: true, failureReason: true },
    });
  }

  it("confirme le versement sur un succès", async () => {
    const { versement } = await versementEnCours();

    const suite = await recevoir(
      "bac-a-sable",
      faitVersement(versement.id, "REUSSI"),
      {},
    );

    expect(suite).toEqual({ recu: true, effet: "VERSE" });
    expect((await etatVersement(versement.id)).status).toBe("COMPLETED");
  });

  it("fait échouer le versement, et garde le motif", async () => {
    const { versement } = await versementEnCours();

    const suite = await recevoir(
      "bac-a-sable",
      faitVersement(versement.id, "ECHOUE"),
      {},
    );

    expect(suite).toEqual({ recu: true, effet: "VERSEMENT_ECHOUE" });
    const apres = await etatVersement(versement.id);
    expect(apres.status).toBe("FAILED");
    expect(apres.failureReason).toContain("TRF_x");
  });

  it("traite un renversement avant arrivée comme un échec, en le nommant", async () => {
    // Notre machine réserve RETURNED aux versements dont l'argent est arrivé
    // quelque part avant de revenir. Un versement encore PROCESSING n'a rien
    // atteint : on n'invente pas une transition que la machine refuse, et
    // l'information vit dans le motif.
    const { versement } = await versementEnCours();

    await recevoir("bac-a-sable", faitVersement(versement.id, "RETOURNE"), {});

    const apres = await etatVersement(versement.id);
    expect(apres.status).toBe("FAILED");
    expect(apres.failureReason).toContain("Renversé");
  });

  it("marque RETOURNÉ un versement déjà arrivé, puis renversé", async () => {
    const { versement } = await versementEnCours();
    await recevoir("bac-a-sable", faitVersement(versement.id, "REUSSI"), {});

    await recevoir("bac-a-sable", faitVersement(versement.id, "RETOURNE"), {});

    expect((await etatVersement(versement.id)).status).toBe("RETURNED");
  });

  it("ne décide de rien sur une étape intermédiaire", async () => {
    const { versement } = await versementEnCours();

    const suite = await recevoir(
      "bac-a-sable",
      faitVersement(versement.id, "EN_COURS"),
      {},
    );

    expect(suite).toEqual({ recu: true, effet: "SANS_EFFET" });
    expect((await etatVersement(versement.id)).status).toBe("PROCESSING");
  });

  it("ne cherche pas un virement parmi les commandes", async () => {
    // Sans le marqueur de sens, un virement réussi serait cherché parmi les
    // commandes — et n'y étant pas, refusé comme « commande introuvable ».
    const suite = await recevoir(
      "bac-a-sable",
      faitVersement("versement-imaginaire", "REUSSI"),
      {},
    );

    expect(suite.recu).toBe(false);
    expect(suite.recu === false && suite.motif).toBe("VERSEMENT_INTROUVABLE");
  });

  it("laisse passer un rejeu sans rien casser", async () => {
    const { versement } = await versementEnCours();
    await recevoir("bac-a-sable", faitVersement(versement.id, "REUSSI"), {});

    // Un second succès, sous un autre identifiant d'événement : la machine
    // refuse la transition, et ce refus est le cas normal du rejeu.
    const second = await recevoir(
      "bac-a-sable",
      faitVersement(versement.id, "REUSSI"),
      {},
    );

    expect(second).toEqual({ recu: true, effet: "SANS_EFFET" });
    expect((await etatVersement(versement.id)).status).toBe("COMPLETED");
  });
});
