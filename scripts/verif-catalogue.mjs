/**
 * Vérifie que le catalogue de démonstration et le dossier source se
 * correspondent.
 *
 *   node scripts/verif-catalogue.mjs <dossier source>
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUE CE SCRIPT ATTRAPE, ET POURQUOI IL EXISTE
 *
 * Une faute de frappe dans `demo-catalogue.ts` ne produit aucune erreur : le
 * seed écrit une `coverUrl` vers une clé absente, MinIO rend 404, et la
 * vignette est simplement vide. Personne ne le remarque avant de regarder le
 * feed image par image.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TROIS ENSEMBLES, PAS DEUX — ET LES CONFONDRE A DÉJÀ COÛTÉ DEUX FOIS
 *
 * Un fichier du dossier est dans l'un de trois états, et seul le troisième
 * mérite qu'on le regarde :
 *
 *   catalogué   il a une entrée, il s'affichera ;
 *   écarté      on a décidé de ne pas le prendre, avec la raison écrite ;
 *   ni l'un ni l'autre   personne ne s'est prononcé — c'est ça, l'oubli.
 *
 * Les deux premières versions de ce script n'en connaissaient que deux, et se
 * sont trompées dans les deux sens :
 *
 *   22/09  « 128 cités, 111 non cités »   l'expression manquait les tableaux
 *          d'une seule ligne, donc sous-comptait les citations ;
 *   23/09  « 239 cités, 239 dans le dossier »   elle prenait tout le fichier,
 *          bloc ECARTES compris, donc comptait les dix écartés comme
 *          catalogués. Le vrai nombre de catalogués est 229.
 *
 * Les deux fois, le nombre a été publié avant qu'on s'aperçoive de rien. Une
 * vérification qui se trompe est pire qu'aucune : on lui fait confiance.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL REFUSE AUSSI QU'UN FICHIER SOIT DANS LES DEUX LISTES
 *
 * `ECARTES` n'était jusqu'ici qu'un commentaire exécutable : le seed en
 * affichait la longueur, rien ne s'en servait. Un passage suivant pouvait
 * remettre au catalogue un visuel écarté pour marque réelle — les deux listes
 * se seraient contredites sans que rien ne le dise.
 */

import { readdir } from "node:fs/promises";

import { classer, lireLesDeuxListes } from "./lire-catalogue.mjs";

const dossier = process.argv[2];
if (!dossier) {
  console.error("Usage : node scripts/verif-catalogue.mjs <dossier>");
  process.exit(1);
}

const source = new Set(await readdir(dossier));
const { catalogues, ecartes, doublons } = await lireLesDeuxListes();

console.log(
  `Catalogue : ${catalogues.length} catalogués · ${ecartes.length} écartés · ` +
    `${source.size} fichiers dans le dossier.`,
);

let faute = false;

const { manquants, desDeux, sansAvis } = classer(
  [...source],
  catalogues,
  ecartes,
);

// ── Le même visuel des deux côtés ──────────────────────────────────────────
if (desDeux.length > 0) {
  faute = true;
  console.log(
    `\n${desDeux.length} fichier(s) À LA FOIS catalogué(s) ET écarté(s).`,
  );
  console.log(`Un visuel écarté a une raison écrite : la lire avant de trancher.`);
  for (const f of desDeux) console.log(`  ${f}`);
}

// ── Cité mais absent du dossier ─────────────────────────────────────────────
if (manquants.length > 0) {
  faute = true;
  console.log(`\n${manquants.length} INTROUVABLE(S) dans le dossier :`);
  for (const m of manquants) console.log(`  ${m}`);
} else {
  console.log(`\nTous les fichiers catalogués existent dans le dossier.`);
}

// ── Le même visuel cité deux fois ───────────────────────────────────────────
if (doublons.length > 0) {
  faute = true;
  console.log(`\n${doublons.length} visuel(s) cité(s) DEUX FOIS dans le catalogue.`);
  console.log(`Un visuel ne peut pas être couverture ici et aperçu ailleurs :`);
  for (const d of doublons) console.log(`  ${d}`);
}

// ── Ni catalogué ni écarté : le seul cas qui demande une décision ───────────
if (sansAvis.length === 0) {
  console.log(`\nChaque fichier du dossier est soit catalogué, soit écarté.`);
} else {
  console.log(
    `\n${sansAvis.length} fichier(s) sur lesquels personne ne s'est prononcé.`,
  );
  console.log(`Les cataloguer, ou les écarter AVEC leur raison :`);
  for (const f of sansAvis.sort()) console.log(`  ${f}`);
}

process.exit(faute ? 1 : 0);
