import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { dimensionsImage, reconnaitreMedia } from "@/lib/publicites/formats";

const octets = (...parts: (number[] | string)[]) =>
  Uint8Array.from(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));

describe("les médias acceptés", () => {
  it("reconnaît une vidéo MP4 et une vidéo WebM à leurs premiers octets", () => {
    expect(reconnaitreMedia(octets([0, 0, 0, 0x20], "ftypisom"))?.mime).toBe("video/mp4");
    expect(reconnaitreMedia(octets([0x1a, 0x45, 0xdf, 0xa3, 0x9f]))?.mime).toBe("video/webm");
  });

  it("refuse un QuickTime, un SVG et un fichier inconnu", () => {
    expect(reconnaitreMedia(octets([0, 0, 0, 0x14], "ftypqt  "))).toBeNull();
    expect(reconnaitreMedia(octets("<svg xmlns='http://www.w3.org/2000/svg'>"))).toBeNull();
    expect(reconnaitreMedia(octets("MZ\x90\x00"))).toBeNull();
  });

  it("reconnaît une image comme le blog", () => {
    expect(reconnaitreMedia(octets([0x89], "PNG\r\n"))).toMatchObject({ nature: "IMAGE", mime: "image/png" });
  });
});

describe("les dimensions d'une image", () => {
  it("lit un PNG", () => {
    const png = octets([0x89], "PNG\r\n\x1a\n", [0, 0, 0, 13], "IHDR", [0, 0, 0x04, 0xb0], [0, 0, 0x02, 0x58]);
    expect(dimensionsImage(png)).toEqual({ largeur: 1200, hauteur: 600 });
  });

  it("lit un GIF", () => {
    expect(dimensionsImage(octets("GIF89a", [0x2c, 0x01, 0xfa, 0x00]))).toEqual({ largeur: 300, hauteur: 250 });
  });

  it("lit un WebP étendu", () => {
    const webp = octets("RIFF", [0, 0, 0, 0], "WEBP", "VP8X", [10, 0, 0, 0], [0, 0, 0, 0], [0xff, 0x03, 0], [0x57, 0x02, 0]);
    expect(dimensionsImage(webp)).toEqual({ largeur: 1024, hauteur: 600 });
  });

  it("lit de vrais JPEG progressifs, segments EXIF et tables compris", () => {
    // Mesuré le 03/10 avec `file` : 1024x1009 et 736x880.
    const dossier = join(process.cwd(), "public/img/demo");
    expect(dimensionsImage(readFileSync(join(dossier, "affiche-rue.jpg")))).toEqual({ largeur: 1024, hauteur: 1009 });
    expect(dimensionsImage(readFileSync(join(dossier, "beaute-afro.jpg")))).toEqual({ largeur: 736, hauteur: 880 });
  });

  describe("l'orientation EXIF d'une photo de téléphone", () => {
    // Un JPEG minimal : un segment EXIF, puis une trame de 1200 × 600.
    const jpeg = (exif: number[]) =>
      octets(
        [0xff, 0xd8, 0xff, 0xe1, 0, exif.length + 2], exif,
        [0xff, 0xc0, 0, 0x11, 8, 0x02, 0x58, 0x04, 0xb0, 3], Array.from({ length: 12 }, () => 0),
      );
    const exifIntel = (o: number) => [...octets("Exif\0\0II"), 0x2a, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, o, 0, 0, 0, 0, 0, 0, 0];
    const exifMotorola = (o: number) => [...octets("Exif\0\0MM"), 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, o, 0, 0, 0, 0, 0, 0];

    it("échange largeur et hauteur d'une photo tournée d'un quart de tour", () => {
      // Avant v1.71.3 : { largeur: 1200, hauteur: 600 }, l'inverse de ce que
      // le navigateur affiche.
      expect(dimensionsImage(jpeg(exifIntel(6)))).toEqual({ largeur: 600, hauteur: 1200 });
      expect(dimensionsImage(jpeg(exifMotorola(8)))).toEqual({ largeur: 600, hauteur: 1200 });
    });

    it("garde le sens quand la photo est droite ou retournée", () => {
      expect(dimensionsImage(jpeg(exifIntel(1)))).toEqual({ largeur: 1200, hauteur: 600 });
      expect(dimensionsImage(jpeg(exifMotorola(3)))).toEqual({ largeur: 1200, hauteur: 600 });
    });
  });

  it("rend null quand l'entête est tronquée", () => {
    expect(dimensionsImage(octets([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]))).toBeNull();
    expect(dimensionsImage(octets("<svg>"))).toBeNull();
  });
});
