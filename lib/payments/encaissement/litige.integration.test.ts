/**
 * Une contestation bancaire, du rappel de l'opérateur jusqu'au grand livre.
 *
 * Audit du 31/10/2026 (Q2-5) : `lib/domain/litiges.ts` était écrit et testé,
 * et rien ne l'appelait — la banque reprenait l'argent, le vendeur gardait son
 * solde. On passe ici par `recevoir`, le point d'entrée des rappels, sur une
 * vente encaissée par le vrai tunnel (bac à sable).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { acheter } from "@/lib/checkout/achat";
import { db } from "@/lib/db";
import type { FaitPaiement, IssueLitige } from "@/lib/payments/encaissement/contrat";
import { recevoir } from "@/lib/payments/encaissement/reception";

const PRIX = 5_000;
const AVANT = { ...process.env };

beforeEach(() => {
  delete process.env.CHECKOUT_SIMULATION_ENABLED;
  process.env.PAYMENTS_DRIVER = "bac-a-sable";
  process.env.PAYMENTS_SANDBOX_SECRET = "un-secret-de-bac-a-sable-assez-long";
  process.env.APP_URL = "https://baobart.test";
});

afterEach(() => {
  process.env = { ...AVANT };
});

let n = 0;

async function compte(role: string) {
  n += 1;
  const marque = `${role}-lit-${n}-${Math.random().toString(36).slice(2, 7)}`;
  return db.user.create({
    data: { email: `${marque}@baobart.test`, profile: { create: { username: marque, displayName: marque } } },
    select: { id: true },
  });
}

/** Une vente ouverte par le vrai tunnel, puis encaissée par un rappel. */
async function venteEncaissee() {
  const vendeur = await compte("vendeur");
  const acheteur = await compte("acheteur");
  n += 1;
  const produit = await db.product.create({
    data: { sellerId: vendeur.id, name: `R lit ${n}`, slug: `r-lit-${n}-${Math.random().toString(36).slice(2, 6)}`, price: PRIX, currency: "XOF", status: "PUBLISHED" },
    select: { id: true },
  });
  const media = await db.mediaAsset.create({
    data: { ownerId: vendeur.id, purpose: "product", s3Key: `produits/${produit.id}/f.zip`, checksum: "x", contentType: "application/zip", sizeBytes: 1024, status: "READY" },
    select: { id: true },
  });
  await db.productFile.create({ data: { productId: produit.id, mediaId: media.id, filename: "f.zip", sizeBytes: 1024, role: "SOURCE", position: 0 } });

  const ouverture = await acheter({ produitId: produit.id, acheteurId: acheteur.id });
  if (!ouverture.ok) throw new Error(`ouverture refusée : ${ouverture.motif}`);
  const encaissement = await recevoir(
    "bac-a-sable",
    { sens: "ENCAISSEMENT", evenement: `evt-enc-${n}`, reference: ouverture.orderId, referenceOperateur: `op-${n}`, issue: "REUSSI", montant: PRIX, devise: "XOF" },
    {},
  );
  if (!encaissement.recu || encaissement.effet !== "ENCAISSE") throw new Error("encaissement refusé");

  return { vendeurId: vendeur.id, orderId: ouverture.orderId, orderItemId: ouverture.orderItemId };
}

let e = 0;
function litige(reference: string, issue: IssueLitige, patch: Partial<FaitPaiement> = {}): FaitPaiement {
  e += 1;
  return { sens: "LITIGE", issue: "EN_COURS", litige: issue, evenement: `charge.dispute.${issue}:${e}`, reference, referenceOperateur: `dsp-${e}`, montant: null, devise: "XOF", ...patch };
}

async function solde(userId: string) {
  const lignes = await db.balanceTransaction.findMany({ where: { userId }, select: { holdingNet: true } });
  return lignes.reduce((s, l) => s + l.holdingNet, 0);
}

describe("une contestation bancaire", () => {
  it("débite le vendeur et suspend ses versements à l'ouverture", async () => {
    const { vendeurId, orderId, orderItemId } = await venteEncaissee();
    const avant = await solde(vendeurId);

    const r = await recevoir("paystack", litige(orderId, "OUVERT"), {});

    expect(r).toEqual({ recu: true, effet: "LITIGE_OUVERT" });
    expect(await solde(vendeurId)).toBe(avant - PRIX);
    expect((await db.orderItem.findUniqueOrThrow({ where: { id: orderItemId } })).chargebackAt).not.toBeNull();
    expect((await db.user.findUniqueOrThrow({ where: { id: vendeurId } })).payoutsPausedAt).not.toBeNull();
  });

  it("ne débite pas deux fois sur un rappel rejoué", async () => {
    const { vendeurId, orderId } = await venteEncaissee();
    const avant = await solde(vendeurId);
    const fait = litige(orderId, "OUVERT");

    await recevoir("paystack", fait, {});
    const rejeu = await recevoir("paystack", fait, {});

    expect(rejeu).toMatchObject({ recu: false, motif: "REJEU" });
    expect(await solde(vendeurId)).toBe(avant - PRIX);
  });

  it("rend l'argent au vendeur quand la contestation est tranchée pour lui", async () => {
    const { vendeurId, orderId, orderItemId } = await venteEncaissee();
    const avant = await solde(vendeurId);

    await recevoir("paystack", litige(orderId, "OUVERT"), {});
    const r = await recevoir("paystack", litige(orderId, "TRANCHE_VENDEUR"), {});

    expect(r).toEqual({ recu: true, effet: "LITIGE_GAGNE" });
    expect(await solde(vendeurId)).toBe(avant);
    expect((await db.orderItem.findUniqueOrThrow({ where: { id: orderItemId } })).chargebackReversedAt).not.toBeNull();
  });

  it("enregistre la perte même si l'ouverture n'a jamais été reçue", async () => {
    const { vendeurId, orderId, orderItemId } = await venteEncaissee();
    const avant = await solde(vendeurId);

    const r = await recevoir("paystack", litige(orderId, "TRANCHE_ACHETEUR"), {});

    expect(r).toEqual({ recu: true, effet: "LITIGE_PERDU" });
    expect(await solde(vendeurId)).toBe(avant - PRIX);
    expect((await db.orderItem.findUniqueOrThrow({ where: { id: orderItemId } })).chargebackAt).not.toBeNull();
  });

  it("ne fait rien d'un simple rappel", async () => {
    const { vendeurId, orderId } = await venteEncaissee();
    const avant = await solde(vendeurId);

    expect(await recevoir("paystack", litige(orderId, "SUIVI"), {})).toEqual({ recu: true, effet: "SANS_EFFET" });
    expect(await solde(vendeurId)).toBe(avant);
  });

  it("refuse une référence inconnue, et laisse un renouvellement à la main", async () => {
    expect(await recevoir("paystack", litige("commande-qui-n-existe-pas", "OUVERT"), {})).toMatchObject({
      recu: false,
      motif: "COMMANDE_INTROUVABLE",
    });
    expect(await recevoir("paystack", litige("abo-paiement-quelconque", "OUVERT"), {})).toEqual({ recu: true, effet: "SANS_EFFET" });
  });
});
