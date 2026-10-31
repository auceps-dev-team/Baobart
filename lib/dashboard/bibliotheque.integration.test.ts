/**
 * « Ma bibliothèque », contre une vraie base.
 *
 * Ce qu'on éprouve : un achat jamais ouvert y figure, en tête — c'est tout
 * l'objet de l'écran (audit du 31/10, Q2-3) ; ce qui a été remboursé en
 * entier n'y figure plus ; les achats d'un autre n'y figurent jamais.
 */

import { describe, expect, it } from "vitest";

import { bibliothequeDe } from "@/lib/dashboard/bibliotheque";
import { db } from "@/lib/db";
import { encaisserLigne } from "@/lib/domain/orders";

let n = 0;

async function compte(prefixe: string) {
  n += 1;
  const marque = `${prefixe}-${n}-${Math.random().toString(36).slice(2, 7)}`;
  return db.user.create({
    data: { email: `${marque}@baobart.test`, profile: { create: { username: marque, displayName: `Nom ${marque}` } } },
    select: { id: true },
  });
}

async function ressource(vendeurId: string, nom: string, poids: number) {
  n += 1;
  const slug = `${nom.toLowerCase().replace(/[^a-z]+/g, "-")}-${n}-${Math.random().toString(36).slice(2, 6)}`;
  const produit = await db.product.create({
    data: { sellerId: vendeurId, name: nom, slug, price: 5_000, currency: "XOF", status: "PUBLISHED" },
    select: { id: true },
  });
  const media = await db.mediaAsset.create({
    data: { ownerId: vendeurId, purpose: "product", s3Key: `produits/${produit.id}/f.zip`, checksum: "x", contentType: "application/zip", sizeBytes: poids, status: "READY" },
    select: { id: true },
  });
  const fichier = await db.productFile.create({
    data: { productId: produit.id, mediaId: media.id, filename: `${slug}.png`, sizeBytes: poids, role: "SOURCE", position: 0 },
    select: { id: true },
  });
  return { produitId: produit.id, fichierId: fichier.id };
}

async function acheter(acheteurId: string, produitId: string, quand: Date) {
  const commande = await db.order.create({
    data: { buyerId: acheteurId, total: 5_000, currency: "XOF", createdAt: quand, items: { create: { productId: produitId, quantity: 1, price: 5_000, createdAt: quand } } },
    select: { items: { select: { id: true } } },
  });
  const ligneId = commande.items[0]!.id;
  await encaisserLigne({ orderItemId: ligneId });
  return ligneId;
}

describe("la bibliothèque de l'acheteur", () => {
  it("montre un achat jamais ouvert, en tête, et les chiffres qui vont avec", async () => {
    const vendeur = await compte("vendeur-bib");
    const acheteur = await compte("acheteur-bib");
    const retiree = await ressource(vendeur.id, "Police Sahel", 3 * 1024 * 1024);
    const neuve = await ressource(vendeur.id, "Portrait Wax", 128 * 1024 * 1024);

    await acheter(acheteur.id, retiree.produitId, new Date("2026-10-01"));
    await acheter(acheteur.id, neuve.produitId, new Date("2026-09-01"));
    await db.consumptionEvent.createMany({
      data: [1, 2].map(() => ({ userId: acheteur.id, productId: retiree.produitId, productFileId: retiree.fichierId, eventType: "DOWNLOAD" as const })),
    });

    const b = await bibliothequeDe(acheteur.id);

    // Achetée plus tôt, mais jamais retirée : elle passe devant.
    expect(b.ressources.map((r) => r.titre)).toEqual(["Portrait Wax", "Police Sahel"]);
    expect(b.ressources[0]).toMatchObject({ retraits: 0, dernierRetrait: null, fichiers: [{ id: neuve.fichierId }] });
    expect(b.ressources[1]).toMatchObject({ retraits: 2 });
    expect(b.jamaisRetirees).toBe(1);
    expect(b.octets).toBe(131 * 1024 * 1024);
    expect(b.commerciales).toBe(2);
    // Le nom public du vendeur, jamais son adresse.
    expect(b.ressources[0]!.auteur).toMatch(/^Nom vendeur-bib/);
  });

  it("retire ce qui a été remboursé en entier, garde ce qui l'a été en partie", async () => {
    const vendeur = await compte("vendeur-remb");
    const acheteur = await compte("acheteur-remb");
    const entiere = await ressource(vendeur.id, "Rendue entiere", 1024);
    const partielle = await ressource(vendeur.id, "Rendue en partie", 1024);

    const l1 = await acheter(acheteur.id, entiere.produitId, new Date());
    const l2 = await acheter(acheteur.id, partielle.produitId, new Date());
    await db.orderItem.update({ where: { id: l1 }, data: { refundedAmount: 5_000 } });
    await db.orderItem.update({ where: { id: l2 }, data: { refundedAmount: 1_000 } });

    const b = await bibliothequeDe(acheteur.id);

    expect(b.ressources.map((r) => r.titre)).toEqual(["Rendue en partie"]);
  });

  it("ne montre jamais les achats d'un autre", async () => {
    const vendeur = await compte("vendeur-autre");
    const acheteur = await compte("acheteur-autre");
    const curieux = await compte("curieux");
    const r = await ressource(vendeur.id, "Pas a toi", 1024);
    await acheter(acheteur.id, r.produitId, new Date());

    const b = await bibliothequeDe(curieux.id);

    expect(b.ressources).toEqual([]);
    expect(b.jamaisRetirees).toBe(0);
  });
});
