/**
 * L'ADS manager contre une vraie base : ce qui paraît, ce qui se compte, ce
 * qui s'attribue.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { acheter } from "@/lib/checkout/achat";
import { db } from "@/lib/db";
import {
  archiver,
  attribuer,
  diffusion,
  enregistrerClic,
  enregistrerVues,
  listerPourAdministration,
  regler,
} from "@/lib/publicites/service";

const AVANT = process.env.CHECKOUT_SIMULATION_ENABLED;
beforeEach(() => {
  process.env.CHECKOUT_SIMULATION_ENABLED = "1";
});
afterEach(() => {
  if (AVANT === undefined) delete process.env.CHECKOUT_SIMULATION_ENABLED;
  else process.env.CHECKOUT_SIMULATION_ENABLED = AVANT;
});

let n = 0;
const MAINTENANT = new Date("2026-10-03T12:00:00Z");
const HIER = new Date("2026-10-02T12:00:00Z");
const DEMAIN = new Date("2026-10-04T12:00:00Z");

async function creerPub(input: Partial<{ linkUrl: string; startsAt: Date | null; endsAt: Date | null; pausedAt: Date | null }> = {}) {
  n += 1;
  return db.ad.create({
    data: {
      title: `Campagne ${n}`,
      imageUrl: `http://localhost:9000/baobart/public/pubs/p-${n}.png`,
      imageWidth: 1200,
      imageHeight: 600,
      linkUrl: input.linkUrl ?? "/explore",
      frequency: 10,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      pausedAt: input.pausedAt ?? null,
      createdById: "test",
    },
    select: { id: true },
  });
}

async function creerProduitAchetable() {
  n += 1;
  const vendeur = await db.user.create({
    data: { email: `pub-vendeur-${n}@baobart.test`, profile: { create: { username: `pub-vendeur-${n}`, displayName: "V" } } },
    select: { id: true },
  });
  const acheteur = await db.user.create({
    data: { email: `pub-acheteur-${n}@baobart.test`, profile: { create: { username: `pub-acheteur-${n}`, displayName: "A" } } },
    select: { id: true },
  });
  const produit = await db.product.create({
    data: { sellerId: vendeur.id, name: `Pack ${n}`, slug: `pack-pub-${n}`, price: 2000, currency: "XOF", status: "PUBLISHED" },
    select: { id: true, slug: true },
  });
  const media = await db.mediaAsset.create({
    data: { ownerId: vendeur.id, purpose: "product", s3Key: `produits/${produit.id}/f.zip`, checksum: "x", contentType: "application/zip", sizeBytes: 1024, status: "READY" },
    select: { id: true },
  });
  await db.productFile.create({
    data: { productId: produit.id, mediaId: media.id, filename: "f.zip", sizeBytes: 1024, role: "SOURCE", position: 0 },
  });
  return { produit, acheteur };
}

describe("ce qui paraît dans la mosaïque", () => {
  it("ne montre que les pubs en cours, ni en pause, ni à venir, ni finies", async () => {
    const enCours = await creerPub({ startsAt: HIER, endsAt: DEMAIN });
    await creerPub({ pausedAt: HIER });
    await creerPub({ startsAt: DEMAIN });
    await creerPub({ endsAt: HIER });
    const sansDate = await creerPub();

    const d = await diffusion(MAINTENANT);
    expect(d.pubs.map((p) => p.id)).toEqual([enCours.id, sansDate.id]);
    expect(d.ecartMinimal).toBe(4); // le défaut, sans réglage enregistré
  });

  it("ne montre rien quand la diffusion est coupée", async () => {
    await creerPub();
    await regler({ actives: false, ecartMinimal: 6 });
    expect((await diffusion(MAINTENANT)).pubs).toEqual([]);
  });
});

describe("les compteurs", () => {
  it("additionne les vues dans la base, sans en perdre sous la concurrence", async () => {
    const pub = await creerPub();
    // Dix envois simultanés : un « lire puis écrire » en perdrait.
    await Promise.all(Array.from({ length: 10 }, () => enregistrerVues([pub.id], MAINTENANT)));
    await enregistrerVues([pub.id, pub.id, "cinconnuinconnuinconnu"], MAINTENANT);

    const [ligne] = await listerPourAdministration();
    expect(ligne?.vues).toBe(12);
  });

  it("compte un clic et rend le lien rangé, jamais autre chose", async () => {
    const pub = await creerPub({ linkUrl: "https://exemple.ci/offre" });
    expect(await enregistrerClic(pub.id, MAINTENANT)).toBe("https://exemple.ci/offre");
    expect(await enregistrerClic("cinconnuinconnuinconnu", MAINTENANT)).toBeNull();

    const [ligne] = await listerPourAdministration();
    expect(ligne?.clics).toBe(1);
  });
});

describe("l'attribution d'une vente", () => {
  it("revient à la bannière qui menait à la fiche, et survit à son archivage", async () => {
    const { produit, acheteur } = await creerProduitAchetable();
    const menant = await creerPub({ linkUrl: `/products/${produit.slug}` });
    const ailleurs = await creerPub({ linkUrl: "/explore" });

    const publiciteId = await attribuer(produit.slug, [ailleurs.id, menant.id]);
    expect(publiciteId).toBe(menant.id);

    const r = await acheter({ produitId: produit.id, acheteurId: acheteur.id, publiciteId });
    expect(r.ok).toBe(true);

    const commande = await db.order.findFirstOrThrow({ where: { buyerId: acheteur.id }, select: { id: true, adId: true, status: true } });
    expect(commande.adId).toBe(menant.id);

    const lignes = await listerPourAdministration();
    const ligne = lignes.find((l) => l.id === menant.id);
    // La simulation clôt la vente aussitôt (voir achat.integration.test.ts).
    expect(commande.status).toBe("COMPLETED");
    expect(ligne?.ventes).toBe(1);
    expect(lignes.find((l) => l.id === ailleurs.id)?.peutVendre).toBe(false);

    // La campagne part aux archives ; la vente lui reste attachée.
    await archiver(menant.id, true);
    const apres = await db.order.findUniqueOrThrow({ where: { id: commande.id }, select: { adId: true } });
    expect(apres.adId).toBe(menant.id);
    expect((await listerPourAdministration()).find((l) => l.id === menant.id)?.ventes).toBe(1);
  });
});

describe("l'archivage", () => {
  it("retire la pub de la mosaïque sans effacer ses chiffres", async () => {
    // Avant v1.71.1, « supprimer » effaçait affichages et clics, que rien ne recréait.
    const pub = await creerPub();
    await enregistrerVues([pub.id, pub.id, pub.id], MAINTENANT);
    await enregistrerClic(pub.id, MAINTENANT);

    await archiver(pub.id, true);
    expect((await diffusion(MAINTENANT)).pubs).toEqual([]);
    const ligne = (await listerPourAdministration()).find((l) => l.id === pub.id);
    expect(ligne).toMatchObject({ vues: 3, clics: 1 });
    expect(ligne?.archiveeLe).not.toBeNull();
  });

  it("restaure en pause : une campagne qui ressort se relit avant de reparaître", async () => {
    const pub = await creerPub();
    await archiver(pub.id, true);
    await archiver(pub.id, false);

    const relue = await db.ad.findUniqueOrThrow({ where: { id: pub.id }, select: { archivedAt: true, pausedAt: true } });
    expect(relue.archivedAt).toBeNull();
    expect(relue.pausedAt).not.toBeNull();
    expect((await diffusion(MAINTENANT)).pubs).toEqual([]);
  });
});
