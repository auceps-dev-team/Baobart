import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { autoriserTelechargement } from "@/lib/domain/downloads";
import { droitDeTelecharger, obtenirProduit } from "@/lib/products/queries";
import { retirerFichierDe } from "@/lib/upload/service";

/**
 * Le retrait d'un fichier, confronté à la base.
 *
 * Le point sensible : ce geste peut détruire ce que des gens ont payé. Un test
 * qui ne vérifierait que « la ligne a disparu » manquerait l'essentiel.
 */

let vendeur: string;
let acheteur: string;

async function compte(email: string): Promise<string> {
  const u = await db.user.create({
    data: { email, defaultCurrency: "XOF" },
    select: { id: true },
  });
  return u.id;
}

async function ressourceAvecFichier(prix = 8_000) {
  const p = await db.product.create({
    data: {
      sellerId: vendeur,
      slug: `up-${Math.random().toString(36).slice(2, 9)}`,
      name: "Pack motifs",
      price: prix,
      currency: "XOF",
      status: "PUBLISHED",
    },
    select: { id: true },
  });

  const media = await db.mediaAsset.create({
    data: {
      ownerId: vendeur,
      purpose: "product",
      s3Key: `produits/${p.id}/pack.zip`,
      checksum: "x",
      sizeBytes: 2048,
      contentType: "application/zip",
      status: "READY",
    },
    select: { id: true },
  });

  const f = await db.productFile.create({
    data: {
      productId: p.id,
      mediaId: media.id,
      filename: "pack-motifs.zip",
      sizeBytes: 2048,
    },
    select: { id: true },
  });

  return { produitId: p.id, fichierId: f.id, mediaId: media.id };
}

async function vendre(produitId: string, prix: number) {
  const o = await db.order.create({
    data: {
      buyerId: acheteur,
      currency: "XOF",
      total: prix,
      status: "COMPLETED",
      items: {
        create: { productId: produitId, price: prix, quantity: 1, state: "SUCCESSFUL" },
      },
    },
    select: { id: true },
  });
  return o.id;
}

beforeEach(async () => {
  vendeur = await compte("kofi@up.test");
  acheteur = await compte("ama@up.test");
});

describe("retrait d'un fichier", () => {
  it("efface pour de bon quand rien n'a été vendu", async () => {
    const { produitId, fichierId, mediaId } = await ressourceAvecFichier();

    const r = await retirerFichierDe({ userId: vendeur, produitId, fichierId });
    expect(r).toMatchObject({ ok: true, efface: true });

    // Un brouillon raté ne doit pas encombrer le stockage indéfiniment.
    expect(await db.productFile.count({ where: { productId: produitId } })).toBe(0);
    expect(await db.mediaAsset.count({ where: { id: mediaId } })).toBe(0);
  });

  it("garde la ligne et les octets quand la ressource a été vendue", async () => {
    // Le défaut corrigé : un clic détruisait définitivement ce que des gens
    // avaient payé, sans recours possible.
    const { produitId, fichierId, mediaId } = await ressourceAvecFichier();
    await vendre(produitId, 8_000);

    const r = await retirerFichierDe({ userId: vendeur, produitId, fichierId });
    expect(r).toMatchObject({ ok: true, efface: false });

    const ligne = await db.productFile.findUniqueOrThrow({ where: { id: fichierId } });
    expect(ligne.deletedAt).not.toBeNull();
    // Le média reste : les octets sont récupérables.
    expect(await db.mediaAsset.count({ where: { id: mediaId } })).toBe(1);
  });

  it("cesse de servir le fichier retiré, même à qui l'a acheté", async () => {
    const { produitId, fichierId } = await ressourceAvecFichier();
    await vendre(produitId, 8_000);

    const avant = await autoriserTelechargement({
      userId: acheteur,
      productFileId: fichierId,
    });
    expect(avant.decision.autorise).toBe(true);

    await retirerFichierDe({ userId: vendeur, produitId, fichierId });

    const apres = await autoriserTelechargement({
      userId: acheteur,
      productFileId: fichierId,
    });
    expect(apres.decision.autorise).toBe(false);
  });

  it("disparaît de la fiche publique et du bouton de retrait", async () => {
    const { produitId, fichierId } = await ressourceAvecFichier();
    await vendre(produitId, 8_000);

    const p = await db.product.findUniqueOrThrow({ where: { id: produitId } });
    expect((await obtenirProduit(p.slug))?.fichier).not.toBeNull();
    expect(await droitDeTelecharger(produitId, acheteur)).toMatchObject({
      etat: "TELECHARGEABLE",
    });

    await retirerFichierDe({ userId: vendeur, produitId, fichierId });

    expect((await obtenirProduit(p.slug))?.fichier).toBeNull();
    expect(await droitDeTelecharger(produitId, acheteur)).toMatchObject({
      etat: "A_ACHETER",
    });
  });

  it("refuse à quelqu'un qui n'est pas le créateur", async () => {
    const { produitId, fichierId } = await ressourceAvecFichier();
    const intrus = await compte("intrus@up.test");

    const r = await retirerFichierDe({ userId: intrus, produitId, fichierId });
    expect(r).toMatchObject({ ok: false });
    expect(await db.productFile.count({ where: { deletedAt: null } })).toBe(1);
  });

  it("refuse un fichier qui appartient à une autre ressource", async () => {
    const a = await ressourceAvecFichier();
    const b = await ressourceAvecFichier();

    const r = await retirerFichierDe({
      userId: vendeur,
      produitId: a.produitId,
      fichierId: b.fichierId,
    });
    expect(r).toMatchObject({ ok: false });
    expect(await db.productFile.count({ where: { deletedAt: null } })).toBe(2);
  });

  it("ne retire pas deux fois le même fichier", async () => {
    const { produitId, fichierId } = await ressourceAvecFichier();
    await vendre(produitId, 8_000);

    expect(await retirerFichierDe({ userId: vendeur, produitId, fichierId })).toMatchObject({ ok: true });
    // Le second appel ne doit pas prétendre avoir agi.
    expect(await retirerFichierDe({ userId: vendeur, produitId, fichierId })).toMatchObject({ ok: false });
  });

  it("efface la couverture quand son fichier part, et reprend la suivante", async () => {
    const { produitId, fichierId, mediaId } = await ressourceAvecFichier();

    // Le média porte des dimensions : c'est ce qui en fait une couverture
    // candidate.
    await db.mediaAsset.update({
      where: { id: mediaId },
      data: { width: 1200, height: 800 },
    });
    await db.product.update({
      where: { id: produitId },
      data: {
        coverUrl: `http://localhost:9000/baobart-media/public/apercus/${mediaId}.webp`,
        coverImageId: mediaId,
      },
    });

    await retirerFichierDe({ userId: vendeur, produitId, fichierId });

    const relu = await db.product.findUniqueOrThrow({ where: { id: produitId } });
    expect(relu.coverUrl).toBeNull();
    expect(relu.coverImageId).toBeNull();
  });
});

describe("publication et fichiers retirés", () => {
  it("un fichier retiré ne compte pas comme fichier attaché", async () => {
    const { produitId, fichierId } = await ressourceAvecFichier();
    await vendre(produitId, 8_000);
    await retirerFichierDe({ userId: vendeur, produitId, fichierId });

    const restants = await db.productFile.count({
      where: { productId: produitId, role: "SOURCE", deletedAt: null },
    });

    // C'est ce compte-là que `publierRessource` interroge : une ressource dont
    // le seul fichier a été retiré ne doit pas rester publiable.
    expect(restants).toBe(0);
  });
});
