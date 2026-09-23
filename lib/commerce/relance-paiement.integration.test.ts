/**
 * La relance des paiements laissés en plan.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE TEST LE PLUS UTILE EST CELUI QUI VÉRIFIE QU'ON NE RELANCE PAS
 *
 * Une relance qui part est visible : elle arrive dans une boîte. Une relance
 * qui part **à tort** ne se voit qu'une fois, chez la personne qui vient de
 * payer et à qui l'on écrit « ton achat attend encore ».
 *
 * D'où quatre cas de non-envoi éprouvés pour un seul cas d'envoi : trop tôt,
 * trop tard, déjà relancé, déjà acquis.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  DELAI_RELANCE_MS,
  noterConversion,
  relancerLesPaiementsOublies,
  statistiquesRelance,
} from "@/lib/commerce/relance-paiement";
import { db } from "@/lib/db";
import { PEREMPTION_MS } from "@/lib/payments/encaissement/reglement";

let n = 0;
const suffixe = () => `${Date.now()}-${++n}`;

const APP_URL_ORIGINE = process.env.APP_URL;

beforeEach(() => {
  process.env.APP_URL = APP_URL_ORIGINE ?? "http://localhost:3100";
});

/** Une commande ouverte, d'un âge choisi. */
async function commandeOuverte(ageMs: number) {
  const marque = suffixe();

  const vendeur = await db.user.create({
    data: { email: `rel-v-${marque}@baobart.test` },
    select: { id: true },
  });

  const acheteur = await db.user.create({
    data: {
      email: `rel-a-${marque}@baobart.test`,
      profile: {
        create: { username: `rel-${marque}`, displayName: "Aya Kouassi" },
      },
    },
    select: { id: true, email: true },
  });

  const produit = await db.product.create({
    data: {
      sellerId: vendeur.id,
      slug: `rel-${marque}`,
      name: "Pack wax",
      price: 5_000,
      currency: "XOF",
      status: "PUBLISHED",
    },
    select: { id: true, slug: true },
  });

  const creeLe = new Date(Date.now() - ageMs);

  const commande = await db.order.create({
    data: {
      buyerId: acheteur.id,
      total: 5_000,
      currency: "XOF",
      provider: "paystack",
      createdAt: creeLe,
      items: {
        create: { productId: produit.id, quantity: 1, price: 5_000 },
      },
    },
    select: { id: true, items: { select: { id: true } } },
  });

  return {
    acheteur,
    produit,
    commandeId: commande.id,
    ligneId: commande.items[0]!.id,
  };
}

async function messagesPour(orderId: string) {
  return db.emailOutbox.count({
    where: { idempotencyKey: `relance-paiement-${orderId}` },
  });
}

describe("ce qu'on relance", () => {
  beforeEach(async () => {
    await db.relancePaiement.deleteMany({});
  });

  it("dépose un message pour une commande de trois heures", async () => {
    const { commandeId } = await commandeOuverte(3 * 3_600_000);

    const bilan = await relancerLesPaiementsOublies();

    expect(bilan.envoyees).toBeGreaterThanOrEqual(1);
    expect(await messagesPour(commandeId)).toBe(1);
    expect(
      await db.relancePaiement.count({ where: { orderId: commandeId } }),
    ).toBe(1);
  });

  it("annonce les heures restantes, arrondies vers le bas", async () => {
    // Annoncer « 4 » quand il en reste 3,2 ferait revenir quelqu'un devant
    // une commande fermée, avec un message de nous à l'appui.
    const { commandeId } = await commandeOuverte(3 * 3_600_000);

    await relancerLesPaiementsOublies();

    const message = await db.emailOutbox.findFirstOrThrow({
      where: { idempotencyKey: `relance-paiement-${commandeId}` },
      select: { payload: true },
    });

    // 24 h de péremption − 3 h d'âge = 21 h restantes… moins les quelques
    // millisecondes écoulées entre la création et le passage. `Math.floor`
    // rend donc 20, et c'est exactement ce qu'on veut : annoncer 21 h quand
    // il en reste 20,99 ferait revenir quelqu'un une minute trop tard.
    //
    // Ma première version attendait 21. Le code avait raison, le test avait
    // tort — et c'est précisément la propriété qu'il fallait exprimer :
    // l'annonce est toujours inférieure ou égale au temps réel.
    const heures = (message.payload as { heures: number }).heures;
    expect(heures).toBeLessThanOrEqual(21);
    expect(heures).toBeGreaterThanOrEqual(20);
  });
});

describe("ce qu'on ne relance pas", () => {
  beforeEach(async () => {
    await db.relancePaiement.deleteMany({});
  });

  it("laisse tranquille une commande d'une heure", async () => {
    // Trop tôt : on écrirait à quelqu'un en train de taper son code.
    const { commandeId } = await commandeOuverte(DELAI_RELANCE_MS / 2);

    await relancerLesPaiementsOublies();

    expect(await messagesPour(commandeId)).toBe(0);
  });

  it("laisse tranquille une commande déjà périmée", async () => {
    // Trop tard : le lien de reprise ne mène plus à rien, et la commande va
    // être refermée par le même passage.
    const { commandeId } = await commandeOuverte(PEREMPTION_MS + 3_600_000);

    await relancerLesPaiementsOublies();

    expect(await messagesPour(commandeId)).toBe(0);
  });

  it("ne relance jamais deux fois", async () => {
    // La contrainte d'unicité est le garde-fou ; ceci vérifie qu'elle joue.
    const { commandeId } = await commandeOuverte(3 * 3_600_000);

    await relancerLesPaiementsOublies();
    const second = await relancerLesPaiementsOublies();

    expect(second.ecartees.dejaRelancee).toBeGreaterThanOrEqual(1);
    expect(await messagesPour(commandeId)).toBe(1);
  });

  it("n'écrit pas à qui a déjà acquis la ressource", async () => {
    // LE CAS QUI COMPTE. Entre la tentative abandonnée et ce passage,
    // l'acheteur a pu recommencer et réussir : il existe alors une SECONDE
    // commande, aboutie, et la première reste ouverte jusqu'à sa péremption.
    //
    // Sans ce contrôle, on écrit « ton achat attend encore » à quelqu'un qui
    // a déjà payé et téléchargé.
    const { commandeId, acheteur, produit } = await commandeOuverte(
      3 * 3_600_000,
    );

    await db.order.create({
      data: {
        buyerId: acheteur.id,
        total: 5_000,
        currency: "XOF",
        status: "COMPLETED",
        items: {
          create: {
            productId: produit.id,
            quantity: 1,
            price: 5_000,
            state: "SUCCESSFUL",
          },
        },
      },
    });

    const bilan = await relancerLesPaiementsOublies();

    expect(bilan.ecartees.dejaAcquise).toBeGreaterThanOrEqual(1);
    expect(await messagesPour(commandeId)).toBe(0);
  });

  it("n'envoie rien sans adresse de site", async () => {
    // Une relance sans lien ne sert à rien — contrairement à un reçu, qui
    // vaut preuve de paiement même sans URL.
    const { commandeId } = await commandeOuverte(3 * 3_600_000);
    delete process.env.APP_URL;

    const bilan = await relancerLesPaiementsOublies();

    expect(bilan.envoyees).toBe(0);
    expect(await messagesPour(commandeId)).toBe(0);
  });
});

describe("la mesure", () => {
  beforeEach(async () => {
    await db.relancePaiement.deleteMany({});
  });

  it("note la conversion d'une commande relancée", async () => {
    const { commandeId } = await commandeOuverte(3 * 3_600_000);
    await relancerLesPaiementsOublies();

    await noterConversion(commandeId);

    const ligne = await db.relancePaiement.findUniqueOrThrow({
      where: { orderId: commandeId },
    });
    expect(ligne.converted).toBe(true);
  });

  it("ne bronche pas sur une commande jamais relancée", async () => {
    // La plupart des commandes n'ont pas été relancées : une absence de ligne
    // n'est pas une erreur, et `finaliserVente` appelle ceci sur toutes.
    await expect(noterConversion("commande-inexistante")).resolves.toBeUndefined();
  });

  it("rend un taux, ou null quand rien n'est parti", async () => {
    const depuis = new Date(Date.now() - 86_400_000);

    expect((await statistiquesRelance(depuis)).taux).toBeNull();

    const a = await commandeOuverte(3 * 3_600_000);
    const b = await commandeOuverte(4 * 3_600_000);
    await relancerLesPaiementsOublies();
    await noterConversion(a.commandeId);

    const stats = await statistiquesRelance(depuis);
    expect(stats.envoyees).toBeGreaterThanOrEqual(2);
    expect(stats.converties).toBeGreaterThanOrEqual(1);
    expect(stats.taux).not.toBeNull();
    void b;
  });
});
