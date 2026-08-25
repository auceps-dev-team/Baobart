/**
 * L'achat, contre une vraie base.
 *
 * C'est du code qui touche à l'argent : ce qui est écrit ici doit l'être une
 * fois et une seule, et le solde du créateur doit correspondre au centime près
 * à ce que l'acheteur a payé, frais déduits.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { acheter } from "@/lib/checkout/achat";
import { licenceBienFormee } from "@/lib/checkout/licence";
import { db } from "@/lib/db";
import { computeFees } from "@/lib/domain/fees";

const AVANT = process.env.CHECKOUT_SIMULATION_ENABLED;

beforeEach(() => {
  process.env.CHECKOUT_SIMULATION_ENABLED = "1";
});

afterEach(() => {
  if (AVANT === undefined) delete process.env.CHECKOUT_SIMULATION_ENABLED;
  else process.env.CHECKOUT_SIMULATION_ENABLED = AVANT;
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

async function creerProduit(input: {
  vendeurId: string;
  prix: number;
  publie?: boolean;
  avecFichier?: boolean;
}) {
  n += 1;
  const produit = await db.product.create({
    data: {
      sellerId: input.vendeurId,
      name: `Ressource ${n}`,
      slug: `ressource-${n}`,
      price: input.prix,
      currency: "XOF",
      status: input.publie === false ? "DRAFT" : "PUBLISHED",
    },
    select: { id: true },
  });

  if (input.avecFichier !== false) {
    const media = await db.mediaAsset.create({
      data: {
        ownerId: input.vendeurId,
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
  }

  return produit;
}

describe("achat simulé", () => {
  it("inscrit une commande, une ligne et une licence", async () => {
    const vendeur = await creerUtilisateur("vendeur");
    const acheteur = await creerUtilisateur("acheteur");
    const produit = await creerProduit({ vendeurId: vendeur.id, prix: 5000 });

    const r = await acheter({ produitId: produit.id, acheteurId: acheteur.id });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(licenceBienFormee(r.licence)).toBe(true);

    const commande = await db.order.findUniqueOrThrow({
      where: { id: r.orderId },
      include: { items: { include: { licenseKey: true } } },
    });
    expect(commande.status).toBe("COMPLETED");
    expect(commande.total).toBe(5000);
    expect(commande.items).toHaveLength(1);
    expect(commande.items[0]?.state).toBe("SUCCESSFUL");
    expect(commande.items[0]?.licenseKey?.serial).toBe(r.licence);
  });

  it("marque la commande comme simulée", async () => {
    // Le jour où des versements réels partiront, il faudra distinguer les
    // ventes qui ont apporté de l'argent de celles qui n'en ont pas apporté.
    const vendeur = await creerUtilisateur("vendeur");
    const acheteur = await creerUtilisateur("acheteur");
    const produit = await creerProduit({ vendeurId: vendeur.id, prix: 3000 });

    const r = await acheter({ produitId: produit.id, acheteurId: acheteur.id });
    if (!r.ok) throw new Error("achat refusé");

    const commande = await db.order.findUniqueOrThrow({ where: { id: r.orderId } });
    expect(commande.provider).toBe("simulation");
  });

  it("fige le prix : un changement de tarif ne réécrit pas la vente", async () => {
    const vendeur = await creerUtilisateur("vendeur");
    const acheteur = await creerUtilisateur("acheteur");
    const produit = await creerProduit({ vendeurId: vendeur.id, prix: 5000 });

    const r = await acheter({ produitId: produit.id, acheteurId: acheteur.id });
    if (!r.ok) throw new Error("achat refusé");

    await db.product.update({ where: { id: produit.id }, data: { price: 99_000 } });

    const ligne = await db.orderItem.findUniqueOrThrow({
      where: { id: r.orderItemId },
    });
    expect(ligne.price).toBe(5000);
  });
});

describe("l'argent", () => {
  it("crédite le créateur du net, au centime près", async () => {
    const vendeur = await creerUtilisateur("vendeur");
    const acheteur = await creerUtilisateur("acheteur");
    const produit = await creerProduit({ vendeurId: vendeur.id, prix: 10_000 });

    const r = await acheter({ produitId: produit.id, acheteurId: acheteur.id });
    if (!r.ok) throw new Error("achat refusé");

    const attendu = computeFees({
      unitPrice: 10_000,
      quantity: 1,
      regime: "DIRECT",
    });

    const mouvements = await db.balanceTransaction.findMany({
      where: { userId: vendeur.id },
    });
    expect(mouvements).toHaveLength(1);
    expect(mouvements[0]?.type).toBe("SALE");
    expect(mouvements[0]?.holdingNet).toBe(attendu.sellerNet);
  });

  it("fige les frais sur la ligne", async () => {
    const vendeur = await creerUtilisateur("vendeur");
    const acheteur = await creerUtilisateur("acheteur");
    const produit = await creerProduit({ vendeurId: vendeur.id, prix: 10_000 });

    const r = await acheter({ produitId: produit.id, acheteurId: acheteur.id });
    if (!r.ok) throw new Error("achat refusé");

    const ligne = await db.orderItem.findUniqueOrThrow({
      where: { id: r.orderItemId },
    });
    const attendu = computeFees({ unitPrice: 10_000, quantity: 1, regime: "DIRECT" });
    expect(ligne.platformFee).toBe(attendu.platformFee);
    expect(ligne.processorFee).toBe(attendu.processorFee);
  });

  it("dépose un reçu dans la file, une seule fois", async () => {
    const vendeur = await creerUtilisateur("vendeur");
    const acheteur = await creerUtilisateur("acheteur");
    const produit = await creerProduit({ vendeurId: vendeur.id, prix: 4500 });

    const r = await acheter({ produitId: produit.id, acheteurId: acheteur.id });
    if (!r.ok) throw new Error("achat refusé");

    const recus = await db.emailOutbox.findMany({
      where: { template: "RECU_ACHAT" },
    });
    expect(recus).toHaveLength(1);
    expect(recus[0]?.recipient).toBe(acheteur.email);
    expect(recus[0]?.idempotencyKey).toBe(`recu-${r.orderItemId}`);
  });
});

describe("refus", () => {
  it("refuse quand la simulation est fermée", async () => {
    process.env.CHECKOUT_SIMULATION_ENABLED = "";
    const vendeur = await creerUtilisateur("vendeur");
    const acheteur = await creerUtilisateur("acheteur");
    const produit = await creerProduit({ vendeurId: vendeur.id, prix: 5000 });

    const r = await acheter({ produitId: produit.id, acheteurId: acheteur.id });
    expect(r).toEqual({ ok: false, motif: "PAIEMENT_INDISPONIBLE" });
    expect(await db.order.count()).toBe(0);
  });

  it("refuse sa propre ressource", async () => {
    // Sinon un créateur ferait tourner ses propres ventes pour gonfler ses
    // compteurs, et se créditerait le net de son propre argent.
    const vendeur = await creerUtilisateur("vendeur");
    const produit = await creerProduit({ vendeurId: vendeur.id, prix: 5000 });

    const r = await acheter({ produitId: produit.id, acheteurId: vendeur.id });
    expect(r).toEqual({ ok: false, motif: "SA_PROPRE_RESSOURCE" });
  });

  it("refuse une ressource offerte", async () => {
    const vendeur = await creerUtilisateur("vendeur");
    const acheteur = await creerUtilisateur("acheteur");
    const produit = await creerProduit({ vendeurId: vendeur.id, prix: 0 });

    const r = await acheter({ produitId: produit.id, acheteurId: acheteur.id });
    expect(r).toEqual({ ok: false, motif: "GRATUITE" });
    expect(await db.order.count()).toBe(0);
  });

  it("refuse une ressource sans fichier", async () => {
    // L'acheteur paierait sans rien recevoir.
    const vendeur = await creerUtilisateur("vendeur");
    const acheteur = await creerUtilisateur("acheteur");
    const produit = await creerProduit({
      vendeurId: vendeur.id,
      prix: 5000,
      avecFichier: false,
    });

    const r = await acheter({ produitId: produit.id, acheteurId: acheteur.id });
    expect(r).toEqual({ ok: false, motif: "SANS_FICHIER" });
  });

  it("refuse un brouillon", async () => {
    const vendeur = await creerUtilisateur("vendeur");
    const acheteur = await creerUtilisateur("acheteur");
    const produit = await creerProduit({
      vendeurId: vendeur.id,
      prix: 5000,
      publie: false,
    });

    const r = await acheter({ produitId: produit.id, acheteurId: acheteur.id });
    expect(r).toEqual({ ok: false, motif: "INTROUVABLE" });
  });

  it("refuse un second achat de ce qu'on possède déjà", async () => {
    const vendeur = await creerUtilisateur("vendeur");
    const acheteur = await creerUtilisateur("acheteur");
    const produit = await creerProduit({ vendeurId: vendeur.id, prix: 5000 });

    await acheter({ produitId: produit.id, acheteurId: acheteur.id });
    const second = await acheter({ produitId: produit.id, acheteurId: acheteur.id });

    expect(second).toEqual({ ok: false, motif: "DEJA_ACQUISE" });
    expect(await db.order.count()).toBe(1);
  });

  it("rouvre l'achat après un remboursement intégral", async () => {
    const vendeur = await creerUtilisateur("vendeur");
    const acheteur = await creerUtilisateur("acheteur");
    const produit = await creerProduit({ vendeurId: vendeur.id, prix: 5000 });

    const premier = await acheter({ produitId: produit.id, acheteurId: acheteur.id });
    if (!premier.ok) throw new Error("achat refusé");

    await db.orderItem.update({
      where: { id: premier.orderItemId },
      data: { refundedAmount: 5000 },
    });

    const second = await acheter({ produitId: produit.id, acheteurId: acheteur.id });
    expect(second.ok).toBe(true);
  });

  it("rouvre l'achat après un retrait d'accès", async () => {
    const vendeur = await creerUtilisateur("vendeur");
    const acheteur = await creerUtilisateur("acheteur");
    const produit = await creerProduit({ vendeurId: vendeur.id, prix: 5000 });

    const premier = await acheter({ produitId: produit.id, acheteurId: acheteur.id });
    if (!premier.ok) throw new Error("achat refusé");

    await db.orderItem.update({
      where: { id: premier.orderItemId },
      data: { accessRevokedAt: new Date() },
    });

    expect((await acheter({ produitId: produit.id, acheteurId: acheteur.id })).ok).toBe(
      true,
    );
  });
});

describe("deux clics en même temps", () => {
  it("n'inscrit qu'une seule commande", async () => {
    const vendeur = await creerUtilisateur("vendeur");
    const acheteur = await creerUtilisateur("acheteur");
    const produit = await creerProduit({ vendeurId: vendeur.id, prix: 7000 });

    const [a, b] = await Promise.all([
      acheter({ produitId: produit.id, acheteurId: acheteur.id }),
      acheter({ produitId: produit.id, acheteurId: acheteur.id }),
    ]);

    const reussis = [a, b].filter((r) => r.ok);
    expect(reussis).toHaveLength(1);
    expect(await db.order.count()).toBe(1);

    // Et surtout : le créateur n'est crédité qu'une fois.
    const mouvements = await db.balanceTransaction.count({
      where: { userId: vendeur.id },
    });
    expect(mouvements).toBe(1);
  });
});
