/**
 * Lecture sécurisée du certificat de licence (`lireCertificat`).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { acheter } from "@/lib/checkout/achat";
import { db } from "@/lib/db";
import { rembourserLigne } from "@/lib/domain/orders";
import { LICENCE_PAR_DEFAUT } from "@/lib/licences/conditions";
import { lireCertificat } from "@/lib/licences/certificat-lecture";

const AVANT = process.env.CHECKOUT_SIMULATION_ENABLED;
beforeEach(() => {
  process.env.CHECKOUT_SIMULATION_ENABLED = "1";
});
afterEach(() => {
  if (AVANT === undefined) delete process.env.CHECKOUT_SIMULATION_ENABLED;
  else process.env.CHECKOUT_SIMULATION_ENABLED = AVANT;
});

let n = 0;
async function creerAchatPaye(opts?: { avecCle?: boolean; licenseCode?: "PERSONAL" | "COMMERCIAL" | "EXTENDED" }) {
  n += 1;
  const s = `${n}-${Math.random().toString(36).slice(2, 7)}`;
  const vendeur = await db.user.create({
    data: {
      email: `cert-v-${s}@baobart.test`,
      profile: { create: { username: `cert-v-${s}`, displayName: `Atelier ${s}` } },
    },
    select: { id: true },
  });
  const acheteur = await db.user.create({
    data: {
      email: `cert-a-${s}@baobart.test`,
      profile: { create: { username: `cert-a-${s}`, displayName: `Client ${s}` } },
    },
    select: { id: true },
  });
  const licenseType = opts?.licenseCode
    ? await db.licenseType.findUnique({ where: { code: opts.licenseCode }, select: { id: true, title: true } })
    : null;

  const produit = await db.product.create({
    data: {
      sellerId: vendeur.id,
      name: `Pack Icônes ${s}`,
      slug: `pack-icones-${s}`,
      price: 5_000,
      currency: "XOF",
      status: "PUBLISHED",
      licenseTypeId: licenseType?.id ?? null,
    },
    select: { id: true, name: true, slug: true },
  });
  const media = await db.mediaAsset.create({
    data: {
      ownerId: vendeur.id,
      purpose: "product",
      s3Key: `produits/${produit.id}/pack.zip`,
      checksum: "x",
      contentType: "application/zip",
      sizeBytes: 2048,
      status: "READY",
    },
    select: { id: true },
  });
  await db.productFile.create({
    data: { productId: produit.id, mediaId: media.id, filename: "pack.zip", sizeBytes: 2048, role: "SOURCE", position: 0 },
  });

  const r = await acheter({ produitId: produit.id, acheteurId: acheteur.id });
  expect(r.ok).toBe(true);
  const ligne = await db.orderItem.findFirstOrThrow({
    where: { productId: produit.id, order: { buyerId: acheteur.id } },
    select: {
      id: true,
      orderId: true,
      licenseKey: { select: { id: true, serial: true } },
    },
  });

  if (opts?.avecCle === false && ligne.licenseKey) {
    await db.licenseKey.delete({ where: { id: ligne.licenseKey.id } });
  }

  return { s, vendeur, acheteur, produit, ligne };
}

describe("lireCertificat", () => {
  it("permet à l'acheteur de lire le certificat complet de sa ligne d'achat", async () => {
    const { s, acheteur, produit, ligne } = await creerAchatPaye({ avecCle: false });
    const cert = await lireCertificat(ligne.id, acheteur.id);
    expect(cert).not.toBeNull();
    expect(cert).toMatchObject({
      statut: "VALIDE",
      motifsRevocation: [],
      acheteur: { nom: `Client ${s}`, email: `cert-a-${s}@baobart.test` },
      vendeur: { nom: `Atelier ${s}`, username: `cert-v-${s}` },
      ressource: { id: produit.id, slug: produit.slug, titre: produit.name },
      licence: { titre: LICENCE_PAR_DEFAUT },
      cle: null,
    });
    expect(cert?.numero).toMatch(/^LC-\d{4}-[A-Z0-9]{8}$/);
    expect(cert?.licence.permises.length).toBeGreaterThan(0);
  });

  it("retourne null si la ligne appartient à un autre compte ou n'existe pas", async () => {
    const { ligne } = await creerAchatPaye();
    const autre = await db.user.create({
      data: { email: `cert-tiers-${Math.random().toString(36).slice(2)}@baobart.test` },
      select: { id: true },
    });

    expect(await lireCertificat(ligne.id, autre.id)).toBeNull();
    expect(await lireCertificat("cm000inexistant0000000000", autre.id)).toBeNull();
  });

  it("retourne null tant que l'achat n'est pas abouti", async () => {
    const { acheteur, ligne } = await creerAchatPaye();
    await db.orderItem.update({ where: { id: ligne.id }, data: { state: "IN_PROGRESS" } });
    expect(await lireCertificat(ligne.id, acheteur.id)).toBeNull();
    await db.orderItem.update({ where: { id: ligne.id }, data: { state: "FAILED" } });
    expect(await lireCertificat(ligne.id, acheteur.id)).toBeNull();
  });

  // Par le vrai remboursement (`rembourserLigne`), pas en posant
  // `refundedAmount` à la main : c'est le chemin que prend l'application.
  it("affiche REVOQUE et le motif exact sur une ligne intégralement remboursée", async () => {
    const { acheteur, ligne } = await creerAchatPaye();
    await rembourserLigne({ orderItemId: ligne.id, amount: 5_000 });

    const cert = await lireCertificat(ligne.id, acheteur.id);
    expect(cert).not.toBeNull();
    expect(cert?.statut).toBe("REVOQUE");
    expect(cert?.motifsRevocation).toEqual(["remboursé"]);
  });

  it("reste VALIDE après un remboursement partiel : les droits demeurent", async () => {
    const { acheteur, ligne } = await creerAchatPaye();
    await rembourserLigne({ orderItemId: ligne.id, amount: 2_000 });

    const cert = await lireCertificat(ligne.id, acheteur.id);
    expect(cert?.statut).toBe("VALIDE");
    expect(cert?.motifsRevocation).toEqual([]);
    // « Montant réglé » : ce qui a été payé à l'achat (`encaisseDe`), pas le net.
    expect(cert?.montant).toBe(5_000);
  });

  it("affiche la clé d'activation quand un LicenseKey existe", async () => {
    const { acheteur, ligne } = await creerAchatPaye({ avecCle: true });
    expect(ligne.licenseKey).not.toBeNull();

    const cert = await lireCertificat(ligne.id, acheteur.id);
    expect(cert).not.toBeNull();
    expect(cert?.cle).toEqual({
      serial: ligne.licenseKey!.serial,
      status: "ACTIVE",
    });
  });
});
