/**
 * Régénère `lib/icones/donnees.ts` depuis les maquettes.
 *
 *     pnpm icones:generer
 *
 * À relancer après chaque versement de `Baobart Design/baobart-icons.js` ou de
 * la planche `Baobart Icons.dc.html`. Le script ne fait que lire deux fichiers
 * texte et en écrire un : rien de la maquette ne s'exécute.
 */

import { readFileSync, writeFileSync } from "node:fs";

import {
  CHEMIN_DONNEES,
  CHEMIN_PLANCHE,
  CHEMIN_SOURCE,
  genererModule,
} from "@/lib/icones/generation";

const texte = genererModule(
  readFileSync(CHEMIN_SOURCE, "utf8"),
  readFileSync(CHEMIN_PLANCHE, "utf8"),
);

writeFileSync(CHEMIN_DONNEES, texte);

const nombre = (texte.match(/^ {2}[a-zA-Z0-9]+: \{$/gm) ?? []).length;
console.log(`${CHEMIN_DONNEES} : ${nombre} icônes écrites.`);
