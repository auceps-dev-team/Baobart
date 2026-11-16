/**
 * Fabrique la matière de téléversement du QA : des fichiers honnêtes, et des
 * fichiers qui mentent sur ce qu'ils sont.
 *
 *   node qa/fabriquer-fichiers.mjs <dossier de sortie>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";

const sortie = process.argv[2];
if (!sortie) throw new Error("Donner le dossier de sortie.");
mkdirSync(sortie, { recursive: true });
const ecrire = (nom, contenu) => {
  writeFileSync(join(sortie, nom), contenu);
  console.log(`${nom.padEnd(48)} ${contenu.length} octets`);
};

// ── Honnêtes ────────────────────────────────────────────────────────────────
const motif = (l, h, teinte) =>
  sharp({
    create: { width: l, height: h, channels: 3, background: teinte },
  }).composite([
    {
      input: Buffer.from(
        `<svg width="${l}" height="${h}" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="p" width="80" height="80" patternUnits="userSpaceOnUse"><circle cx="40" cy="40" r="26" fill="#f2b705"/><path d="M0 0L80 80M80 0L0 80" stroke="#0b3d2e" stroke-width="6"/></pattern></defs><rect width="100%" height="100%" fill="url(#p)"/></svg>`,
      ),
    },
  ]);

ecrire("motif-wax-01.jpg", await motif(2400, 1600, "#c8102e").jpeg({ quality: 88 }).toBuffer());
ecrire("motif-wax-02.png", await motif(1600, 1600, "#1b4d8c").png().toBuffer());
ecrire("avatar-awa.jpg", await motif(600, 600, "#7a3e9d").jpeg({ quality: 85 }).toBuffer());
ecrire("portrait-etroit.jpg", await motif(300, 2400, "#0b3d2e").jpeg().toBuffer());
ecrire("minuscule-1px.png", await sharp({ create: { width: 1, height: 1, channels: 3, background: "#fff" } }).png().toBuffer());
// Une image aux dimensions énormes mais légère : la « bombe » de décompression.
ecrire(
  "geante-20000px.png",
  await sharp({ create: { width: 20000, height: 20000, channels: 3, background: "#000" }, limitInputPixels: false }).png({ compressionLevel: 9 }).toBuffer(),
);
// Un PDF minimal mais valide.
ecrire(
  "licence.pdf",
  Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
  ),
);

// ── Menteurs ────────────────────────────────────────────────────────────────
const html = `<!doctype html><html><body><script>document.title="XSS-QA";fetch("/api/qa-xss-"+document.cookie)</script><h1>pas une image</h1></body></html>`;
ecrire("page-deguisee.png", Buffer.from(html));
ecrire("page-deguisee.jpg", Buffer.from(html));
ecrire("script.html", Buffer.from(html));
ecrire(
  "vecteur-piege.svg",
  Buffer.from(
    `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" onload="document.title='XSS-SVG-QA'"><script>document.title='XSS-SVG-QA'</script><rect width="200" height="200" fill="red"/><foreignObject width="200" height="200"><body xmlns="http://www.w3.org/1999/xhtml"><img src="x" onerror="document.title='XSS-SVG-QA'"/></body></foreignObject></svg>`,
  ),
);
// Un exécutable Windows (en-tête MZ) rebaptisé en archive et en image.
const mz = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(1022, 0x90)]);
ecrire("installeur.exe", mz);
ecrire("pack-motifs.zip", mz);
ecrire("photo.jpg.exe", mz);
// Vide.
ecrire("vide.zip", Buffer.alloc(0));
ecrire("vide.png", Buffer.alloc(0));
// Une vraie image dont le nom ment ou attaque.
const petite = await motif(400, 300, "#f2b705").png().toBuffer();
ecrire("image-sans-extension", petite);
ecrire("image.png.php", petite);
ecrire("émoji 🎨 & espaces (final) v2.png", petite);
ecrire(`${"a".repeat(230)}.png`, petite);
// Windows refuse « " < > » dans un nom : les noms qui portent du balisage sont
// donnés au navigateur en mémoire (setInputFiles avec { name, buffer }).
ecrire("apostrophe' & esperluette.png", petite);
// Polyglotte : une image valide suivie de HTML.
ecrire("polyglotte.png", Buffer.concat([petite, Buffer.from(html)]));
// Une archive ZIP valide et minuscule (un fichier vide dedans).
ecrire(
  "vraie-archive.zip",
  Buffer.from(
    "504b03040a0000000000000021000000000000000000000000000500000061" +
      "2e747874504b01021400" +
      "0a00000000000000210000000000000000000000000005000000000000000000000000000000000061" +
      "2e747874504b050600000000010001003300000023000000" +
      "0000",
    "hex",
  ),
);
