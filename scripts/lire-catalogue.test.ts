import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  CATALOGUE_DEMO,
  ECARTES,
  visuelsContradictoires,
} from "@/prisma/demo-catalogue";
import {
  analyser,
  classer,
  partagerLeDossier,
  SOURCE,
} from "@/scripts/lire-catalogue.mjs";

/**
 * Le lecteur du catalogue de démonstration.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUE CE FICHIER EXISTE POUR EMPÊCHER
 *
 * `lire-catalogue.mjs` lit du TypeScript **comme du texte**, avec une
 * expression régulière. Il n'a pas le choix : deux scripts `.mjs` l'importent,
 * et node ne charge pas de TS sans chaîne de compilation.
 *
 * Un parseur par motif se trompe en silence, et celui-ci s'est trompé deux
 * fois sur ce même fichier :
 *
 *   22/09/2026  il exigeait « fichier: » ou six espaces devant le nom, donc il
 *               manquait `apercus: ["X.png"]` écrit sur une seule ligne. Il
 *               annonçait 128 citations là où il y en avait 150.
 *   23/09/2026  corrigé, il prenait TOUTE chaîne finissant par une extension
 *               d'image — bloc ECARTES compris. Il annonçait 239 catalogués là
 *               où il y en a 229 et 10 écartés.
 *
 * Les deux fois, il a rendu un nombre plausible, et le nombre a été publié.
 *
 * Le premier test ci-dessous est le seul qui adresse vraiment ce risque : il
 * compare la lecture par motif au **module TypeScript compilé**, qui est la
 * source d'autorité. Il ne suppose rien de la forme des entrées. Le jour où
 * quelqu'un écrit une entrée d'une façon à laquelle personne n'a pensé, il
 * tombe — même si aucun des trois refus ne se déclenche.
 *
 * Les autres vérifient les refus un par un, parce qu'une garde qu'on n'a pas
 * vue tomber n'est pas une garde éprouvée.
 */

describe("la lecture par motif contre le module compilé", () => {
  it("lit exactement les fichiers que CATALOGUE_DEMO déclare", async () => {
    const { catalogues } = analyser(await readFile(SOURCE, "utf8"), SOURCE);

    // La vérité : ce que le module expose, couvertures et aperçus confondus.
    const declares = new Set(
      CATALOGUE_DEMO.flatMap((e) => [e.fichier, ...(e.apercus ?? [])]),
    );

    expect(new Set(catalogues)).toEqual(declares);
  });

  it("lit exactement les fichiers qu'ECARTES déclare", async () => {
    const { ecartes } = analyser(await readFile(SOURCE, "utf8"), SOURCE);

    expect(new Set(ecartes)).toEqual(new Set(ECARTES.map((e) => e.fichier)));
  });

  it("ne mélange pas les deux ensembles", async () => {
    const { catalogues, ecartes } = analyser(await readFile(SOURCE, "utf8"), SOURCE);

    // Le défaut du 23/09 exactement : les écartés comptés parmi les
    // catalogués. Il passait le test précédent tant que les deux ensembles
    // n'étaient pas comparés l'un à l'autre.
    expect(catalogues.filter((f) => ecartes.includes(f))).toEqual([]);
  });
});

describe("les refus du lecteur", () => {
  const entree = (nom: string) =>
    `  {\n    fichier: "${nom}",\n    nom: "X",\n    famille: "ART",\n    prix: 0,\n  },\n`;

  const source = (catalogue: string, ecartes: string) =>
    `export const CATALOGUE_DEMO = [\n${catalogue}];\n\n` +
    `export const ECARTES = [\n${ecartes}];\n`;

  it("refuse une source sans marqueur ECARTES", () => {
    // Sans la coupure, tout serait « catalogué » — donc rien ne serait écarté,
    // et `medias-demo.mjs` remettrait les visuels refusés en ligne.
    expect(() => analyser(`export const CATALOGUE_DEMO = [\n${entree("a.jpg")}];\n`))
      .toThrow(/ne contient plus/);
  });

  it("refuse un fichier dont l'extension échappe à la lecture", () => {
    // `.tiff` n'est pas dans le motif. Sans ce refus, l'entrée existerait dans
    // le catalogue et serait invisible aux deux scripts : jamais téléversée,
    // jamais signalée manquante.
    expect(() => analyser(source(entree("planche.tiff"), entree("b.jpg"))))
      .toThrow(/échappe/);
  });

  it("refuse un bloc ECARTES qui déclare des entrées et n'en rend aucune", () => {
    // Le motif a cessé de correspondre : c'est le défaut du 22/09 dans
    // l'autre sens. Un bloc lu comme vide vaut « rien n'est écarté ».
    const avecEcartesIllisibles =
      `export const CATALOGUE_DEMO = [\n${entree("a.jpg")}];\n\n` +
      `export const ECARTES = [\n  { fichier: "sans-extension", raison: "x" },\n];\n`;

    expect(() => analyser(avecEcartesIllisibles)).toThrow(/échappe|cessé/);
  });

  it("accepte un bloc ECARTES réellement vide", () => {
    // La distinction qui compte : « rien de déclaré » n'est pas « déclaré et
    // illisible ». Refuser le premier interdirait de démarrer un catalogue.
    expect(analyser(source(entree("a.jpg"), "")).ecartes).toEqual([]);
  });
});

describe("les doublons de citation", () => {
  it("signale un visuel cité deux fois", () => {
    // Couverture ici, aperçu ailleurs : au seed, le second rattachement
    // écraserait le premier sans rien dire.
    const deuxFois =
      `export const CATALOGUE_DEMO = [\n` +
      `  { fichier: "a.jpg", apercus: ["b.png"] },\n` +
      `  { fichier: "c.jpg", apercus: ["b.png"] },\n` +
      `];\n\nexport const ECARTES = [\n];\n`;

    expect(analyser(deuxFois).doublons).toEqual(["b.png"]);
  });

  it("n'en signale aucun sur le catalogue réel", async () => {
    expect(analyser(await readFile(SOURCE, "utf8"), SOURCE).doublons).toEqual([]);
  });
});

describe("les deux listes ne se contredisent pas", () => {
  it("aucun visuel réel n'est catalogué ET écarté", () => {
    // La garde du seed, sur les données réelles. Elle est ici plutôt que
    // seulement dans `verif-catalogue.mjs` parce qu'une vérification qu'on
    // lance à part est une vérification qu'on saute.
    expect(visuelsContradictoires()).toEqual([]);
  });

  it("trouve la contradiction quand elle existe, couverture ou aperçu", () => {
    const catalogue = [
      { fichier: "propre.jpg", nom: "X", famille: "ART" as const, prix: 0 },
      {
        fichier: "autre.jpg",
        nom: "Y",
        famille: "ART" as const,
        prix: 0,
        apercus: ["refuse.png"],
      },
    ];

    // L'aperçu compte autant que la couverture : c'est le cas qu'une garde
    // écrite à la va-vite oublie, et il met le visuel refusé dans la galerie
    // de la fiche au lieu de sa vignette.
    expect(visuelsContradictoires(catalogue, [{ fichier: "refuse.png" }]))
      .toEqual(["refuse.png"]);
  });
});

describe("ce qui monte dans MinIO, et ce qui en sort", () => {
  const EXT = [".jpg", ".png", ".mov"];

  it("ne téléverse jamais un visuel écarté", () => {
    // Le défaut du 22-23/09 : le script prenait le dossier entier par
    // extension. Trois packshots d'une marque réelle se sont retrouvés servis
    // en lecture anonyme, sans qu'aucune fiche ne les cite.
    const { aPoser } = partagerLeDossier(
      ["propre.jpg", "cerave.jpg", "autre.png"],
      ["cerave.jpg"],
      EXT,
    );

    expect(aPoser).toEqual(["propre.jpg", "autre.png"]);
  });

  it("réclame le retrait de ce qu'un passage antérieur a mis en ligne", () => {
    // Ne plus poser ne suffit pas : les objets déjà là y restent. C'est la
    // moitié du correctif qui manquait le plus facilement.
    const { aRetirer } = partagerLeDossier(
      ["propre.jpg", "cerave.jpg"],
      ["cerave.jpg"],
      EXT,
    );

    expect(aRetirer).toEqual(["cerave.jpg"]);
  });

  it("ignore ce que le stockage ne sert pas", () => {
    // Un .txt ou un .psd dans le dossier source n'est ni posé ni retiré : il
    // n'a jamais été téléversé, et le réclamer produirait un 404 à chaque
    // passage.
    const { aPoser, aRetirer } = partagerLeDossier(
      ["notes.txt", "maquette.psd", "bon.jpg"],
      ["notes.txt"],
      EXT,
    );

    expect(aPoser).toEqual(["bon.jpg"]);
    expect(aRetirer).toEqual([]);
  });
});

describe("les trois états d'un fichier du dossier", () => {
  it("distingue la faute de frappe de la décision qui manque", () => {
    const { manquants, sansAvis, desDeux } = classer(
      ["a.jpg", "b.jpg", "c.jpg"],
      ["a.jpg", "absent.jpg"],
      ["b.jpg"],
    );

    // `absent.jpg` est cité et introuvable : faute de frappe, vignette vide.
    expect(manquants).toEqual(["absent.jpg"]);
    // `c.jpg` est dans le dossier et personne ne s'est prononcé : une question,
    // pas une faute. C'est l'ensemble que deux catégories ne pouvaient pas
    // nommer.
    expect(sansAvis).toEqual(["c.jpg"]);
    expect(desDeux).toEqual([]);
  });

  it("nomme le visuel qui est des deux côtés", () => {
    const { desDeux } = classer(["a.jpg"], ["a.jpg"], ["a.jpg"]);

    expect(desDeux).toEqual(["a.jpg"]);
  });

  it("ne compte pas un écarté parmi les sans-avis", () => {
    // Le piège inverse : un écarté n'est pas « oublié », il est décidé. Le
    // faire remonter dans la liste des questions ferait redécider chaque fois.
    expect(classer(["x.jpg"], [], ["x.jpg"]).sansAvis).toEqual([]);
  });
});
