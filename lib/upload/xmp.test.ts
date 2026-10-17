import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { xmpDe } from "@/lib/upload/apercu";
import { gravureSansPertePossible, injecterXmp } from "@/lib/upload/xmp";

const MARQUE = "DMI-PROHIBITED-EXCEPTSEARCHENGINEINDEXING";

/** Les pixels bruts, pour prouver qu'une gravure ne les a pas touchés. */
async function pixels(image: Buffer): Promise<Buffer> {
  return sharp(image).raw().toBuffer();
}

async function imagePng(): Promise<Buffer> {
  return sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 120, b: 40 } } })
    .png()
    .toBuffer();
}

async function imageJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 30, g: 90, b: 160 } } })
    .jpeg({ quality: 92 })
    .toBuffer();
}

describe("graver du XMP sans ré-encoder l'image", () => {
  const xmp = xmpDe("awa-design", { apercu: false });

  it.each([
    ["PNG", imagePng],
    ["JPEG", imageJpeg],
  ])("grave dans un %s et laisse les pixels identiques", async (_nom, faire) => {
    const avant = await faire();
    const apres = injecterXmp(avant, xmp);

    expect(apres).not.toBeNull();
    // La métadonnée est relue par un décodeur indépendant (sharp).
    const relu = (await sharp(apres!).metadata()).xmp?.toString("utf8") ?? "";
    expect(relu).toContain(MARQUE);
    expect(relu).toContain("@awa-design");
    // Et aucun pixel n'a bougé : c'est tout l'enjeu pour un fichier vendu.
    expect(await pixels(apres!)).toEqual(await pixels(avant));
  });

  it("rend null pour un format qu'on ne grave pas sans perte", async () => {
    const webp = await sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 0, b: 0 } } })
      .webp()
      .toBuffer();
    expect(injecterXmp(webp, xmp)).toBeNull();
    expect(gravureSansPertePossible(webp)).toBe(false);
    // Et un fichier qui n'est pas une image du tout.
    expect(injecterXmp(Buffer.from("PK\u0003\u0004 pas une image"), xmp)).toBeNull();
  });

  it("reconnaît les formats gravables", async () => {
    expect(gravureSansPertePossible(await imagePng())).toBe(true);
    expect(gravureSansPertePossible(await imageJpeg())).toBe(true);
  });
});

describe("l'XMP, selon l'usage", () => {
  it("dit « aperçu » par défaut, et « Baobart » pour un fichier livré", () => {
    expect(xmpDe("awa")).toContain("aperçu Baobart");
    expect(xmpDe("awa", { apercu: false })).toContain("— Baobart.");
    expect(xmpDe("awa", { apercu: false })).not.toContain("aperçu");
  });

  it("grave la licence seulement quand on la donne (copie de référence)", () => {
    expect(xmpDe("awa", { apercu: false })).not.toContain("Licence :");
    const ref = xmpDe("awa", { apercu: false, licence: "Licence commerciale" });
    expect(ref).toContain("Licence : Licence commerciale.");
  });

  it("échappe le titre de licence", () => {
    expect(xmpDe("awa", { licence: 'a<b&"c' })).toContain("Licence : a&lt;b&amp;&quot;c.");
  });
});
