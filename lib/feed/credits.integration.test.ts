/**
 * Le chiffre de la page À propos : ce qui est resté aux créateurs sur sept jours.
 *
 * Piste 1 de la recette (14/11/2026) : « 6 903 F crédités » quand la seule
 * créatrice détenait 1 903 F — une vente remboursée comptait encore. Par le
 * vrai chemin : achat simulé (`acheter`), puis vrai remboursement
 * (`rembourserLigne`), pas des écritures posées à la main.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { acheter } from "@/lib/checkout/achat";
import { db } from "@/lib/db";
import { rembourserLigne } from "@/lib/domain/orders";
import { creditsAuxCreateurs } from "@/lib/feed/queries";

const AVANT = process.env.CHECKOUT_SIMULATION_ENABLED;
beforeEach(() => {
  process.env.CHECKOUT_SIMULATION_ENABLED = "1";
});
afterEach(() => {
  if (AVANT === undefined) delete process.env.CHECKOUT_SIMULATION_ENABLED;
  else process.env.CHECKOUT_SIMULATION_ENABLED = AVANT;
});

let n = 0;
async function venteDe(prix: number) {
  n += 1;
  const s = `${n}-${Math.random().toString(36).slice(2, 7)}`;
  const vendeur = await db.user.create({
    data: { email: `cred-v-${s}@baobart.test`, profile: { create: { username: `cred-v-${s}`, displayName: `Atelier ${s}` } } },
    select: { id: true },
  });
  const acheteur = await db.user.create({ data: { email: `cred-a-${s}@baobart.test` }, select: { id: true } });
  const produit = await db.product.create({
    data: { sellerId: vendeur.id, name: `Pack ${s}`, slug: `pack-cred-${s}`, price: prix, currency: "XOF", status: "PUBLISHED" },
    select: { id: true },
  });
  const media = await db.mediaAsset.create({
    data: { ownerId: vendeur.id, purpose: "product", s3Key: `produits/${produit.id}/p.zip`, checksum: "x", contentType: "application/zip", sizeBytes: 10, status: "READY" },
    select: { id: true },
  });
  await db.productFile.create({ data: { productId: produit.id, mediaId: media.id, filename: "p.zip", sizeBytes: 10, role: "SOURCE", position: 0 } });
  const r = await acheter({ produitId: produit.id, acheteurId: acheteur.id });
  expect(r.ok).toBe(true);
  return db.orderItem.findFirstOrThrow({ where: { productId: produit.id }, select: { id: true } });
}

describe("creditsAuxCreateurs", () => {
  it("une vente remboursée en entier ne compte plus : le chiffre baisse du montant rendu", async () => {
    await venteDe(2_000);
    const grosse = await venteDe(5_000);
    const avant = await creditsAuxCreateurs();
    expect(avant).toBeGreaterThan(5_000);

    await rembourserLigne({ orderItemId: grosse.id, amount: 5_000 });

    expect(await creditsAuxCreateurs()).toBe(avant - 5_000);
  });

  it("jamais sous zéro : un remboursement plus gros que le net de la semaine laisse 0", async () => {
    const seule = await venteDe(5_000);
    await rembourserLigne({ orderItemId: seule.id, amount: 5_000 });
    // Le vendeur rend le brut (5 000) après avoir reçu son net (moins) : la somme est négative.
    expect(await creditsAuxCreateurs()).toBe(0);
  });
});
