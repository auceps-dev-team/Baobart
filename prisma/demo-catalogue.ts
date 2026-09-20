import type { ProductFamily } from "../lib/domain/prisma-types";

/**
 * Le catalogue de démonstration.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES VISUELS VIVENT DANS MINIO, PAS DANS LE DÉPÔT
 *
 * `scripts/medias-demo.mjs` téléverse le dossier source vers le préfixe
 * `demo/` du bucket, et l'ouvre en lecture anonyme. Ce fichier ne contient que
 * des **noms de fichiers** : 985 Mo d'images n'ont rien à faire dans un dépôt
 * que l'on clone.
 *
 * La clé est dérivée du nom par `cleDemo()`, avec exactement la même règle des
 * deux côtés. Une divergence casserait toutes les couvertures d'un coup, et
 * seulement à l'affichage.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * NEUF VISUELS ONT ÉTÉ ÉCARTÉS, ET C'EST UNE DÉCISION, PAS UN OUBLI
 *
 * Le dossier source contient des marques réelles :
 *
 *   — cinq chartes graphiques d'entreprises existantes (ENGIE, INRS,
 *     IP-PARIS, CFDT, BELIEVE) ;
 *   — trois packshots du nettoyant CeraVe, produit de L'Oréal ;
 *   — un intérieur dont la fresque murale reprend des boîtes Campbell's.
 *
 * En faire des produits Baobart créerait des fiches où une créatrice fictive
 * vend la charte d'ENGIE, avec un prix, un bouton « Acheter » et une licence
 * commerciale. C'est de l'usurpation de marque — le fait que ce soit une
 * démonstration n'y change rien, parce que la base de démonstration est ce
 * qu'on montre.
 *
 * Deux des trois packshots CeraVe ne se lisaient pas dans leur nom de fichier
 * (`generation_1772732929804.jpg`). Ils n'ont été trouvés qu'en **regardant**
 * les images, sur planche-contact. C'est la raison de ce détour.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES VARIANTES DEVIENNENT DES PACKS, PAS DES FICHES
 *
 * Le dossier compte 239 fichiers pour 166 sujets : beaucoup sont des
 * déclinaisons du même prompt — six « Abstract African cityscape », quarante
 * portraits de la même série. Les publier une à une remplirait le feed de
 * quasi-doublons, ce qui ne ressemble à aucune place de marché réelle.
 *
 * On garde donc un ou deux visuels par sujet, et les séries cohérentes
 * deviennent des packs dont `apercus` porte les autres.
 */

export interface EntreeDemo {
  /** Le nom de fichier EXACT dans le dossier source. */
  fichier: string;
  nom: string;
  famille: ProductFamily;
  /**
   * En francs CFA.
   *
   * Tout le catalogue de démonstration est à zéro. Ce n'est pas une paresse de
   * jeu d'essai : un prix inventé sur une ressource qu'on n'a pas le droit de
   * vendre serait une fausse transaction, et le tunnel d'achat de la démo
   * crédite un solde qui n'existe pas. « Offert » est la seule valeur qui ne
   * ment sur rien.
   *
   * Les parcours qui ont besoin d'un prix — achat, commission, versement — ont
   * leurs propres montages : voir `e2e/fixtures/donnees.ts` et
   * `prisma/seed-demo.ts`.
   */
  prix: number;
  staffPicked?: boolean;
  /** Les autres visuels d'un pack, mêmes règles de nommage. */
  apercus?: string[];
  /** Ce que la fiche raconte. Court : la maquette en montre deux lignes. */
  note?: string;
}

/**
 * La clé MinIO d'un fichier source.
 *
 * Doit rester identique à `cleDe()` de `scripts/medias-demo.mjs`. Les deux
 * sont courtes et la duplication est assumée : partager la fonction
 * obligerait le script `.mjs` à importer du TypeScript compilé.
 */
export function cleDemo(nomFichier: string): string {
  const point = nomFichier.lastIndexOf(".");
  const ext = point === -1 ? "" : nomFichier.slice(point).toLowerCase();
  const base = point === -1 ? nomFichier : nomFichier.slice(0, point);

  const propre = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `demo/${propre}${ext}`;
}

/**
 * La clé de l'aperçu web, toujours en JPEG et large de 1400 px.
 *
 * C'est elle que porte `coverUrl`, jamais l'original : ceux-ci vont jusqu'à
 * 28 Mo, et une mosaïque qui en charge trente ne s'affiche pas.
 *
 * Les vidéos n'en ont pas — `sharp` ne les lit pas. `apercuOuOriginal()` leur
 * rend l'original, qui est petit.
 */
export function cleApercuDemo(nomFichier: string): string {
  const cle = cleDemo(nomFichier).slice("demo/".length);
  return `demo/apercu/${cle.slice(0, cle.lastIndexOf("."))}.jpg`;
}

const SANS_APERCU = [".mp4", ".mov"];

/** L'aperçu web quand il existe, l'original sinon. */
export function apercuOuOriginal(nomFichier: string): string {
  const ext = nomFichier.slice(nomFichier.lastIndexOf(".")).toLowerCase();
  return SANS_APERCU.includes(ext) ? cleDemo(nomFichier) : cleApercuDemo(nomFichier);
}

export const CATALOGUE_DEMO: EntreeDemo[] = [
  // ══════════════════════════════════════════ mode & portrait éditorial ══
  {
    fichier: "Gemini_Generated_Image_rkktlyrkktlyrkkt.png",
    nom: "Drapé blanc — série studio",
    famille: "PHOTO",
    prix: 0,
    staffPicked: true,
    note: "Noir et blanc, toile de fond et pieds apparents. Le studio ne se cache pas.",
  },
  {
    fichier: "Gemini_Generated_Image_z9nl5gz9nl5gz9nl.png",
    nom: "Tournoiement — pose longue",
    famille: "PHOTO",
    prix: 0,
    note: "Filé de mouvement sur mousseline, lumière tungstène.",
  },
  {
    fichier: "Gemini_Generated_Image_es627yes627yes62.png",
    nom: "Robe effilochée, fond toile",
    famille: "PHOTO",
    prix: 0,
  },
  {
    fichier: "Gemini_Generated_Image_338rjm338rjm338r.png",
    nom: "Épaule et lin — macro",
    famille: "PHOTO",
    prix: 0,
    note: "Détail peau et tissu. Pour une couverture ou un fond de section.",
  },
  {
    fichier: "Gemini_Generated_Image_k2wby2k2wby2k2wb.png",
    nom: "Boubou ocre, ruelle en banco",
    famille: "PHOTO",
    prix: 0,
    staffPicked: true,
    note: "Contre-jour et poussière dans une ruelle de terre.",
  },
  {
    fichier: "Generated Image February 17, 2026 - 11_05AM.png",
    nom: "Drapé orange au soleil rasant",
    famille: "PHOTO",
    prix: 0,
    staffPicked: true,
  },
  {
    fichier: "Generated Image February 17, 2026 - 4_43PM.png",
    nom: "Pied-de-poule en wagon",
    famille: "PHOTO",
    prix: 0,
    apercus: [
      "Generated Image February 17, 2026 - 4_44PM.png",
      "Generated Image February 17, 2026 - 4_44PM (1).png",
    ],
    note: "Noir et blanc, lumière de fenêtre. Deux cadrages.",
  },
  {
    fichier: "Generated Image February 17, 2026 - 4_28PM.png",
    nom: "Costume orange, filé de métro",
    famille: "PHOTO",
    prix: 0,
    apercus: [
      "Generated Image February 17, 2026 - 4_28PM (1).png",
    ],
  },
  {
    fichier: "Generated Image February 17, 2026 - 3_00PM.png",
    nom: "Polaroïds — soie bleue",
    famille: "PACK",
    prix: 0,
    apercus: [
      "Generated Image February 17, 2026 - 3_01PM.png",
      "Generated Image February 17, 2026 - 2_59PM.png",
      "Generated Image February 17, 2026 - 2_59PM (1).png",
      "Generated Image February 17, 2026 - 2_58PM.png",
      "Generated Image February 17, 2026 - 2_57PM.png",
    ],
    note: "Cinq prises, cadre polaroïd et lumière de fenêtre.",
  },
  {
    fichier: "Generated Image February 17, 2026 - 11_23AM.png",
    nom: "Mousseline en mouvement",
    famille: "PHOTO",
    prix: 0,
    apercus: [
      "Generated Image February 17, 2026 - 11_36AM.png",
      "Generated Image February 17, 2026 - 12_17PM.png",
      "Generated Image February 17, 2026 - 12_17PM (1).png",
    ],
  },
  {
    fichier: "Generated Image February 17, 2026 - 11_37AM.png",
    nom: "Cou et drapé — deux macros",
    famille: "PHOTO",
    prix: 0,
    apercus: ["Generated Image February 17, 2026 - 11_39AM.png"],
  },

  // ─────────────────────────────── la grande série beauté (40 fichiers) ──
  {
    fichier: "Striking_black_female_model_with_rich_flawless_dar_delpmaspu.png",
    nom: "Trait graphique orange",
    famille: "PHOTO",
    prix: 0,
    apercus: [
      "Striking_black_female_model_with_rich_flawless_dar_delpmaspu (1).png",
      "Striking_black_female_model_with_rich_flawless_dar_delpmaspu (2).png",
      "Striking_black_female_model_with_rich_flawless_dar_delpmaspu (3).png",
      "Striking_black_female_model_with_rich_flawless_dar_delpmaspu (4).png",
      "Striking_black_female_model_with_rich_flawless_dar_delpmaspu (5).png",
      "Striking_black_female_model_with_rich_flawless_dar_delpmaspu (6).png",
      "Striking_black_female_model_with_rich_flawless_dar_delpmaspu (7).png",
      "Striking_black_female_model_with_rich_flawless_dar_delpmaspu (8).png",
    ],
    note: "Maquillage graphique, fond sombre. Neuf variations dans le pack.",
  },
  {
    fichier: "Striking_black_female_model_with_surreal_iridescen_delpmaspu.png",
    nom: "Zébrure violette",
    famille: "ART",
    prix: 0,
    staffPicked: true,
    apercus: [
      "Striking_black_female_model_with_surreal_iridescen_delpmaspu (1).png",
      "Striking_black_female_model_with_surreal_iridescen_delpmaspu (2).png",
      "Striking_black_female_model_with_surreal_iridescen_delpmaspu (3).png",
      "Striking_black_female_model_with_surreal_iridescen_delpmaspu (4).png",
      "Striking_black_female_model_with_surreal_iridescen_delpmaspu (5).png",
      "Striking_black_female_model_with_surreal_iridescen_delpmaspu (6).png",
      "Striking_black_female_model_with_surreal_iridescen_delpmaspu (7).png",
      "Striking_black_female_model_with_surreal_iridescen_delpmaspu (8).png",
      "Striking_black_female_model_with_surreal_iridescen_delpmaspu (9).png",
      "Striking_black_female_model_with_surreal_iridescen_delpmaspu (10).png",
      "Striking_black_female_model_with_surreal_iridescen_delpmaspu (11).png",
      "Striking_black_female_model_with_surreal_iridescen_delpmaspu (12).png",
      "Striking_black_female_model_with_surreal_iridescen_delpmaspu (13).png",
    ],
    note: "Surréalisme de mode, col montant imprimé et couronne végétale.",
  },
  {
    fichier: "Striking_black_female_model_with_ultraglossy_flawl_delpmaspu.png",
    nom: "Feuille et gouttes — beauté",
    famille: "PHOTO",
    prix: 0,
    apercus: [
      "Striking_black_female_model_with_ultraglossy_flawl_delpmaspu (1).png",
      "Striking_black_female_model_with_ultraglossy_flawl_delpmaspu (2).png",
      "Striking_black_female_model_with_ultraglossy_flawl_delpmaspu (3).png",
      "Striking_black_female_model_with_ultraglossy_flawl_delpmaspu (4).png",
      "Striking_black_female_model_with_ultraglossy_flawl_delpmaspu (5).png",
      "Striking_black_female_model_with_ultraglossy_flawl_delpmaspu (6).png",
      "Striking_black_female_model_with_ultraglossy_flawl_delpmaspu (7).png",
      "Striking_black_female_model_with_ultraglossy_flawl_delpmaspu (8).png",
      "Striking_black_female_model_with_ultraglossy_flawl_delpmaspu (9).png",
      "Striking_black_female_model_with_ultraglossy_flawl_delpmaspu (10).png",
    ],
  },
  {
    fichier: "Striking_black_model_with_flawless_dark_skin_and_a_delpmaspu.png",
    nom: "Pop floral sur magenta",
    famille: "ART",
    prix: 0,
    apercus: [
      "Striking_black_model_with_flawless_dark_skin_and_a_delpmaspu (1).png",
      "Striking_black_model_with_flawless_dark_skin_and_a_delpmaspu (2).png",
      "Striking_black_model_with_flawless_dark_skin_and_a_delpmaspu (3).png",
      "Striking_black_model_with_flawless_dark_skin_and_a_delpmaspu (4).png",
      "Striking_black_model_with_flawless_dark_skin_and_a_delpmaspu (5).png",
      "Striking_black_model_with_flawless_dark_skin_and_a_delpmaspu (6).png",
      "Striking_black_model_with_flawless_dark_skin_and_a_delpmaspu (7).png",
      "Striking_black_model_with_flawless_dark_skin_and_a_delpmaspu (8).png",
      "Striking_black_model_with_flawless_dark_skin_and_a_delpmaspu (9).png",
    ],
    note: "Illustration et photo mêlées, néons et fleurs.",
  },
  {
    fichier: "A_striking_elegant_black_female_fashion_model_with_delpmaspu.png",
    nom: "Robe déchirée — studio clair",
    famille: "PHOTO",
    prix: 0,
    apercus: [
      "A_striking_elegant_black_female_fashion_model_with_delpmaspu (1).png",
      "A_striking_elegant_black_female_fashion_model_with_delpmaspu (2).png",
      "A_striking_elegant_black_female_fashion_model_with_delpmaspu (3).png",
    ],
  },
  {
    fichier: "flux-2-max-20251222_a_A_striking_elegant_B.jpeg",
    nom: "Tailleur blanc, portique nu",
    famille: "PHOTO",
    prix: 0,
    apercus: [
      "flux-2-max-20251222_a_A_striking_elegant_B (1).jpeg",
      "flux-2-max-20251222_a_A_striking_elegant_B (2).jpeg",
      "flux-2-max-20251222_a_A_striking_elegant_B (3).jpeg",
      "flux-2-max-20251222_a_A_striking_elegant_B (4).jpeg",
      "flux-2-max-20251222_a_A_striking_elegant_B (5).jpeg",
    ],
  },
  {
    fichier: "flux-2-max-20251222_a_An_extreme_close-up_.jpeg",
    nom: "Fil et épaule — très gros plan",
    famille: "PHOTO",
    prix: 0,
  },
  {
    fichier: "gpt-image-1.5-high-fidelity_a_A_striking_elegant_B.png",
    nom: "Soie bleue sur fourrure",
    famille: "PHOTO",
    prix: 0,
    apercus: [
      "gpt-image-1.5-high-fidelity_a_A_striking_elegant_B (1).png",
    ],
  },
  {
    fichier: "OIG3.VuYRGHbkCF9z5n4C3Gqt.png",
    nom: "Satin bleu, herbes de la pampa",
    famille: "PHOTO",
    prix: 0,
    apercus: [
      "OIG1._PMDEFO17.jpg",
      "Gemini_Generated_Image_tmb840tmb840tmb8.png",
    ],
  },

  // ───────────────────────────── le pack d'éclairages (22 fichiers) ──────
  {
    fichier:
      "baobartteam-jn7eat1k5jkn35h8zqjxxdjp6s81dba6-style--rembrandt-lighting-a-si.jpeg",
    nom: "Vingt-deux éclairages — lunettes & doudoune",
    famille: "PACK",
    prix: 0,
    staffPicked: true,
    apercus: [
      "baobartteam-jn7fz03ej1y60sk1w7y5av36nn81c6gw-lighting--chiaroscuro-renaissa.jpeg",
      "baobartteam-jn7f2ttd9agkg5gyaymggh72wd81cpmn-lighting--uv-blacklight-with-s.jpeg",
      "baobartteam-jn7bgz1kzym96hnntnn69c0r1d81cpr0-lighting--rainbow-gel-bathing-.jpeg",
      "baobartteam-jn7e5najsh49eegevbpn2jc5ts81c0d4-on-a-polished-black-velvet-stu.jpeg",
      "baobartteam-jn7cmfw6y7946at6m3jgfphth181cxtc-Low-angle-shot-of-a-fierce-Bla.jpeg",
      "baobartteam-jn7e0tx4yty9jq5qad7c3pdy5181ddvg-layout--vanishing-corridor-vie.jpeg",
      "baobartteam-jn797kqxb1v6xvm5wgehqeefr581deyj-monochromatic-spectral-isolati.jpeg",
      "baobartteam-jn72fz57mt07pwe0p2gq4cjybx81d5xq-EnvironmentBackground-Highend-.jpeg",
      "baobartteam-jn73zr2qgzazvcrt1cqd9gv28181cnvq-lighting--window-slat-light-wi.jpeg",
      "baobartteam-jn758jvq2fcnwwgtp1s464b0j181d6y5-a-majestic-black-woman-stands-.jpeg",
      "baobartteam-jn77g8qm1dypsnnz2zf4ykkg0d81csa9-a-profile-shot-of-a-mesmerizin.jpeg",
      "baobartteam-jn77hwexnwmk4yraaa3jax327x81ccer-soft--soft-window-light-with-g.jpeg",
      "baobartteam-jn79gzwk7vr7qn5haq7gbmanwx81cnrp-style--overexposed-glow-soft-e.jpeg",
      "baobartteam-jn7adzwjmbgh6xh2qbn8g9emf981ckfd-lighting--optical-vignetting-c.jpeg",
      "baobartteam-jn7bd7n9cb6ydcy5d5qgvb5sc181czd0-reverse-key-subtractive-lighti.jpeg",
      "baobartteam-jn7bqq1kakvsetrzkv3vgp63cs81c7fx-lighting--rembrandt-a-45degree.jpeg",
      "baobartteam-jn7bsxe99pcd2s0p2vyw58jhz181dcx6-a-hyperrealistic-image-renderi.jpeg",
      "baobartteam-jn7cqfqpnd9fyfhzbe7yfmfzzh81dqqk-in-a-magnificent-photorealisti.jpeg",
      "baobartteam-jn7dbk7g9es3nv3r53g4wr1qsd81cb98-camera-view--shadowfirst-compo.jpeg",
      "baobartteam-jn7dt1stx8ax94t8yjrb6skneh81deyk-lighting--spotlight-harsh-spot.jpeg",
      "baobartteam-jn7epyrmrt84nyc8zx554y9b4581ch1f-lighting--cinematic-bounce-fil.jpeg",
    ],
    note: "La même série sous vingt-deux lumières nommées : rembrandt, chiaroscuro, gel arc-en-ciel, UV, vignetage optique.",
  },

  // ══════════════════════════════════════════════ art & afrocubisme ══
  {
    fichier: "subject african figure.jpeg",
    nom: "Silhouette sous la pluie",
    famille: "ART",
    prix: 0,
    staffPicked: true,
    note: "Motifs découpés en silhouette, ville grise derrière.",
  },
  {
    fichier: "mosaic of interlocki.jpeg",
    nom: "Ville en mosaïque",
    famille: "ART",
    prix: 0,
    apercus: [
      "complex mosaic of interlocki.jpeg",
      "a complex-mosaic of interlocki.jpeg",
    ],
  },
  {
    fichier: "afrocubist neoexpressionist.jpeg",
    nom: "Afrocubisme — composition I",
    famille: "ART",
    prix: 0,
    apercus: ["an abstract afrocubism.jpeg", "an afrocubism and neoexpressionist.jpeg"],
  },
  {
    fichier: "deconstructed-amharicstyle.jpeg",
    nom: "Déconstruction amharique",
    famille: "ART",
    prix: 0,
  },
  {
    fichier: "an-african-woman-merges.jpeg",
    nom: "Fusion — visage et matière",
    famille: "ART",
    prix: 0,
    apercus: [
      "an-african-woman-merges (2).jpeg",
      "an-african-woman-merging.jpeg",
      "an-african-woman-merging (2).jpeg",
      "an-african-woman-wearing-a-hea.jpeg",
      "an-african-woman-wearing-a-hea (2).jpeg",
    ],
  },
  {
    fichier: "an-african-woman's-face-splits.jpeg",
    nom: "Visage scindé",
    famille: "ART",
    prix: 0,
  },
  {
    fichier: "african-woman-with-elongated.jpeg",
    nom: "Traits allongés — série",
    famille: "ART",
    prix: 0,
    apercus: [
      "african-woman-with-elongated (2).jpeg",
      "african-woman-with-elongated (3).jpeg",
      "woman-with-elongated-feature.jpeg",
      "african-woman-with elongated.jpeg",
    ],
  },
  {
    fichier: "Abstract art composition.jpeg",
    nom: "Composition abstraite",
    famille: "ART",
    prix: 0,
    apercus: [
      "abstract  art composition.jpeg",
      "Abstract art composition for living room wall.jpeg",
      "Abstract art composition for living room wall (2).jpeg",
      "Abstract art composition for living room wall (3).jpeg",
    ],
  },
  {
    fichier: "Abstract-wide-horizontal-paint.jpeg",
    nom: "Bandeau peint — format large",
    famille: "ART",
    prix: 0,
    apercus: ["Abstract-wide-horizontal-paint (2).jpeg"],
    note: "Format panoramique, pour une bannière ou un fond d'en-tête.",
  },
  {
    fichier: "vibrant-contemporary-art-pie.jpeg",
    nom: "Contemporain vif",
    famille: "ART",
    prix: 0,
  },
  {
    fichier: "Abstract artistic portrait.jpeg",
    nom: "Portrait abstrait",
    famille: "ART",
    prix: 0,
    apercus: ["Abstract artistic portrait (2).jpeg"],
  },
  {
    fichier: "an-african-woman's-silhouette.jpeg",
    nom: "Silhouette et aplats",
    famille: "ART",
    prix: 0,
  },

  // ══════════════════════════════════════════════ motifs & textiles ══
  {
    fichier: "African seamless hand drawn tribal motif pattern.jpeg",
    nom: "Motif tribal dessiné à la main",
    famille: "PACK",
    prix: 0,
    staffPicked: true,
    note: "Raccord continu. Pour l'impression textile comme pour le web.",
  },
  {
    fichier: "seamless pattern of african textile art.jpeg",
    nom: "Textile africain — raccord continu",
    famille: "PACK",
    prix: 0,
  },
  {
    fichier: "orange african culture pattern.jpeg",
    nom: "Motif orange et turquoise",
    famille: "PACK",
    prix: 0,
    apercus: ["a-dense-composition.jpeg", "dense-composition-of-interlo.jpeg"],
  },
  {
    fichier: "Ethnic border style vector seamless pattern..jpeg",
    nom: "Frises ethniques — vectoriel",
    famille: "PACK",
    prix: 0,
  },
  {
    fichier: "Hand drawn abstract seamless pattern.jpeg",
    nom: "Abstrait dessiné — raccord continu",
    famille: "PACK",
    prix: 0,
  },
  {
    fichier: "West African Fabric.jpeg",
    nom: "Pagne ouest-africain",
    famille: "PHOTO",
    prix: 0,
    note: "Offert. Texture de pagne, pour vos fonds et maquettes.",
  },

  // ══════════════════════════════════════════════ vie quotidienne ══
  {
    fichier: "scene of african people trading in a local market.jpeg",
    nom: "Marché — scène d'échange",
    famille: "PHOTO",
    prix: 0,
    apercus: [
      "close up of an african woman selling food stuff in a local african market.jpeg",
    ],
  },
  {
    fichier: "Hands of african man removing fresh potatoes from the soil..jpeg",
    nom: "Mains et terre",
    famille: "PHOTO",
    prix: 0,
  },
  {
    fichier: "Dressmaker woman working with sewing machine.jpeg",
    nom: "À la machine à coudre",
    famille: "PHOTO",
    prix: 0,
  },
  {
    fichier: "Happy african family having fun on the beach.jpeg",
    nom: "Famille à la plage",
    famille: "PHOTO",
    prix: 0,
  },
  {
    fichier: "Mother holding her daughter and kissing.jpeg",
    nom: "Mère et fille",
    famille: "PHOTO",
    prix: 0,
    apercus: ["Portrait of enjoy happy love black family african.jpeg"],
  },
  {
    fichier: "Cheerful Little African School Girl.jpeg",
    nom: "Écolière",
    famille: "PHOTO",
    prix: 0,
    apercus: ["African child saying Ok.jpeg"],
  },
  {
    fichier: "Row of group five african college students.jpeg",
    nom: "Cinq étudiants",
    famille: "PHOTO",
    prix: 0,
  },
  {
    fichier: "Group of young african american business workers.jpeg",
    nom: "Équipe au bureau",
    famille: "PHOTO",
    prix: 0,
    apercus: [
      "Young african american business man.jpeg",
      "Face of handsome african business woman.jpeg",
    ],
  },
  {
    fichier: "Traditional african food and poke bowls.jpeg",
    nom: "Cuisine — bols et plats",
    famille: "PHOTO",
    prix: 0,
  },
  {
    fichier: "Young african american woman smiling happy.jpeg",
    nom: "Sourire — portrait clair",
    famille: "PHOTO",
    prix: 0,
    apercus: [
      "Portrait of smiling woman.jpeg",
      "Young beauty african woman casual.jpeg",
      "Portrait of young african woman with hairstyle smiling.jpeg",
    ],
  },
  {
    fichier: "Black woman in stylish glasses.jpg",
    nom: "Lunettes et regard",
    famille: "PHOTO",
    prix: 0,
    apercus: ["side view of girl with stylish makeup.jpeg"],
  },
  {
    fichier: "Portrait of a young african stylish woman wearing shawl.jpeg",
    nom: "Châle et lumière douce",
    famille: "PHOTO",
    prix: 0,
    apercus: ["an african woman wearing a hea.jpeg", "a-serene-african-woman.jpeg"],
  },

  // ══════════════════════════════════════════════════════ paysages ══
  {
    fichier: "Aerial view of Cathedral Peak in Drakensberg mountains.jpeg",
    nom: "Drakensberg vu du ciel",
    famille: "PHOTO",
    prix: 0,
    staffPicked: true,
    note: "Très haute définition. Cathedral Peak, Afrique du Sud.",
  },
  {
    fichier: "Panorama silhouette tree in africa with sunset..jpeg",
    nom: "Acacia au couchant",
    famille: "PHOTO",
    prix: 0,
  },
  {
    fichier: "Panorama silhouette Animal with Giraffe family.jpeg",
    nom: "Girafes en silhouette",
    famille: "PHOTO",
    prix: 0,
  },
  {
    fichier: "Abstract African cityscape horizon.jpeg",
    nom: "Horizon urbain — six variations",
    famille: "PACK",
    prix: 0,
    apercus: [
      "Abstract African cityscape horizon (2).jpeg",
      "Abstract African cityscape horizon (3).jpeg",
      "Abstract African cityscape horizon (4).jpeg",
      "Abstract African cityscape horizon (5).jpeg",
      "Abstract African cityscape horizon2.jpeg",
      "Abstract African cityscape horizon (6).jpeg",
    ],
  },

  // ═════════════════════════════════════════ illustrations vectorielles ══
  {
    fichier: "reshot-illustration-female-freelancer.png",
    nom: "Travailler de chez soi — sept scènes",
    famille: "ILLUSTRATION",
    prix: 0,
    apercus: [
      "reshot-illustration-working-at-home.png",
      "reshot-illustration-home-office.png",
      "reshot-illustration-sending-an-email-3B74L9PMGC.png",
      "reshot-illustration-woman-working-from-home.png",
      "22e4298af243aad42783ebcb99fa4d02.webp",
      "reshot-illustration-freelancer-working-from-home-A7PK3R5BNE.png",
      "reshot-illustration-working-at-home-9T6U2SKP4V.png",
    ],
    note: "Illustrations plates, fond transparent. Pour une page d'aide ou un tunnel d'inscription.",
  },
  {
    fichier: "Group of cartoon black women in traditional headdresses.jpeg",
    nom: "Foulards — illustration",
    famille: "ILLUSTRATION",
    prix: 0,
  },
  {
    fichier: "Untitled (1).png",
    nom: "Néon et profil — quatre poses",
    famille: "ILLUSTRATION",
    prix: 0,
    staffPicked: true,
    apercus: ["Untitled (2).png", "Untitled (3).png", "Untitled (4).png"],
    note: "Silhouettes au trait lumineux sur disque orange.",
  },

  // ═══════════════════════════════════════════ flyers & mises en page ══
  {
    fichier: "Black History Month Flyer Layout.png",
    nom: "Affiche — Black History Month",
    famille: "MOCKUP",
    prix: 0,
    apercus: ["Black History Month Flyer Layout.jpg"],
  },
  {
    fichier: "Modern Retro Kwanzaa Celebration Event Flyer.png",
    nom: "Affiche Kwanzaa — rétro",
    famille: "MOCKUP",
    prix: 0,
    apercus: ["Purple Flat Design Happy Kwanzaa Flyer.png"],
  },
  {
    fichier: "Black Yellow Blue Geometric Shapes Art Exhibition Flyer.png",
    nom: "Affiche d'exposition — géométrique",
    famille: "MOCKUP",
    prix: 0,
  },
  {
    fichier: "Magazine style Bauhaus.jpg",
    nom: "Mise en page Bauhaus",
    famille: "MOCKUP",
    prix: 0,
  },
  {
    fichier: "Invoice Layout With Green Accents.png",
    nom: "Facture — modèle vert",
    famille: "MOCKUP",
    prix: 0,
    note: "Gabarit de facture. Utile aux créateurs qui facturent leurs prestations.",
  },

  // ═════════════════════════════════════════════════════════ vidéos ══
  {
    fichier: "Time lapse Dramatic golden light sunset..mov",
    nom: "Couchant accéléré",
    famille: "VIDEO",
    prix: 0,
    staffPicked: true,
  },
  {
    fichier: "High Fashion model woman.mov",
    nom: "Défilé — plan séquence",
    famille: "VIDEO",
    prix: 0,
  },
  {
    fichier: "Graceful excited cute african american teenage girls_4k.mov",
    nom: "Adolescentes — 4K",
    famille: "VIDEO",
    prix: 0,
  },
  {
    fichier: "Close up happy african mom and daughter cuddling seated on sofa..mov",
    nom: "Mère et fille — canapé",
    famille: "VIDEO",
    prix: 0,
  },
  {
    fichier: "Abstract African cityscape horizon.mp4",
    nom: "Horizon urbain — animation",
    famille: "VIDEO",
    prix: 0,
  },
  // ══════════════════════════════════ ajoutés après relecture des planches ══
  //
  // Vingt-deux sujets que la première passe avait laissés de côté. Ils ne
  // ressemblaient à rien dans leur nom de fichier : il a fallu les regarder,
  // sur planche-contact, comme les autres.
  {
    fichier: "Stylized-artistic-portrait-of-african woman.jpeg",
    nom: "Profil et damier — sérigraphie",
    famille: "ILLUSTRATION",
    prix: 0,
    staffPicked: true,
    apercus: [
      "stylized-artistic-portrait-of-african-woman.jpeg",
      "closeup-profile-of-a-stylized.jpeg",
    ],
    note: "Profil au foulard, village en aplats géométriques. Trois déclinaisons.",
  },
  {
    fichier: "a-closeup-profile-of-an-africa.jpeg",
    nom: "Profil orange, ville en bas",
    famille: "ILLUSTRATION",
    prix: 0,
    apercus: ["african figure in a modern style.jpeg"],
  },
  {
    fichier: "an-african-woman-from-the-side.jpeg",
    nom: "Foulard à spirales — profil",
    famille: "ILLUSTRATION",
    prix: 0,
    apercus: ["an-african-woman-with-elongate.jpeg"],
  },
  {
    fichier: "african figure's stylized.jpeg",
    nom: "Trait blanc sur noir",
    famille: "ILLUSTRATION",
    prix: 0,
    note: "Dessin au trait, fond noir. Se découpe bien sur une page sombre.",
  },
  {
    fichier: "Tristeza, mas acreditando na construção de uma nova esperança_ 🙌🏾🙏🏾.jpg",
    nom: "Larmes violettes — pop",
    famille: "ART",
    prix: 0,
  },
  {
    fichier: "abstract-watercolor-free-background-smartphone-wallpaper-picjumbo-com.jpeg",
    nom: "Aquarelle bleue — fond d'écran",
    famille: "ART",
    prix: 0,
    note: "Format vertical, pensé pour un écran de téléphone.",
  },
  {
    fichier: "a-delicate-rajasthani-miniatur.jpeg",
    nom: "Miniature florale",
    famille: "PACK",
    prix: 0,
  },
  {
    fichier: "artistic portrait africa women.jpeg",
    nom: "Turban sur fond noir",
    famille: "PHOTO",
    prix: 0,
  },
  {
    fichier: "african-woman-in-a-closeup-pro.jpeg",
    nom: "Turban et horizon",
    famille: "PHOTO",
    prix: 0,
  },
  {
    fichier: "copy_Portrait of young african woman with hairstyle smiling_injection.jpeg",
    nom: "Sourire — afro et perles",
    famille: "PHOTO",
    prix: 0,
  },
  {
    fichier: "full-lipped mouth of a young african woman.jpeg",
    nom: "Bouche — macro beauté",
    famille: "PHOTO",
    prix: 0,
  },
  {
    fichier: "art-photo-stylish-woman-on-bus-u.png",
    nom: "Lumière de bus",
    famille: "PHOTO",
    prix: 0,
    note: "Lumière chaude à travers une vitre. Grain assumé.",
  },
  {
    fichier: "woman-in-hat-and-sunglasses-on-a.png",
    nom: "Chapeau de paille, lunettes rondes",
    famille: "PHOTO",
    prix: 0,
  },
  {
    fichier: "high-fashion-website-background.png",
    nom: "Doudoune orange sur rouge",
    famille: "PHOTO",
    prix: 0,
    staffPicked: true,
    note: "Aplats saturés, pensé comme fond de page d'accueil.",
  },
  {
    fichier: "futuristic-studio-editorial-woman-portrait-modern-website-background-picjumbo-com.jpeg",
    nom: "Bleu et orange — profil néon",
    famille: "PHOTO",
    prix: 0,
  },
  {
    fichier: "fashion-photo-of-young-model-wit.png",
    nom: "Tailleur blanc dans le désert",
    famille: "PHOTO",
    prix: 0,
  },
  {
    fichier: "Fashion beauty portrait.jpeg",
    nom: "Volants et regard — noir et blanc",
    famille: "PHOTO",
    prix: 0,
  },
  {
    fichier: "Fashionable photo model.jpeg",
    nom: "Béret rouge, escalier de métro",
    famille: "PHOTO",
    prix: 0,
  },
  {
    fichier: "fitness-woman-in-sports-bra-free.png",
    nom: "Silhouette sportive",
    famille: "PHOTO",
    prix: 0,
  },
  {
    fichier: "young-elegant-man-studio-portrai.png",
    nom: "Portrait d'homme sur bordeaux",
    famille: "PHOTO",
    prix: 0,
  },
  {
    fichier: "Male model posing.jpeg",
    nom: "Lunettes roses, chemise rayée",
    famille: "PHOTO",
    prix: 0,
  },
  {
    fichier: "télécharger (11).jpg",
    nom: "Feuille verte — beauté nette",
    famille: "PHOTO",
    prix: 0,
    apercus: ["télécharger (12).jpg"],
    note: "Deux cadrages, fond blanc. Le nom du fichier ne disait rien ; la planche-contact, si.",
  },
  {
    fichier: "Charming and playful redhead female.jpeg",
    nom: "Sourire en t-shirt blanc",
    famille: "PHOTO",
    prix: 0,
  },
];

/**
 * Les visuels délibérément écartés, et pourquoi.
 *
 * Gardés dans le code plutôt que supprimés en silence : quelqu'un qui compte
 * 239 fichiers d'un côté et 70 produits de l'autre doit pouvoir savoir où sont
 * passés les autres, et lesquels ne reviendront jamais.
 */
export const ECARTES: Array<{ fichier: string; raison: string }> = [
  { fichier: "engie-Brand kit.jpg", raison: "charte graphique d'une entreprise réelle" },
  { fichier: "INRS-Brand kit.jpg", raison: "charte graphique d'une entreprise réelle" },
  { fichier: "IP-PARIS-2025-Brand kit.jpg", raison: "charte graphique d'une entreprise réelle" },
  { fichier: "CFDT.jpg", raison: "identité d'une organisation réelle" },
  { fichier: "BELIEVE-Brand kit.jpg", raison: "charte graphique d'une entreprise réelle" },
  {
    fichier: "Gemini_Generated_Image_buckxabuckxabuck (1).png",
    raison: "packshot CeraVe — produit de marque réelle",
  },
  {
    fichier: "generation_1772732929804.jpg",
    raison: "packshot CeraVe — trouvé en regardant, le nom ne le disait pas",
  },
  {
    fichier: "generation_1772744361442.jpg",
    raison: "packshot CeraVe — trouvé en regardant, le nom ne le disait pas",
  },
  {
    fichier: "the deconstructed.jpeg",
    raison: "fresque murale reprenant des boîtes Campbell's",
  },
];
