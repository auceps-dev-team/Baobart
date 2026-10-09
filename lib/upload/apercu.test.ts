/**
 * La recette de l'aperçu public, de bout en bout, le stockage simulé.
 *
 * La CI n'a pas de stockage S3 : sans ce test, `produireApercu` — réduction,
 * filigrane, compression, clé — ne serait exécuté par aucun passage.
 */

import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const deposes: { cle: string; corps: Buffer; contentType: string }[] = [];
let source: Buffer | null = null;

vi.mock("@/lib/upload/storage", () => ({
  PREFIXE_PUBLIC: "public/",
  telechargerObjet: async () => source,
  deposerObjet: async (o: { cle: string; corps: Buffer; contentType: string }) => void deposes.push(o),
  urlPublique: (cle: string) => `https://cdn.baobart.test/${cle}`,
}));

import { cleDApercu, cleDeVignette, produireApercu, xmpDe } from "@/lib/upload/apercu";

/** Une photo factice : un dégradé, pour que la compression ait du travail. */
async function photo(largeur: number, hauteur: number): Promise<Buffer> {
  const pixels = Buffer.alloc(largeur * hauteur * 3);
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const i = (y * largeur + x) * 3;
      pixels[i] = (x * 255) / largeur;
      pixels[i + 1] = (y * 255) / hauteur;
      pixels[i + 2] = 128;
    }
  }
  return sharp(pixels, { raw: { width: largeur, height: hauteur, channels: 3 } }).png().toBuffer();
}

beforeEach(() => {
  deposes.length = 0;
  source = null;
});

describe("l'aperçu public", () => {
  it("réduit à 800 px, en WebP, sous la clé filigranée — et garde les dimensions de l'original", async () => {
    source = await photo(2000, 1500);

    const apercu = await produireApercu({
      mediaId: "m1",
      cleSource: "produits/p1/x.png",
      nomFichier: "x.png",
      taille: source.length,
      pseudo: "awa-design",
    });

    expect(apercu).toMatchObject({
      cle: cleDApercu("m1"),
      url: `https://cdn.baobart.test/${cleDApercu("m1")}`,
      // Ce que l'acheteur recevra, pas la vignette.
      largeur: 2000,
      hauteur: 1500,
    });
    // La vignette d'abord, l'aperçu ensuite : la base ne garde que l'adresse
    // de l'aperçu, et la vignette s'en déduit.
    expect(deposes.map((d) => d.cle)).toEqual([cleDeVignette("m1"), cleDApercu("m1")]);
    expect(deposes.every((d) => d.contentType === "image/webp")).toBe(true);
    expect(await sharp(deposes[1]!.corps).metadata()).toMatchObject({ format: "webp", width: 800, height: 600 });
    expect(await sharp(deposes[0]!.corps).metadata()).toMatchObject({ format: "webp", width: 400, height: 300 });
  });

  it("signe chaque taille en XMP : auteur, et refus de la fouille pour l'IA", async () => {
    source = await photo(1200, 900);
    await produireApercu({ mediaId: "m4", cleSource: "k", nomFichier: "x.png", taille: source.length, pseudo: "awa" });

    for (const depose of deposes) {
      const xmp = (await sharp(depose.corps).metadata()).xmp?.toString("utf8") ?? "";
      expect(xmp).toContain('plus:DataMining="http://ns.useplus.org/ldf/vocab/DMI-PROHIBITED-EXCEPTSEARCHENGINEINDEXING"');
      expect(xmp).toContain("<rdf:li>@awa</rdf:li>");
    }
  });

  it("échappe le pseudo dans le XMP", () => {
    expect(xmpDe('a<b&"c')).toContain("@a&lt;b&amp;&quot;c");
    expect(xmpDe(null)).toContain("<rdf:li>Baobart</rdf:li>");
  });

  it("porte le filigrane : l'aperçu diffère d'une simple réduction", async () => {
    source = await photo(1600, 1200);
    await produireApercu({ mediaId: "m2", cleSource: "k", nomFichier: "x.png", taille: source.length, pseudo: "awa" });

    // Comparé à une réduction nue AUX MÊMES DIMENSIONS que l'aperçu déposé.
    // Une première version comparait à 800 px quoi qu'il arrive : l'ancien
    // aperçu (1 400 px, sans marque) la passait — les pixels décalés
    // suffisaient à faire des « écarts » (contre-épreuve du 09/10).
    const apercu = deposes.find((d) => d.cle === cleDApercu("m2"))!.corps;
    const { width, height } = await sharp(apercu).metadata();
    const marque = await sharp(apercu).removeAlpha().raw().toBuffer();
    const nu = await sharp(source).resize({ width, height }).webp({ quality: 60 }).toBuffer()
      .then((b) => sharp(b).removeAlpha().raw().toBuffer());
    expect(nu.length).toBe(marque.length);

    let ecarts = 0;
    for (let i = 0; i < marque.length; i += 3) {
      if (Math.abs(marque[i]! - nu[i]!) + Math.abs(marque[i + 1]! - nu[i + 1]!) + Math.abs(marque[i + 2]! - nu[i + 2]!) > 30) ecarts += 1;
    }
    expect(ecarts / (marque.length / 3)).toBeGreaterThan(0.01);
  });

  it("ne grossit pas une petite image", async () => {
    source = await photo(500, 300);
    await produireApercu({ mediaId: "m3", cleSource: "k", nomFichier: "x.png", taille: source.length, pseudo: null });
    const apercu = deposes.find((d) => d.cle === cleDApercu("m3"))!.corps;
    expect(await sharp(apercu).metadata()).toMatchObject({ width: 500, height: 300 });
  });
});
