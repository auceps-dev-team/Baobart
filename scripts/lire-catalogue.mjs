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
 * ON LIT DU TEXTE, ET VOICI CE QUI PAIE CE COMPROMIS
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
 * Deux choses le paient, et il faut les deux :
 *
 *   1. **Il refuse plutôt que de répondre à côté.** Trois anomalies de
 *      structure l'arrêtent — voir `analyser`. Elles couvrent ce qu'on a su
 *      prévoir.
 *   2. **Un test le compare au vrai module.** `scripts/lire-catalogue.test.ts`
 *      importe `CATALOGUE_DEMO` et `ECARTES` — le TypeScript compilé, donc la
 *      source d'autorité — et exige l'égalité, ensemble par ensemble. C'est
 *      ce qui couvre ce qu'on n'a PAS su prévoir : le jour où une entrée prend
 *      une forme à laquelle personne n'a pensé, le test tombe, même si aucun
 *      des trois refus ne se déclenche.
 *
 * Sans le point 2, le point 1 ne vaut que par l'imagination de qui l'a écrit —
 * et c'est exactement ce qui a manqué les deux premières fois.
 */

import { readFile } from "node:fs/promises";

export const SOURCE = "prisma/demo-catalogue.ts";

const MARQUEUR_ECARTES = "export const ECARTES";

/** Toute chaîne entre guillemets finissant par une extension servie. */
const NOM_DE_FICHIER = /"([^"]+\.(?:png|jpe?g|webp|mp4|mov))"/gi;

/** La même, précédée de la clé `fichier:` — un par entrée, exactement. */
const CLE_FICHIER = /fichier:\s*"([^"]+)"/g;

function noms(texte) {
  return [...texte.matchAll(NOM_DE_FICHIER)].map((m) => m[1]);
}

/**
 * Sépare et lit, ou refuse. Pure : elle ne touche pas au disque.
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
 *
 * Elle est séparée de la lecture de fichier pour une seule raison : un refus
 * qu'on ne peut pas provoquer dans un test est un refus qu'on n'a jamais vu
 * tomber.
 */
export function analyser(brut, ou = SOURCE) {
  const coupure = brut.indexOf(MARQUEUR_ECARTES);
  if (coupure === -1) {
    throw new Error(
      `${ou} ne contient plus « ${MARQUEUR_ECARTES} ». Sans cette ` +
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
  for (const [texte, liste, endroit] of [
    [partieCatalogue, catalogues, "le catalogue"],
    [partieEcartes, ecartes, "les écartés"],
  ]) {
    for (const [, nom] of texte.matchAll(CLE_FICHIER)) {
      if (!liste.includes(nom)) {
        throw new Error(
          `« ${nom} » est déclaré dans ${endroit} mais son extension échappe ` +
            `à la lecture. Ajouter l'extension à NOM_DE_FICHIER, sinon ce ` +
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

/** `analyser`, sur le fichier réel. */
export async function lireLesDeuxListes() {
  return analyser(await readFile(SOURCE, "utf8"), SOURCE);
}

/**
 * Ce qu'on téléverse d'un dossier, et ce qu'on en retire.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DEUX SORTIES, PARCE QUE NE PLUS POSER NE SUFFIT PAS
 *
 * `aPoser` est ce que la version d'avant calculait de travers : elle prenait
 * le dossier entier, sans consulter les écartés.
 *
 * `aRetirer` est ce qu'elle ne calculait pas du tout. Une MinIO sur laquelle
 * l'ancienne version a tourné garde les objets ; s'arrêter de les poser les y
 * laisse pour toujours. Mesuré le 24/09/2026 : dix originaux et neuf aperçus
 * servis en lecture anonyme, à une URL dérivée du nom, donc devinable.
 *
 * Elle est ici plutôt que dans `medias-demo.mjs` pour une seule raison : dans
 * ce script, elle serait entourée d'appels réseau et ne pourrait pas être
 * rejouée. Une décision qu'on ne peut pas rejouer est une décision qu'on ne
 * vérifie qu'en production.
 */
export function partagerLeDossier(noms, ecartes, extensionsServies) {
  const refuses = new Set(ecartes);
  const servables = noms.filter((f) =>
    extensionsServies.includes(f.slice(f.lastIndexOf(".")).toLowerCase()),
  );

  return {
    aPoser: servables.filter((f) => !refuses.has(f)),
    aRetirer: servables.filter((f) => refuses.has(f)),
  };
}

/**
 * Les trois états d'un fichier du dossier, plus les deux anomalies.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TROIS ENSEMBLES, PAS DEUX
 *
 * Catalogué, écarté, ou **sans avis** : personne ne s'est prononcé. Seul le
 * troisième demande une décision, et c'est celui que deux ensembles ne
 * pouvaient pas nommer — d'où « 239 cités, 239 dans le dossier », qui
 * annonçait une couverture complète en comptant les écartés parmi les
 * catalogués.
 *
 * `manquants` et `desDeux` sont des fautes ; `sansAvis` est une question.
 * Les mélanger dans un même compte les rend tous les trois illisibles.
 */
export function classer(noms, catalogues, ecartes) {
  const dansLeDossier = new Set(noms);

  return {
    /** Cités par le catalogue, absents du dossier : faute de frappe. */
    manquants: catalogues.filter((f) => !dansLeDossier.has(f)),
    /** Des deux côtés : une décision prise deux fois en sens contraire. */
    desDeux: catalogues.filter((f) => ecartes.includes(f)),
    /** Ni l'un ni l'autre : le seul cas qui demande qu'on tranche. */
    sansAvis: noms.filter(
      (f) => !catalogues.includes(f) && !ecartes.includes(f),
    ),
  };
}
