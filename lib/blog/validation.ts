import { slugifier } from "@/lib/products/validation";

import { adresseSure, extraitAutomatique } from "@/lib/cms/corps";

/**
 * Ce qu'un article doit être avant d'entrer en base.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * MÊME FORME QUE LES TROIS AUTRES CMS
 *
 * Une `Saisie` de chaînes brutes — ce que le formulaire envoie —, un `Verdict`
 * qui rend soit l'article prêt à écrire, soit **un** refus nommant son champ.
 *
 * Un seul refus à la fois, et c'est délibéré : une liste de sept erreurs fait
 * corriger la dernière et rater les six autres. On dit la première, et l'on
 * redemande.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE MODULE EST PUR
 *
 * Il ne sait pas si le slug est déjà pris — c'est une question de base, pas de
 * forme. `lib/blog/redaction.ts` s'en charge, et c'est la contrainte unique
 * qui tranche en dernier ressort.
 */

export interface Saisie {
  titre: string;
  corps: string;
  extrait: string;
  categorieId: string;
  couvertureUrl: string;
  seoTitre: string;
  seoDescription: string;
  urlCanonique: string;
  aLaUne: string;
  /** Format `<input type="datetime-local">` : « 2026-10-10T14:00 ». */
  parutionPrevue: string;
}

export type Champ =
  | "titre"
  | "corps"
  | "extrait"
  | "couvertureUrl"
  | "seoTitre"
  | "seoDescription"
  | "urlCanonique"
  | "parutionPrevue";

export interface Refus {
  champ: Champ;
  message: string;
}

/** L'article, une fois accepté. Prêt à écrire, sans retouche. */
export interface ArticleValide {
  titre: string;
  slug: string;
  corps: string;
  /** Déjà déduit du corps quand l'auteur n'en a pas écrit. */
  extrait: string;
  categorieId: string | null;
  couvertureUrl: string | null;
  seoTitre: string | null;
  seoDescription: string | null;
  urlCanonique: string | null;
  aLaUne: boolean;
  /** `null` quand l'auteur publiera à la main. */
  parutionPrevue: Date | null;
}

export type Verdict =
  | { ok: true; article: ArticleValide }
  | { ok: false; refus: Refus };

const TITRE_MIN = 6;
const TITRE_MAX = 140;
/**
 * Un corps d'article commence à être un article vers 200 signes.
 *
 * Plus bas que les 60 des événements, plus haut qu'un titre : un événement se
 * décrit en trois phrases, un article qui en tient trois n'est pas un article.
 */
const CORPS_MIN = 200;
const CORPS_MAX = 60_000;
/**
 * L'extrait tient sur une carte. 200 plutôt que les 160 conseillés par §4.2 :
 * le conseil vise l'aperçu des moteurs de recherche, la carte tolère un peu
 * plus, et refuser à 161 serait pénible pour un gain nul.
 */
const EXTRAIT_MAX = 200;
const SEO_TITRE_MAX = 70;
const SEO_DESCRIPTION_MAX = 320;

export function valider(saisie: Saisie): Verdict {
  const titre = saisie.titre.trim().replace(/\s+/g, " ");

  if (titre.length < TITRE_MIN) {
    return refus("titre", `Le titre fait au moins ${TITRE_MIN} caractères.`);
  }
  if (titre.length > TITRE_MAX) {
    return refus("titre", `Le titre ne dépasse pas ${TITRE_MAX} caractères.`);
  }

  const slug = slugifier(titre);
  if (slug.length === 0) {
    // Un titre fait uniquement de ponctuation ou d'emoji. Il passerait les
    // deux contrôles de longueur et donnerait une adresse vide.
    return refus(
      "titre",
      "Le titre doit contenir des lettres ou des chiffres : c'est lui qui fait l'adresse de l'article.",
    );
  }

  const corps = saisie.corps.trim();
  if (corps.length < CORPS_MIN) {
    return refus(
      "corps",
      `L'article fait au moins ${CORPS_MIN} caractères — sinon c'est une brève, et une brève se met ailleurs.`,
    );
  }
  if (corps.length > CORPS_MAX) {
    return refus("corps", `L'article ne dépasse pas ${CORPS_MAX} caractères.`);
  }

  // ── Pas de garde « le corps produit au moins un bloc » ──────────────────
  //
  // Elle a été écrite, puis retirée : elle était inatteignable. `analyser` ne
  // rend une liste vide que pour une entrée entièrement blanche, et une entrée
  // entièrement blanche a déjà été refusée par la longueur — `trim()` la
  // réduit à zéro caractère.
  //
  // Le test qui devait l'éprouver tombait sur le message de longueur, et c'est
  // ce qui l'a révélé. Un garde-fou qu'aucune entrée ne déclenche laisse croire
  // qu'il existe un cas qu'il attrape ; il vaut mieux l'écrire comme une
  // propriété du parseur, ce que fait `corps.test.ts`.
  const extraitSaisi = saisie.extrait.trim().replace(/\s+/g, " ");
  if (extraitSaisi.length > EXTRAIT_MAX) {
    return refus(
      "extrait",
      `L'extrait ne dépasse pas ${EXTRAIT_MAX} caractères — il tient sur une carte.`,
    );
  }

  const couverture = optionnelle(saisie.couvertureUrl);
  if (couverture !== null && adresseSure(couverture) === null) {
    return refus(
      "couvertureUrl",
      "L'adresse de la couverture doit commencer par https:// ou par /.",
    );
  }

  const canonique = optionnelle(saisie.urlCanonique);
  if (canonique !== null && adresseSure(canonique) === null) {
    return refus(
      "urlCanonique",
      "L'adresse canonique doit commencer par https:// ou par /.",
    );
  }

  const seoTitre = optionnelle(saisie.seoTitre);
  if (seoTitre !== null && seoTitre.length > SEO_TITRE_MAX) {
    return refus(
      "seoTitre",
      `Le titre SEO ne dépasse pas ${SEO_TITRE_MAX} caractères : au-delà, les moteurs le coupent.`,
    );
  }

  const seoDescription = optionnelle(saisie.seoDescription);
  if (seoDescription !== null && seoDescription.length > SEO_DESCRIPTION_MAX) {
    return refus(
      "seoDescription",
      `La description SEO ne dépasse pas ${SEO_DESCRIPTION_MAX} caractères.`,
    );
  }

  // ── La date de parution ─────────────────────────────────────────────────
  //
  // Lue en GMT, comme les événements : `new Date("2026-10-10T14:00")` sans
  // fuseau est interprété en heure LOCALE par Node, donc différemment sur le
  // poste d'un rédacteur et sur le serveur. On ajoute le `Z` pour que les deux
  // lisent la même heure — celle d'Abidjan, qui est GMT.
  const brutParution = saisie.parutionPrevue.trim();
  let parutionPrevue: Date | null = null;

  if (brutParution.length > 0) {
    const quand = new Date(`${brutParution}:00Z`.replace(/:00:00Z$/, ":00Z"));

    if (Number.isNaN(quand.getTime())) {
      return refus("parutionPrevue", "Cette date ne se lit pas.");
    }
    parutionPrevue = quand;
  }

  return {
    ok: true,
    article: {
      titre,
      slug,
      corps,
      // Déduit ici plutôt qu'à l'affichage : ce qu'on range est ce qu'on
      // montrera, et l'auteur peut le relire avant de publier.
      extrait: extraitSaisi.length > 0 ? extraitSaisi : extraitAutomatique(corps),
      categorieId: optionnelle(saisie.categorieId),
      couvertureUrl: couverture,
      seoTitre,
      seoDescription,
      urlCanonique: canonique,
      // Une case cochée arrive « on » ; décochée, elle n'arrive pas du tout.
      aLaUne: saisie.aLaUne.trim().length > 0,
      parutionPrevue,
    },
  };
}

function refus(champ: Champ, message: string): Verdict {
  return { ok: false, refus: { champ, message } };
}

/** Une chaîne vide est une absence, pas une valeur. */
function optionnelle(brut: string): string | null {
  const valeur = brut.trim();
  return valeur.length > 0 ? valeur : null;
}
