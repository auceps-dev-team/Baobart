/**
 * Les deux listes de `prisma/demo-catalogue.ts` : ce qui est catalogué, et ce
 * qui est écarté.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI UN SEUL LECTEUR
 *
 * Deux scripts ont besoin de ces listes — la vérification et le téléversement.
 * Chacun les relisait à sa façon, ou pas du tout :
 *
 *   - `verif-catalogue.mjs` prenait toute chaîne finissant par une extension
 *     d'image, donc comptait les dix écartés parmi les « cités » ;
 *   - `medias-demo.mjs` ne lisait rien et téléversait le dossier entier, donc
 *     mettait les écartés en ligne.
 *
 * Deux lectures d'une même source finissent toujours par diverger. Celle-ci
 * est la seule.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON LIT DU TEXTE, ET C'EST UN COMPROMIS QU'IL FAUT PAYER
 *
 * Le catalogue est en TypeScript, ces scripts en `.mjs`, et node n'importe pas
 * du TS sans chaîne de compilation. Une vérification qui exige un build ne se
 * lance pas, donc on lit la source comme du texte.
 *
 * Le prix est qu'un parseur par expression régulière **se trompe en silence**.
 * Celui-ci s'est déjà trompé deux fois sur ce même fichier — une fois en
 * manquant les tableaux d'une seule ligne, une fois en comptant les écartés
 * comme catalogués. Les deux fois, il a rendu un nombre, et le nombre a été
 * cru.
 *
 * D'où la règle ici : **toute anomalie de structure arrête le script**. Mieux
 * vaut un parseur qui refuse de répondre qu'un parseur qui répond à côté.
 */

import { readFile } from "node:fs/promises";

const SOURCE = "prisma/demo-catalogue.ts";
const MARQUEUR_ECARTES = "export const ECARTES";

/** Toute chaîne entre guillemets finissant par une extension servie. */
const NOM_DE_FICHIER = /"([^"]+\.(?:png|jpe?g|webp|mp4|mov))"/gi;

/** La même, précédée de la clé `fichier:` — un par entrée, exactement. */
const CLE_FICHIER = /fichier:\s*"([^"]+)"/g;

function noms(texte) {
  return [...texte.matchAll(NOM_DE_FICHIER)].map((m) => m[1]);
}

/**
 * Lit les deux listes, ou refuse.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LES TROIS REFUS
 *
 * Ils ne sont pas décoratifs : chacun correspond à une façon dont ce parseur
 * pourrait rendre un résultat faux sans le dire.
 *
 *   1. Le marqueur `ECARTES` absent — le fichier a été renommé ou restructuré.
 *      Sans lui, tout est « catalogué », et les écartés remontent en ligne.
 *   2. Un `fichier:` dont le nom n'a pas été capté — l'extension est inconnue
 *      de `NOM_DE_FICHIER`. Ce fichier existerait dans le catalogue et serait
 *      invisible aux deux scripts.
 *   3. Zéro écarté alors que le bloc en déclare — l'expression a cessé de
 *      correspondre. C'est exactement le défaut de septembre, dans l'autre
 *      sens.
 */
export async function lireLesDeuxListes() {
  const brut = await readFile(SOURCE, "utf8");

  const coupure = brut.indexOf(MARQUEUR_ECARTES);
  if (coupure === -1) {
    throw new Error(
      `${SOURCE} ne contient plus « ${MARQUEUR_ECARTES} ». Sans cette ` +
        `coupure, impossible de distinguer catalogué et écarté — et un ` +
        `visuel écarté remonterait en ligne sans rien signaler.`,
    );
  }

  const partieCatalogue = brut.slice(0, coupure);
  const partieEcartes = brut.slice(coupure);

  // Avant dédoublonnage : c'est la répétition elle-même qu'on veut pouvoir
  // signaler. Un visuel ne peut pas être la couverture d'un produit et
  // l'aperçu d'un autre — le second écraserait le premier au seed.
  const citations = noms(partieCatalogue);

  const catalogues = [...new Set(citations)];
  const ecartes = [...new Set(noms(partieEcartes))];

  const doublons = catalogues.filter(
    (f) => citations.filter((c) => c === f).length > 1,
  );

  // Refus n° 2 : chaque `fichier:` doit avoir été capté par ailleurs.
  for (const [texte, liste, ou] of [
    [partieCatalogue, catalogues, "le catalogue"],
    [partieEcartes, ecartes, "les écartés"],
  ]) {
    for (const [, nom] of texte.matchAll(CLE_FICHIER)) {
      if (!liste.includes(nom)) {
        throw new Error(
          `« ${nom} » est déclaré dans ${ou} mais son extension échappe à ` +
            `la lecture. Ajouter l'extension à NOM_DE_FICHIER, sinon ce ` +
            `fichier restera invisible aux deux scripts.`,
        );
      }
    }
  }

  // Refus n° 3 : le bloc déclare des entrées, la lecture n'en trouve aucune.
  const declares = [...partieEcartes.matchAll(CLE_FICHIER)].length;
  if (declares > 0 && ecartes.length === 0) {
    throw new Error(
      `Le bloc ECARTES déclare ${declares} entrée(s) et la lecture n'en ` +
        `trouve aucune. L'expression régulière a cessé de correspondre.`,
    );
  }

  return { catalogues, ecartes, doublons };
}
