/**
 * La vérification d'une clé de licence, sur un vrai achat simulé.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/licences/verifier/route";
import { acheter } from "@/lib/checkout/achat";
import { db } from "@/lib/db";
import { verifierLicence } from "@/lib/licences/verification";
import { droitDeTelecharger } from "@/lib/products/queries";

const AVANT = process.env.CHECKOUT_SIMULATION_ENABLED;
beforeEach(() => {
  process.env.CHECKOUT_SIMULATION_ENABLED = "1";
});
afterEach(() => {
  if (AVANT === undefined) delete process.env.CHECKOUT_SIMULATION_ENABLED;
  else process.env.CHECKOUT_SIMULATION_ENABLED = AVANT;
});

let n = 0;
async function achatPaye() {
  n += 1;
  const s = `${n}-${Math.random().toString(36).slice(2, 7)}`;
  const vendeur = await db.user.create({ data: { email: `lic-v-${s}@baobart.test`, profile: { create: { username: `lic-v-${s}`, displayName: "V" } } }, select: { id: true } });
  const acheteur = await db.user.create({ data: { email: `lic-a-${s}@baobart.test`, profile: { create: { username: `lic-a-${s}`, displayName: "A" } } }, select: { id: true } });
  const produit = await db.product.create({
    data: { sellerId: vendeur.id, name: `Police ${s}`, slug: `police-${s}`, price: 3_000, currency: "XOF", status: "PUBLISHED" },
    select: { id: true },
  });
  const media = await db.mediaAsset.create({
    data: { ownerId: vendeur.id, purpose: "product", s3Key: `produits/${produit.id}/f.zip`, checksum: "x", contentType: "application/zip", sizeBytes: 1024, status: "READY" },
    select: { id: true },
  });
  await db.productFile.create({ data: { productId: produit.id, mediaId: media.id, filename: "f.zip", sizeBytes: 1024, role: "SOURCE", position: 0 } });
  const r = await acheter({ produitId: produit.id, acheteurId: acheteur.id });
  expect(r.ok).toBe(true);
  const cle = await db.licenseKey.findFirstOrThrow({ where: { productId: produit.id }, select: { serial: true } });
  return { produit, acheteur, cle: cle.serial };
}

describe("une clé de licence", () => {
  it("se montre enfin à son acheteur, sur la fiche", async () => {
    // Créée à chaque vente, elle n'était affichée nulle part (relevé le 04/10).
    const { produit, acheteur, cle } = await achatPaye();
    const droit = await droitDeTelecharger(produit.id, acheteur.id);
    // Sans licence choisie, la même que celle écrite à côté du prix.
    expect(droit).toMatchObject({ etat: "TELECHARGEABLE", licence: { cle, type: "Licence commerciale" } });
  });

  it("se vérifie, compte ses utilisations, et ne dit rien de son acheteur", async () => {
    const { produit, cle } = await achatPaye();
    const premiere = await verifierLicence({ produitId: produit.id, cle, incrementer: true });
    expect(premiere).toMatchObject({ ok: true, utilisations: 1, achat: { produitId: produit.id, rembourse: false, conteste: false } });
    expect(JSON.stringify(premiere)).not.toMatch(/@baobart\.test/);

    expect(await verifierLicence({ produitId: produit.id, cle: cle.toLowerCase(), incrementer: false })).toMatchObject({ ok: true, utilisations: 1 });
    expect(await verifierLicence({ produitId: produit.id, cle, incrementer: true })).toMatchObject({ ok: true, utilisations: 2 });
  });

  it("ne vaut pas pour une autre ressource, ni désactivée, ni mal formée", async () => {
    const a = await achatPaye();
    const b = await achatPaye();
    expect(await verifierLicence({ produitId: b.produit.id, cle: a.cle, incrementer: true })).toEqual({ ok: false, motif: "INCONNUE" });
    expect(await verifierLicence({ produitId: a.produit.id, cle: "PAS-UNE-CLE", incrementer: true })).toEqual({ ok: false, motif: "INCONNUE" });

    await db.licenseKey.update({ where: { serial: a.cle }, data: { status: "DISABLED", disabledAt: new Date() } });
    expect(await verifierLicence({ produitId: a.produit.id, cle: a.cle, incrementer: true })).toEqual({ ok: false, motif: "DESACTIVEE" });
  });

  it("ne vaut rien tant que l'achat n'est pas payé", async () => {
    // La clé naît avec la commande, avant le paiement : sans cette garde, un
    // paiement abandonné laisserait une clé valide.
    const { produit, cle } = await achatPaye();
    const ligne = await db.licenseKey.findUniqueOrThrow({ where: { serial: cle }, select: { orderItemId: true } });
    for (const state of ["IN_PROGRESS", "FAILED"] as const) {
      await db.orderItem.update({ where: { id: ligne.orderItemId }, data: { state } });
      expect(await verifierLicence({ produitId: produit.id, cle, incrementer: true })).toEqual({ ok: false, motif: "INCONNUE" });
    }
    const compte = await db.licenseKey.findUniqueOrThrow({ where: { serial: cle }, select: { usesCount: true } });
    expect(compte.usesCount).toBe(0);
  });

  it("répond par la route : 200 en formulaire, 404 sinon", async () => {
    const { produit, cle } = await achatPaye();
    const appel = (corps: Record<string, string>) =>
      POST(new Request("http://localhost/api/licences/verifier", { method: "POST", body: new URLSearchParams(corps) }));

    const ok = await appel({ produit: produit.id, cle });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ succes: true, utilisations: 1 });

    expect((await appel({ produit: produit.id, cle: "AAAAAAAA-AAAAAAAA-AAAAAAAA-AAAAAAAA" })).status).toBe(404);
    expect((await appel({ cle })).status).toBe(400);
  });
});
