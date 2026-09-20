/**
 * Vérifie que chaque nom de fichier du catalogue existe vraiment.
 *
 * Une faute de frappe dans `demo-catalogue.ts` ne produit aucune erreur : le
 * seed écrit une `coverUrl` vers une clé absente, MinIO rend 404, et la
 * vignette est simplement vide. Personne ne le remarque avant de regarder le
 * feed image par image.
 *
 *   node scripts/_verif-catalogue.mjs <dossier source>
 */

import { readdir, readFile } from "node:fs/promises";

const dossier = process.argv[2];
if (!dossier) {
  console.error("Usage : node scripts/_verif-catalogue.mjs <dossier>");
  process.exit(1);
}

const source = new Set(await readdir(dossier));
const brut = await readFile("prisma/demo-catalogue.ts", "utf8");

// On lit les chaînes plutôt que d'importer le module : le script est en .mjs,
// le catalogue en TypeScript, et une vérification ne vaut pas une chaîne de
// compilation.
//
// TOUTE chaîne qui finit par une extension d'image, sans se soucier de
// l'indentation ni du mot-clé qui précède. La première version exigeait
// « fichier: » ou six espaces : elle manquait les tableaux écrits sur une
// seule ligne — `apercus: ["X.png"]` — et rapportait comme non cités des
// fichiers qui l'étaient. Une vérification qui se trompe est pire que pas de
// vérification : on lui fait confiance.
const cites = [...brut.matchAll(/"([^"]+\.(?:png|jpe?g|webp|mp4|mov))"/gi)].map(
  (m) => m[1],
);

const uniques = [...new Set(cites)];
const manquants = uniques.filter((f) => !source.has(f));
const doublons = uniques.filter(
  (f) => cites.filter((c) => c === f).length > 1,
);

console.log(`Catalogue : ${uniques.length} fichiers cités, ${source.size} dans le dossier.`);

if (doublons.length > 0) {
  console.log(`\n${doublons.length} cité(s) DEUX FOIS — un visuel ne peut pas`);
  console.log(`être à la fois couverture et aperçu d'un autre produit :`);
  for (const d of doublons) console.log(`  ${d}`);
}

if (manquants.length > 0) {
  console.log(`\n${manquants.length} INTROUVABLE(S) dans le dossier :`);
  for (const m of manquants) console.log(`  ${m}`);
} else {
  console.log(`\nTous les fichiers cités existent.`);
}

const nonCites = [...source].filter((f) => !uniques.includes(f));
console.log(`\n${nonCites.length} fichier(s) du dossier non cité(s) :`);
for (const f of nonCites.sort()) console.log(`  ${f}`);

process.exit(manquants.length > 0 || doublons.length > 0 ? 1 : 0);
