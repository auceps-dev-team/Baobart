/**
 * Un fichier vendu hébergé ailleurs, contre une vraie base : la porte, la
 * redirection, les contraintes, la fiche.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// La route lit la session elle-même ; hors d'une requête Next, `cookies()`
// lèverait. On décide ici qui est connecté.
let connecte: { id: string } | null = null;
vi.mock("@/lib/auth/session", () => ({ sessionCourante: async () => connecte }));

import { GET as telecharger } from "@/app/api/telechargement/[fichierId]/route";
import { acheter } from "@/lib/checkout/achat";
import { db } from "@/lib/db";
import { droitDeTelecharger, obtenirProduit } from "@/lib/products/queries";
import { ajouterLienExterneDe, FICHIERS_MAX, retirerFichierDe } from "@/lib/upload/service";

const LIEN = "https://drive.google.com/file/d/1AbCdEf/view?usp=sharing";

const AVANT = { simulation: process.env.CHECKOUT_SIMULATION_ENABLED, endpoint: process.env.S3_ENDPOINT };
beforeEach(() => {
  process.env.CHECKOUT_SIMULATION_ENABLED = "1";
});
afterEach(() => {
  connecte = null;
  if (AVANT.simulation === undefined) delete process.env.CHECKOUT_SIMULATION_ENABLED;
  else process.env.CHECKOUT_SIMULATION_ENABLED = AVANT.simulation;
  if (AVANT.endpoint === undefined) delete process.env.S3_ENDPOINT;
  else process.env.S3_ENDPOINT = AVANT.endpoint;
});

let n = 0;

async function compte(role: string) {
  n += 1;
  return db.user.create({
    data: { email: `lien-${role}-${n}@baobart.test`, profile: { create: { username: `lien-${role}-${n}`, displayName: role } } },
    select: { id: true },
  });
}

async function ressource(vendeurId: string, prix = 2000) {
  n += 1;
  return db.product.create({
    data: { sellerId: vendeurId, name: `Pack ${n}`, slug: `pack-lien-${n}`, price: prix, currency: "XOF", status: "PUBLISHED" },
    select: { id: true, slug: true },
  });
}

async function fichierHeberge(produitId: string, ownerId: string, taille: number, nom = "pack.zip") {
  const media = await db.mediaAsset.create({
    data: { ownerId, purpose: "product", s3Key: `produits/${produitId}/${n}-${nom}`, checksum: "x", contentType: "application/zip", sizeBytes: taille, status: "READY" },
    select: { id: true },
  });
  return db.productFile.create({
    data: { productId: produitId, mediaId: media.id, filename: nom, sizeBytes: taille, role: "SOURCE" },
    select: { id: true },
  });
}

const demander = (fichierId: string) =>
  telecharger(new Request(`https://baobart.ci/api/telechargement/${fichierId}`), { params: Promise.resolve({ fichierId }) });

describe("ajouter un lien externe", () => {
  it("l'attache comme fichier source, sans taille ni média", async () => {
    const vendeur = await compte("vendeur");
    const p = await ressource(vendeur.id);

    const r = await ajouterLienExterneDe({ userId: vendeur.id, produitId: p.id, url: LIEN, nom: "" });
    expect(r).toMatchObject({ ok: true, fichier: { nom: "Fichier sur drive.google.com", taille: null, externe: "drive.google.com" } });

    const ligne = await db.productFile.findFirstOrThrow({ where: { productId: p.id } });
    expect(ligne).toMatchObject({ externalUrl: LIEN, mediaId: null, sizeBytes: null, role: "SOURCE", deletedAt: null });
  });

  it("refuse le lien d'un autre, un lien en http, et au-delà du plafond", async () => {
    const vendeur = await compte("vendeur");
    const intrus = await compte("intrus");
    const p = await ressource(vendeur.id);

    expect((await ajouterLienExterneDe({ userId: intrus.id, produitId: p.id, url: LIEN, nom: "" })).ok).toBe(false);
    expect((await ajouterLienExterneDe({ userId: vendeur.id, produitId: p.id, url: "http://drive.google.com/x", nom: "" })).ok).toBe(false);

    await db.productFile.createMany({
      data: Array.from({ length: FICHIERS_MAX }, (_, i) => ({ productId: p.id, externalUrl: `${LIEN}&n=${i}`, filename: `f${i}`, role: "SOURCE" as const })),
    });
    const r = await ajouterLienExterneDe({ userId: vendeur.id, produitId: p.id, url: LIEN, nom: "" });
    expect(r.ok).toBe(false);
    expect(await db.productFile.count({ where: { productId: p.id } })).toBe(FICHIERS_MAX);
  });
});

describe("ce que la base refuse, même à qui contournerait l'application", () => {
  it.each([
    ["ni média ni lien", { externalUrl: null }],
    ["un lien en http", { externalUrl: "http://drive.google.com/x" }],
    ["un lien d'aperçu", { externalUrl: LIEN, role: "PREVIEW" as const }],
  ])("refuse %s", async (_cas, champs) => {
    const vendeur = await compte("vendeur");
    const p = await ressource(vendeur.id);
    await expect(
      db.productFile.create({ data: { productId: p.id, filename: "f", role: "SOURCE", ...champs } }),
    ).rejects.toThrow();
  });

  it("refuse un média ET un lien à la fois", async () => {
    const vendeur = await compte("vendeur");
    const p = await ressource(vendeur.id);
    const f = await fichierHeberge(p.id, vendeur.id, 1024);
    await expect(db.productFile.update({ where: { id: f.id }, data: { externalUrl: LIEN } })).rejects.toThrow();
  });

  it("refuse un fichier hébergé sans taille", async () => {
    const vendeur = await compte("vendeur");
    const p = await ressource(vendeur.id);
    const f = await fichierHeberge(p.id, vendeur.id, 1024);
    await expect(db.productFile.update({ where: { id: f.id }, data: { sizeBytes: null } })).rejects.toThrow();
  });
});

describe("la porte", () => {
  async function vendu() {
    const vendeur = await compte("vendeur");
    const acheteur = await compte("acheteur");
    const p = await ressource(vendeur.id);
    const ajout = await ajouterLienExterneDe({ userId: vendeur.id, produitId: p.id, url: LIEN, nom: "Pack complet.zip" });
    if (!ajout.ok) throw new Error(ajout.message);
    const achat = await acheter({ produitId: p.id, acheteurId: acheteur.id });
    expect(achat.ok).toBe(true);
    return { vendeur, acheteur, p, fichierId: ajout.fichier.id };
  }

  it("redirige l'acheteur vers le lien, compte le retrait, et ne laisse rien en cache", async () => {
    const { acheteur, p, fichierId } = await vendu();
    connecte = { id: acheteur.id };

    const r = await demander(fichierId);
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe(LIEN);
    expect(r.headers.get("cache-control")).toBe("private, no-store");

    expect(await db.consumptionEvent.count({ where: { userId: acheteur.id, productFileId: fichierId } })).toBe(1);
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id }, select: { downloadsCount: true } })).downloadsCount).toBe(1);
  });

  it("ne donne jamais le lien à qui n'a pas acheté", async () => {
    const { fichierId } = await vendu();
    const curieux = await compte("curieux");
    connecte = { id: curieux.id };

    const r = await demander(fichierId);
    expect(r.status).toBe(403);
    expect(r.headers.get("location")).toBeNull();
    expect(await r.text()).not.toContain("drive.google.com");
  });

  it("ne le donne plus après un remboursement intégral", async () => {
    const { acheteur, p, fichierId } = await vendu();
    await db.orderItem.updateMany({ where: { productId: p.id }, data: { refundedAmount: 2000 } });
    connecte = { id: acheteur.id };

    const r = await demander(fichierId);
    expect(r.status).toBe(403);
    expect(r.headers.get("location")).toBeNull();
  });

  it("sert le lien même sans stockage configuré : il n'en dépend pas", async () => {
    const { acheteur, fichierId } = await vendu();
    delete process.env.S3_ENDPOINT;
    connecte = { id: acheteur.id };

    expect((await demander(fichierId)).headers.get("location")).toBe(LIEN);
  });

  it("garde la ligne d'un lien retiré après la vente, et cesse de le servir", async () => {
    const { vendeur, acheteur, p, fichierId } = await vendu();
    expect(await retirerFichierDe({ userId: vendeur.id, produitId: p.id, fichierId })).toEqual({ ok: true, efface: false });

    const ligne = await db.productFile.findUniqueOrThrow({ where: { id: fichierId } });
    expect(ligne.deletedAt).not.toBeNull();
    expect(ligne.externalUrl).toBe(LIEN);

    connecte = { id: acheteur.id };
    expect((await demander(fichierId)).status).toBe(403);
  });
});

describe("ce que la fiche dit avant l'achat", () => {
  it("nomme l'hébergeur, et décrit le fichier hébergé plutôt que le lien", async () => {
    const vendeur = await compte("vendeur");
    const p = await ressource(vendeur.id);
    await ajouterLienExterneDe({ userId: vendeur.id, produitId: p.id, url: LIEN, nom: "" });
    await fichierHeberge(p.id, vendeur.id, 5 * 1024 * 1024, "maquette.psd");

    const fiche = await obtenirProduit(p.slug);
    expect(fiche?.hebergeSur).toEqual(["drive.google.com"]);
    // Les NULL passent derrière : sans `nulls: "last"`, le lien serait pris
    // pour le plus gros fichier, et la fiche n'aurait ni poids ni format.
    expect(fiche?.fichier).toMatchObject({ poids: 5 * 1024 * 1024 });
  });

  it("n'invente ni poids ni format pour une ressource toute en liens", async () => {
    const vendeur = await compte("vendeur");
    const p = await ressource(vendeur.id);
    await ajouterLienExterneDe({ userId: vendeur.id, produitId: p.id, url: LIEN, nom: "" });

    const fiche = await obtenirProduit(p.slug);
    // « Fichier sur drive.google.com » se terminait par « .com » : sans garde,
    // la fiche annonçait le format COM.
    expect(fiche?.fichier).toEqual({ format: "Lien externe", dimensions: null, poids: null });
  });

  it("reste celle de la maquette quand tout est hébergé chez nous", async () => {
    const vendeur = await compte("vendeur");
    const p = await ressource(vendeur.id);
    await fichierHeberge(p.id, vendeur.id, 1024);
    expect((await obtenirProduit(p.slug))?.hebergeSur).toEqual([]);
  });

  it("dit à l'acheteur où mène chaque bouton", async () => {
    const vendeur = await compte("vendeur");
    const p = await ressource(vendeur.id, 0);
    await ajouterLienExterneDe({ userId: vendeur.id, produitId: p.id, url: "https://www.dropbox.com/s/x/pack.zip?dl=1", nom: "Pack.zip" });
    await fichierHeberge(p.id, vendeur.id, 1024, "notice.pdf");
    const lecteur = await compte("lecteur");

    const droit = await droitDeTelecharger(p.id, lecteur.id);
    expect(droit.etat).toBe("TELECHARGEABLE");
    if (droit.etat === "TELECHARGEABLE") {
      expect(droit.fichiers.map((f) => f.externe).sort()).toEqual(["dropbox.com", null].sort());
    }
  });
});
