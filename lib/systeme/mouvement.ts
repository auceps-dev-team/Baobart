/**
 * Les règles de mouvement des skills Halo qui se vérifient dans le texte du code.
 *
 * Lu le 20/11/2026 dans les skills de la livraison Halo (`review-animations`,
 * standards 3 et 8 ; `mobile-native` §1 ; `animate`, « Never Ship ») :
 *
 *   - un survol qui déplace, grandit ou soulève un élément se range sous
 *     `@media (hover: hover)`. Un téléphone n'a pas de survol : le navigateur
 *     en simule un au toucher, et le laisse en place jusqu'au toucher suivant
 *     — le bouton touché reste soulevé ;
 *   - jamais `ease-in` sur l'interface : la courbe démarre lentement, au moment
 *     précis où l'on regarde ;
 *   - jamais `transition: all` : elle anime aussi ce que personne n'a voulu
 *     animer, mise en page comprise.
 *
 * Les deux dernières étaient déjà la règle d'`app/globals.css` (en-tête du
 * mouvement, livraison D1 du 13/11) ; rien ne la vérifiait.
 *
 * Ce module ne lit que du texte : pas de navigateur, pas de PostCSS (il n'est
 * pas une dépendance directe, et ces trois règles n'en demandent pas tant).
 */

export interface Ecart {
  regle: "survol-non-filtre" | "ease-in" | "transition-all" | "boucle-en-ligne";
  ou: string;
}

/** Ce qu'un survol a le droit de changer sans filtre : la couleur, le fond, une pause. Pas la géométrie. */
const BOUGE = /^(transform|translate|scale|rotate|box-shadow)$/;

const EASE_IN = /\bease-in\b(?!-)/;
const TOUT = /(^|[\s,])all\b/;

/** Les commentaires deviennent des espaces : les numéros de ligne restent justes. */
function sansCommentaires(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

function verifierCourbe(propriete: string, valeur: string, ou: string, ecarts: Ecart[]) {
  if (/^(transition|animation)(-timing-function)?$/.test(propriete) && EASE_IN.test(valeur)) {
    ecarts.push({ regle: "ease-in", ou });
  }
  if (/^transition(-property)?$/.test(propriete) && TOUT.test(valeur)) {
    ecarts.push({ regle: "transition-all", ou });
  }
}

/**
 * Parcourt une feuille de style bloc par bloc. Comprend l'imbrication (`&:hover`
 * dans un `@utility`) et les blocs `@media`, `@supports`, `@layer`.
 */
export function ecartsCss(css: string, fichier = "css"): Ecart[] {
  const texte = sansCommentaires(css);
  const ecarts: Ecart[] = [];
  const pile: string[] = [];
  let debut = 0;
  const ligne = (i: number) => texte.slice(0, i).split("\n").length;

  const declaration = (fin: number) => {
    const brut = texte.slice(debut, fin).trim();
    const m = /^([\w-]+)\s*:([\s\S]*)$/.exec(brut);
    if (!m || pile.length === 0) return;
    const [, propriete, valeur] = m as unknown as [string, string, string];
    const ou = `${fichier}:${ligne(debut + texte.slice(debut, fin).search(/\S/))} ${pile.join(" › ")} { ${propriete} }`;
    const survol = pile.some((h) => h.includes(":hover"));
    const filtre = pile.some((h) => /^@media\b[^{]*\bhover:\s*hover\b/.test(h));
    if (BOUGE.test(propriete) && survol && !filtre) ecarts.push({ regle: "survol-non-filtre", ou });
    verifierCourbe(propriete, valeur, ou, ecarts);
  };

  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (c === "{") {
      pile.push(texte.slice(debut, i).trim().replace(/\s+/g, " "));
      debut = i + 1;
    } else if (c === ";") {
      declaration(i);
      debut = i + 1;
    } else if (c === "}") {
      // La dernière déclaration d'un bloc peut se passer de point-virgule.
      declaration(i);
      pile.pop();
      debut = i + 1;
    }
  }
  return ecarts;
}

/**
 * Les styles en ligne d'un composant React : `transition: "…"`, `animation: "…"`.
 * Le survol en ligne n'existe pas (un style en ligne ne porte pas de
 * pseudo-classe) : les courbes se vérifient ici, et les boucles.
 *
 * Une boucle sans fin écrite EN LIGNE échappe aux listes de `globals.css` qui
 * arrêtent les boucles sous mouvement réduit : elles visent des classes. La
 * règle générale y raccourcit la durée à 0,01 ms sans arrêter les tours — la
 * carte flottante du héros tremblait ainsi, sans fin (mesuré le 20/11). Une
 * boucle passe donc par une classe, que la liste peut arrêter. Même chose pour
 * une boucle Tailwind (`animate-spin`, `animate-[… infinite]`) sans
 * `motion-reduce:animate-none` sur la même ligne.
 */
export function ecartsStylesEnLigne(source: string, fichier = "tsx"): Ecart[] {
  const ecarts: Ecart[] = [];
  const lignes = source.split("\n");
  // Ligne par ligne, et TOUTES les chaînes après la clé : la valeur est souvent
  // derrière une condition (`animation: i === 0 ? "floaty … infinite" : undefined`),
  // que la première version de cette garde laissait passer (20/11).
  const cle = /\b(transition|animation|transitionProperty|transitionTimingFunction|animationTimingFunction)\s*:/g;
  const chaine = /(["'`])((?:(?!\1)[^\\]|\\.)*)\1/g;
  for (const [i, ligne] of lignes.entries()) {
    if (/^\s*(\/\/|\*|\/\*)/.test(ligne)) continue; // un commentaire n'anime rien
    for (const m of ligne.matchAll(cle)) {
      const propriete = m[1]!.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`);
      const ou = `${fichier}:${i + 1} { ${m[1]} }`;
      const valeurs = [...ligne.slice(m.index! + m[0].length).matchAll(chaine)].map((c) => c[2]!);
      for (const v of valeurs) verifierCourbe(propriete, v, ou, ecarts);
      if (propriete === "animation" && valeurs.some((v) => /\binfinite\b/.test(v))) ecarts.push({ regle: "boucle-en-ligne", ou });
    }
  }
  for (const [i, ligne] of lignes.entries()) {
    // Dans `animate-[…]`, les espaces s'écrivent `_` : pas de `\b` devant `infinite`.
    const boucle = /\banimate-(spin|pulse|ping|bounce)\b|\banimate-\[[^\]]*infinite[^\]]*\]/.exec(ligne);
    if (boucle && !ligne.includes("motion-reduce:animate-none")) {
      ecarts.push({ regle: "boucle-en-ligne", ou: `${fichier}:${i + 1} { ${boucle[0]} }` });
    }
  }
  return ecarts;
}
