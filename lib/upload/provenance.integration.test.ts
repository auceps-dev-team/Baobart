/**
 * La provenance d'un fichier vendu, contre la vraie base.
 *
 * Le stockage est un dictionnaire en mémoire (la CI n'a pas de S3) ; le média,
 * lui, est réel. On éprouve le point sensible : le fichier livré est gravé SANS
 * perte de pixels, et une copie de référence privée porte la licence.
 */

import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const objets = new Map<string, Buffer>();

vi.mock("@/lib/upload/storage", async (original) => ({
  ...(await original<typeof import("@/lib/upload/storage")>()),
  telechargerObjet: async (cle: string) => objets.get(cle) ?? null,
  deposerObjet: async (o: { cle: string; corps: Buffer }) => void objets.set(o.cle, o.corps),
  lireObjet: async (cle: string) =>
    objets.has(cle)
      ? { taille: objets.get(cle)!.length, contentType: "image/png", etag: `etag-${objets.get(cle)!.length}` }
      : null,
}));

import { db } from "@/lib/db";
import { cleDeReference, poserLaProvenance } from "@/lib/upload/provenance";

let n = 0;

async function png(largeur: number, hauteur: number): Promise<Buffer> {
  return sharp({ create: { width: largeur, height: hauteur, channels: 3, background: { r: 180, g: 90, b: 60 } } })
    .png()
    .toBuffer();
}

async function pixels(image: Buffer): Promise<Buffer> {
  return sharp(image).raw().toBuffer();
}

async function mediaSource(s3Key: string, octets: number): Promise<string> {
  n += 1;
  const vendeur = await db.user.create({
    data: { email: `prov-${n}@baobart.test`, profile: { create: { username: `prov-${n}`, displayName: `Prov ${n}` } } },
    select: { id: true },
  });
  const media = await db.mediaAsset.create({
    data: { ownerId: vendeur.id, purpose: "product", s3Key, checksum: "avant", sizeBytes: octets, contentType: "image/png", status: "READY" },
    select: { id: true },
  });
  return media.id;
}

beforeEach(() => {
  objets.clear();
});

describe("poser la provenance sur un fichier vendu", () => {
  it("grave le fichier livré sans toucher aux pixels, et sort une copie de référence avec la licence", async () => {
    const source = await png(800, 600);
    const s3Key = `produits/p-${n + 1}/visuel.png`;
    objets.set(s3Key, source);
    const mediaId = await mediaSource(s3Key, source.length);

    const issue = await poserLaProvenance({
      mediaId,
      s3Key,
      taille: source.length,
      contentType: "image/png",
      pseudo: "awa",
      licenceTitre: "Licence commerciale",
    });

    expect(issue).toEqual({ grave: true, reference: true });

    // Le fichier livré : mention gravée, relue par sharp, pixels intacts.
    const livre = objets.get(s3Key)!;
    const xmpLivre = (await sharp(livre).metadata()).xmp?.toString("utf8") ?? "";
    expect(xmpLivre).toContain("@awa");
    expect(xmpLivre).toContain("DMI-PROHIBITED-EXCEPTSEARCHENGINEINDEXING");
    expect(xmpLivre).not.toContain("Licence :"); // la licence n'est PAS dans le fichier de l'acheteur
    expect(await pixels(livre)).toEqual(await pixels(source));

    // La copie de référence : réduite, privée, et elle PORTE la licence.
    const reference = objets.get(cleDeReference(mediaId))!;
    expect(reference).toBeDefined();
    const metaRef = await sharp(reference).metadata();
    expect(metaRef.format).toBe("webp");
    expect(metaRef.width).toBeLessThanOrEqual(1024);
    expect((metaRef.xmp?.toString("utf8") ?? "")).toContain("Licence : Licence commerciale.");

    // Le média suit : nouvelle taille, nouveau checksum relu du stockage.
    const apres = await db.mediaAsset.findUniqueOrThrow({ where: { id: mediaId } });
    expect(apres.sizeBytes).toBe(livre.length);
    expect(apres.checksum).toBe(`etag-${livre.length}`);
  });

  it("laisse un format non gravable intact, sans copie de référence", async () => {
    const zip = Buffer.from("PK\u0003\u0004 ceci est un .zip, pas une image");
    const s3Key = `produits/p-${n + 1}/pack.zip`;
    objets.set(s3Key, zip);
    const mediaId = await mediaSource(s3Key, zip.length);

    const issue = await poserLaProvenance({
      mediaId, s3Key, taille: zip.length, contentType: "application/zip", pseudo: "awa", licenceTitre: null,
    });

    expect(issue).toEqual({ grave: false, reference: false });
    expect(objets.get(s3Key)).toEqual(zip); // intact
    expect(objets.has(cleDeReference(mediaId))).toBe(false);
  });

  it("grave même sans licence (copie de référence sans la ligne de licence)", async () => {
    const source = await png(400, 400);
    const s3Key = `produits/p-${n + 1}/sans-licence.png`;
    objets.set(s3Key, source);
    const mediaId = await mediaSource(s3Key, source.length);

    const issue = await poserLaProvenance({
      mediaId, s3Key, taille: source.length, contentType: "image/png", pseudo: "awa", licenceTitre: null,
    });

    expect(issue.grave).toBe(true);
    const refXmp = (await sharp(objets.get(cleDeReference(mediaId))!).metadata()).xmp?.toString("utf8") ?? "";
    expect(refXmp).not.toContain("Licence :");
  });
});
