/**
 * La fiche d'une ressource retirée de la vente (recette du 14/11/2026, Q-37).
 *
 * Elle se rouvre à celui qui l'a obtenue, et à lui seul. Ce fichier garde
 * surtout l'autre côté de la règle : rien de ce qui n'est pas publié ne doit
 * fuir vers quelqu'un qui n'y a pas droit — un brouillon porte un slug, et
 * `obtenirProduit` répondait « n'existe pas » exprès pour ne pas le révéler.
 */

import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { encaisserLigne, rembourserLigne } from "@/lib/domain/orders";
import { obtenirProduit } from "@/lib/products/queries";

let n = 0;
const marque = (p: string) => `${p}-fr-${++n}-${Math.random().toString(36).slice(2, 7)}`;

async function compte(p: string) {
  const m = marque(p);
  return db.user.create({ data: { email: `${m}@baobart.test`, profile: { create: { username: m, displayName: `Nom ${m}` } } }, select: { id: true } });
}

/** Une ressource publiée, achetée par `acheteur` par la vraie fonction d'encaissement. */
async function venteFaite() {
  const vendeur = await compte("v");
  const acheteur = await compte("a");
  const m = marque("p");
  const produit = await db.product.create({
    data: { sellerId: vendeur.id, name: `Pack ${m}`, slug: m, price: 2_000, currency: "XOF", status: "PUBLISHED" },
    select: { id: true, slug: true },
  });
  const commande = await db.order.create({
    data: { buyerId: acheteur.id, total: 2_000, currency: "XOF", items: { create: { productId: produit.id, quantity: 1, price: 2_000 } } },
    select: { items: { select: { id: true } } },
  });
  const ligneId = commande.items[0]!.id;
  await encaisserLigne({ orderItemId: ligneId });
  return { vendeur, acheteur, produit, ligneId };
}

describe("la fiche d'une ressource qui n'est plus en vente", () => {
  it("publiée : la fiche est à tout le monde, et ne se dit pas retirée", async () => {
    const { produit } = await venteFaite();
    expect((await obtenirProduit(produit.slug))?.retiree).toBe(false);
  });

  for (const statut of ["DRAFT", "ARCHIVED"] as const) {
    it(`${statut} : elle se rouvre à l'acheteur, et à lui seul`, async () => {
      const { acheteur, produit } = await venteFaite();
      const passant = await compte("x");
      await db.product.update({ where: { id: produit.id }, data: { status: statut } });

      expect(await obtenirProduit(produit.slug)).toBeNull();
      expect(await obtenirProduit(produit.slug, passant.id)).toBeNull();
      expect((await obtenirProduit(produit.slug, acheteur.id))?.retiree).toBe(true);
    });
  }

  it("un brouillon jamais vendu ne s'ouvre à personne, pas même à qui devine son adresse", async () => {
    const vendeur = await compte("v");
    const curieux = await compte("x");
    const m = marque("b");
    await db.product.create({ data: { sellerId: vendeur.id, name: "Brouillon", slug: m, price: 1_000, currency: "XOF", status: "DRAFT" } });

    expect(await obtenirProduit(m)).toBeNull();
    expect(await obtenirProduit(m, curieux.id)).toBeNull();
  });

  it("remboursée en entier : elle ne lui appartient plus, la fiche ne se rouvre pas", async () => {
    const { acheteur, produit, ligneId } = await venteFaite();
    await rembourserLigne({ orderItemId: ligneId, amount: 2_000 });
    await db.product.update({ where: { id: produit.id }, data: { status: "DRAFT" } });

    expect(await obtenirProduit(produit.slug, acheteur.id)).toBeNull();
  });

  it("retrait juridique : fermée à l'acheteur aussi, comme la route de téléchargement", async () => {
    const { acheteur, produit } = await venteFaite();
    await db.product.update({ where: { id: produit.id }, data: { status: "SUSPENDED" } });

    expect(await obtenirProduit(produit.slug, acheteur.id)).toBeNull();
  });
});
