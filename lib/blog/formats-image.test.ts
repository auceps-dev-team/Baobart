import { describe, expect, it } from "vitest";

import { FORMATS_ACCEPTES, reconnaitre } from "./formats-image";

/** Un fichier qui commence par ces octets, suivis de remplissage. */
function fichier(...octets: number[]): Uint8Array {
  return new Uint8Array([...octets, ...new Array(32).fill(0)]);
}

/** Du texte, comme un SVG en porte. */
function texte(contenu: string): Uint8Array {
  return new Uint8Array([...contenu].map((c) => c.charCodeAt(0)));
}

describe("ce qui est accepté", () => {
  it("reconnaît un PNG", () => {
    expect(reconnaitre(fichier(0x89, 0x50, 0x4e, 0x47))).toEqual({
      mime: "image/png",
      ext: "png",
    });
  });

  it("reconnaît un JPEG", () => {
    expect(reconnaitre(fichier(0xff, 0xd8, 0xff, 0xe0))?.ext).toBe("jpg");
  });

  it("reconnaît un GIF", () => {
    expect(reconnaitre(fichier(0x47, 0x49, 0x46, 0x38))?.ext).toBe("gif");
  });

  it("reconnaît un WebP", () => {
    // « RIFF » + quatre octets de taille + « WEBP ».
    const webp = new Uint8Array([
      ...texte("RIFF"),
      0, 0, 0, 0,
      ...texte("WEBP"),
      ...new Array(16).fill(0),
    ]);

    expect(reconnaitre(webp)?.ext).toBe("webp");
  });

  it("n'accepte que quatre formats, tous matriciels", () => {
    expect(FORMATS_ACCEPTES).toEqual([
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
    ]);
  });
});

describe("ce qui est refusé", () => {
  it("refuse un SVG, et c'est la raison d'être de ce module", () => {
    // Un SVG est un document XML qui peut porter un `<script>`. Servi depuis
    // notre domaine, il s'exécute avec nos droits — cookies compris. C'est une
    // faille de script inter-sites STOCKÉE : elle frappe tous les lecteurs.
    expect(reconnaitre(texte('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(reconnaitre(texte('<?xml version="1.0"?><svg>'))).toBeNull();
  });

  it("refuse un SVG même précédé d'espaces ou d'un BOM", () => {
    // Les deux façons habituelles de faire rater une détection naïve.
    expect(reconnaitre(texte('   <svg>'))).toBeNull();
    expect(reconnaitre(new Uint8Array([0xef, 0xbb, 0xbf, ...texte("<svg>")]))).toBeNull();
  });

  it("refuse un AVI, qui commence pourtant comme un WebP", () => {
    // « RIFF » sans « WEBP » : sans le second contrôle, une vidéo renommée
    // passerait pour une image.
    const avi = new Uint8Array([
      ...texte("RIFF"),
      0, 0, 0, 0,
      ...texte("AVI "),
      ...new Array(16).fill(0),
    ]);

    expect(reconnaitre(avi)).toBeNull();
  });

  it("refuse un fichier trop court pour porter une signature", () => {
    expect(reconnaitre(new Uint8Array([0x89]))).toBeNull();
    expect(reconnaitre(new Uint8Array([]))).toBeNull();
  });

  it("refuse un exécutable, un PDF et une archive", () => {
    // Trois choses qu'on pourrait renommer en `.png` pour les faire héberger
    // sous notre domaine.
    expect(reconnaitre(texte("MZ"))).toBeNull();
    expect(reconnaitre(texte("%PDF-1.7"))).toBeNull();
    expect(reconnaitre(fichier(0x50, 0x4b, 0x03, 0x04))).toBeNull();
  });

  it("ignore ce que le fichier prétend être", () => {
    // Le point central : `File.type` vient du navigateur et se falsifie en une
    // ligne. Seuls les octets décident, et ce module ne voit que les octets.
    const svgDeguise = texte("<svg onload=alert(1)>");

    expect(reconnaitre(svgDeguise)).toBeNull();
  });
});
