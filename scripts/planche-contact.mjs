/**
 * Fabrique une planche-contact numérotée à partir d'une liste de fichiers.
 *
 *   node scripts/planche-contact.mjs <dossier> <sortie.jpg> <fichier1> <fichier2> …
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL SERT À REGARDER AVANT DE NOMMER
 *
 * Écrit pour monter le catalogue de démonstration, et gardé parce que le
 * problème reviendra : un dossier de deux cents visuels dont les noms sont des
 * prompts, des empreintes ou « télécharger (12) ».
 *
 * Trois marques réelles ont été trouvées uniquement par ce moyen — deux
 * packshots CeraVe dont le nom de fichier était `generation_1772732929804.jpg`.
 * Sans planche, elles seraient devenues des produits en vente sur Baobart.
 *
 * Quatre colonnes, vignettes de 380 px, numéro en surimpression. Le numéro
 * compte : c'est lui qui permet de désigner une image sans recopier un nom de
 * quatre-vingts caractères.
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import sharp from "sharp";

const COLONNES = 4;
const VIGNETTE = 380;
const MARGE = 6;

async function vignette(chemin, numero) {
  const base = await sharp(chemin)
    .resize(VIGNETTE, VIGNETTE, { fit: "cover", position: "attention" })
    .toBuffer();

  const etiquette = Buffer.from(
    `<svg width="${VIGNETTE}" height="${VIGNETTE}">
       <rect x="0" y="0" width="64" height="44" fill="#121212"/>
       <text x="32" y="31" font-family="sans-serif" font-size="26"
             font-weight="bold" fill="#FFD84A" text-anchor="middle">${numero}</text>
     </svg>`,
  );

  return sharp(base)
    .composite([{ input: etiquette, top: 0, left: 0 }])
    .toBuffer();
}

async function main() {
  const [dossier, sortie, ...fichiers] = process.argv.slice(2);

  const vignettes = [];
  for (const [i, f] of fichiers.entries()) {
    try {
      vignettes.push(await vignette(join(dossier, f), i + 1));
    } catch (cause) {
      console.error(`  ${i + 1} illisible : ${f} — ${cause.message}`);
      // Une case noire plutôt qu'un décalage : les numéros doivent rester
      // alignés sur la liste que je lis à côté.
      vignettes.push(
        await sharp({
          create: {
            width: VIGNETTE,
            height: VIGNETTE,
            channels: 3,
            background: "#333",
          },
        })
          .png()
          .toBuffer(),
      );
    }
  }

  const lignes = Math.ceil(vignettes.length / COLONNES);
  const largeur = COLONNES * (VIGNETTE + MARGE) - MARGE;
  const hauteur = lignes * (VIGNETTE + MARGE) - MARGE;

  const composites = vignettes.map((input, i) => ({
    input,
    top: Math.floor(i / COLONNES) * (VIGNETTE + MARGE),
    left: (i % COLONNES) * (VIGNETTE + MARGE),
  }));

  const planche = await sharp({
    create: { width: largeur, height: hauteur, channels: 3, background: "#EADFF9" },
  })
    .composite(composites)
    .jpeg({ quality: 82 })
    .toBuffer();

  await writeFile(sortie, planche);
  console.log(`${vignettes.length} vignettes → ${sortie} (${largeur}×${hauteur})`);
}

main().catch((c) => {
  console.error(c);
  process.exit(1);
});
