/**
 * La régénération des aperçus d'avant le filigrane, contre la vraie base.
 *
 * Le stockage est un dictionnaire en mémoire : la CI n'a pas de S3. Tout le
 * reste — médias, fichiers, couvertures — est réel.
 *
 * Ce qu'on éprouve surtout : qu'un ancien aperçu disparaisse une fois refait,
 * et qu'on ne vide jamais une couverture qu'on n'a pas su refaire.
 */

import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const objets = new Map<string, Buffer>();

vi.mock("@/lib/upload/storage", async (original) => ({
  ...(await original<typeof import("@/lib/upload/storage")>()),
  listerObjets: async (prefixe: string) =>
    [...objets.keys()].filter((c) => c.startsWith(prefixe)).map((cle) => ({ cle, modifieLe: new Date() })),
  telechargerObjet: async (cle: string) => objets.get(cle) ?? null,
  lireObjet: async (cle: string) =>
    objets.has(cle) ? { taille: objets.get(cle)!.length, contentType: "image/png", etag: "x" } : null,
  deposerObjet: async (o: { cle: string; corps: Buffer }) => void objets.set(o.cle, o.corps),
  supprimerObjet: async (cle: string) => void objets.delete(cle),
  urlPublique: (cle: string) => `https://cdn.baobart.test/${cle}`,
}));

import { db } from "@/lib/db";
import { regenererApercus } from "@/lib/upload/regeneration";
import { anciennesClesDApercu, cleDApercu, cleDeVignette } from "@/lib/upload/vignette";

let n = 0;

async function image(largeur: number, hauteur: number): Promise<Buffer> {
  return sharp({ create: { width: largeur, height: hauteur, channels: 3, background: { r: 90, g: 140, b: 200 } } })
    .png()
    .toBuffer();
}

/**
 * Une ressource publiée par une recette périmée : source privée, ancien
 * aperçu public. `recette` 1 = avant le filigrane (`<id>.webp`), 2 = v1.86.0
 * (`<id>-v2.webp`, sans vignette).
 */
async function ressourceDAvant(options: { sourcePresente?: boolean; recette?: 1 | 2 } = {}) {
  n += 1;
  const vendeur = await db.user.create({
    data: {
      email: `regen-${n}@baobart.test`,
      profile: { create: { username: `regen-${n}`, displayName: `Regen ${n}` } },
    },
    select: { id: true },
  });
  const produit = await db.product.create({
    data: { sellerId: vendeur.id, slug: `regen-${n}`, name: "Visuel", price: 5_000, currency: "XOF", status: "PUBLISHED" },
    select: { id: true },
  });
  const source = await image(2000, 1000);
  const s3Key = `produits/${produit.id}/visuel-${n}.png`;
  if (options.sourcePresente !== false) objets.set(s3Key, source);

  const media = await db.mediaAsset.create({
    data: { ownerId: vendeur.id, purpose: "product", s3Key, checksum: "x", sizeBytes: source.length, contentType: "image/png", status: "READY" },
    select: { id: true },
  });
  await db.productFile.create({
    data: { productId: produit.id, mediaId: media.id, filename: `visuel-${n}.png`, sizeBytes: source.length },
  });

  const ancienne = anciennesClesDApercu(media.id)[(options.recette ?? 1) - 1]!;
  objets.set(ancienne, await image(1400, 700));
  await db.product.update({
    where: { id: produit.id },
    data: { coverUrl: `https://cdn.baobart.test/${ancienne}`, coverImageId: media.id },
  });

  return { produitId: produit.id, mediaId: media.id, ancienne, pseudo: `regen-${n}` };
}

beforeEach(() => {
  objets.clear();
});

describe("régénérer les aperçus", () => {
  it("ne touche à rien sans --appliquer", async () => {
    const r = await ressourceDAvant();

    const issues = await regenererApercus({ appliquer: false });

    expect(issues).toEqual([{ media: r.mediaId, cles: [r.ancienne], issue: "REFAIT", couvertures: 1 }]);
    expect(objets.has(r.ancienne)).toBe(true);
    expect(objets.has(cleDApercu(r.mediaId))).toBe(false);
  });

  it.each([1, 2] as const)("refait un aperçu de la recette %i, avec sa vignette, et supprime l'ancien", async (recette) => {
    const r = await ressourceDAvant({ recette });

    const issues = await regenererApercus({ appliquer: true });

    expect(issues).toEqual([{ media: r.mediaId, cles: [r.ancienne], issue: "REFAIT", couvertures: 1 }]);
    expect(await sharp(objets.get(cleDeVignette(r.mediaId))!).metadata()).toMatchObject({ width: 400 });
    // L'ancien — grand, sans marque — ne répond plus.
    expect(objets.has(r.ancienne)).toBe(false);
    const nouveau = objets.get(cleDApercu(r.mediaId));
    expect(nouveau).toBeDefined();
    expect(await sharp(nouveau!).metadata()).toMatchObject({ format: "webp", width: 800, height: 400 });

    const produit = await db.product.findUniqueOrThrow({ where: { id: r.produitId } });
    expect(produit.coverUrl).toBe(`https://cdn.baobart.test/${cleDApercu(r.mediaId)}`);
  });

  it("se rejoue sans rien refaire", async () => {
    await ressourceDAvant();
    await regenererApercus({ appliquer: true });
    expect(await regenererApercus({ appliquer: true })).toEqual([]);
  });

  it("ne supprime pas un ancien aperçu qu'il n'a pas su refaire", async () => {
    // La source a disparu : supprimer l'ancien viderait la couverture sans
    // que personne l'ait décidé. Il est rapporté, et reste.
    const r = await ressourceDAvant({ sourcePresente: false });

    const issues = await regenererApercus({ appliquer: true });

    expect(issues).toMatchObject([{ media: r.mediaId, cles: [r.ancienne], issue: "ECHEC" }]);
    expect(objets.has(r.ancienne)).toBe(true);
    const produit = await db.product.findUniqueOrThrow({ where: { id: r.produitId } });
    expect(produit.coverUrl).toBe(`https://cdn.baobart.test/${r.ancienne}`);
  });

  it("supprime un ancien aperçu orphelin, que plus rien ne montre", async () => {
    objets.set("public/apercus/media-disparu.webp", await image(100, 100));

    const issues = await regenererApercus({ appliquer: true });

    expect(issues).toEqual([
      { media: "media-disparu", cles: ["public/apercus/media-disparu.webp"], issue: "ORPHELIN_SUPPRIME" },
    ]);
    expect(objets.size).toBe(0);
  });

  it("refait une seule fois un média qui a deux clés périmées, et les supprime toutes", async () => {
    const r = await ressourceDAvant({ recette: 1 });
    const v2 = anciennesClesDApercu(r.mediaId)[1]!;
    objets.set(v2, await image(800, 400));

    const issues = await regenererApercus({ appliquer: true });

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ media: r.mediaId, issue: "REFAIT" });
    expect([...(issues[0] as { cles: string[] }).cles].sort()).toEqual([r.ancienne, v2].sort());
    expect(objets.has(r.ancienne) || objets.has(v2)).toBe(false);
  });
});

/**
 * Une ressource dont la couverture n'a jamais été un aperçu — le cas du jeu de
 * démonstration, mesuré le 15/10/2026 sur 102 couvertures sur 102.
 */
async function ressourceSansApercu(options: {
  couverture?: string;
  fichiers?: Array<{ nom: string; role?: "SOURCE" | "PREVIEW"; present?: boolean }>;
} = {}) {
  n += 1;
  const vendeur = await db.user.create({
    data: {
      email: `regen-${n}@baobart.test`,
      profile: { create: { username: `regen-${n}`, displayName: `Regen ${n}` } },
    },
    select: { id: true },
  });
  const couverture = options.couverture ?? `https://cdn.baobart.test/demo/apercu/visuel-${n}.jpg`;
  const produit = await db.product.create({
    data: { sellerId: vendeur.id, slug: `regen-${n}`, name: "Visuel", price: 5_000, currency: "XOF", status: "PUBLISHED", coverUrl: couverture },
    select: { id: true },
  });

  const medias: string[] = [];
  for (const [position, f] of (options.fichiers ?? [{ nom: `visuel-${n}.png` }]).entries()) {
    const corps = await image(1600, 900);
    const s3Key = `demo/${produit.id}-${f.nom}`;
    if (f.present !== false) objets.set(s3Key, corps);
    const media = await db.mediaAsset.create({
      data: { ownerId: vendeur.id, purpose: "product", s3Key, checksum: "x", sizeBytes: corps.length, contentType: "image/png", status: "READY" },
      select: { id: true },
    });
    await db.productFile.create({
      data: { productId: produit.id, mediaId: media.id, filename: f.nom, sizeBytes: corps.length, role: f.role ?? "SOURCE", position },
    });
    medias.push(media.id);
  }

  return { produitId: produit.id, medias, couverture, pseudo: `regen-${n}` };
}

describe("protéger une couverture qui n'a jamais été un aperçu", () => {
  it("tire un aperçu filigrané du fichier de la ressource, et repointe la couverture", async () => {
    const r = await ressourceSansApercu();
    const ancienne = r.couverture.replace("https://cdn.baobart.test/", "");
    objets.set(ancienne, await image(1400, 788));

    const issues = await regenererApercus({ appliquer: true });

    expect(issues).toEqual([
      { produit: r.produitId, ancienne: r.couverture, issue: "COUVERTURE_PROTEGEE", media: r.medias[0] },
    ]);
    const produit = await db.product.findUniqueOrThrow({ where: { id: r.produitId } });
    expect(produit.coverUrl).toBe(`https://cdn.baobart.test/${cleDApercu(r.medias[0]!)}`);
    expect(produit.coverImageId).toBe(r.medias[0]);

    // Réduit, et marqué : la réserve d'entraînement d'IA est dans le fichier.
    const apercu = await sharp(objets.get(cleDApercu(r.medias[0]!))!).metadata();
    expect(apercu).toMatchObject({ format: "webp", width: 800 });
    expect(apercu.xmp?.toString()).toContain("DMI-PROHIBITED-EXCEPTSEARCHENGINEINDEXING");
    expect(objets.has(cleDeVignette(r.medias[0]!))).toBe(true);

    // L'ancienne image n'est pas à nous : elle reste.
    expect(objets.has(ancienne)).toBe(true);
  });

  it("préfère l'aperçu choisi par le créateur à la source", async () => {
    const r = await ressourceSansApercu({
      fichiers: [{ nom: "source.png", role: "SOURCE" }, { nom: "apercu.png", role: "PREVIEW" }],
    });

    await regenererApercus({ appliquer: true });

    const produit = await db.product.findUniqueOrThrow({ where: { id: r.produitId } });
    expect(produit.coverImageId).toBe(r.medias[1]);
  });

  it("ne touche à rien sans --appliquer, mais dit ce qu'il ferait", async () => {
    const r = await ressourceSansApercu({ couverture: "/img/demo/neon-03.png" });

    const issues = await regenererApercus({ appliquer: false });

    expect(issues).toEqual([
      { produit: r.produitId, ancienne: "/img/demo/neon-03.png", issue: "COUVERTURE_PROTEGEE", media: r.medias[0] },
    ]);
    expect(objets.has(cleDApercu(r.medias[0]!))).toBe(false);
    const produit = await db.product.findUniqueOrThrow({ where: { id: r.produitId } });
    expect(produit.coverUrl).toBe("/img/demo/neon-03.png");
  });

  it("rapporte, sans rien changer, une ressource dont la source a disparu", async () => {
    // Le cas des seize ressources du premier jeu de démonstration : leurs
    // fichiers vendus n'ont jamais été déposés dans le stockage.
    const r = await ressourceSansApercu({ couverture: "/img/demo/neon-03.png", fichiers: [{ nom: "absent.png", present: false }] });

    const issues = await regenererApercus({ appliquer: true });

    expect(issues).toEqual([
      { produit: r.produitId, ancienne: "/img/demo/neon-03.png", issue: "COUVERTURE_ECHEC", raison: "source absente ou illisible (voir le journal)" },
    ]);
    const produit = await db.product.findUniqueOrThrow({ where: { id: r.produitId } });
    expect(produit.coverUrl).toBe("/img/demo/neon-03.png");
  });

  it("annonce l'échec dès la simulation quand la source manque", async () => {
    const r = await ressourceSansApercu({ fichiers: [{ nom: "absent.png", present: false }] });

    expect(await regenererApercus({ appliquer: false })).toMatchObject([
      { produit: r.produitId, issue: "COUVERTURE_ECHEC" },
    ]);
  });

  it("rapporte une ressource sans fichier image dont tirer un aperçu", async () => {
    const r = await ressourceSansApercu({ fichiers: [{ nom: "pack.zip" }] });

    expect(await regenererApercus({ appliquer: true })).toMatchObject([
      { produit: r.produitId, issue: "COUVERTURE_ECHEC", raison: "aucun fichier image dont tirer un aperçu" },
    ]);
  });

  it("se rejoue sans rien refaire", async () => {
    await ressourceSansApercu();
    await regenererApercus({ appliquer: true });
    expect(await regenererApercus({ appliquer: true })).toEqual([]);
  });
});
