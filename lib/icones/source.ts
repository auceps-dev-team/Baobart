/**
 * Lire le jeu d'icônes des maquettes — sans l'exécuter.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * D'OÙ VIENNENT LES ICÔNES
 *
 * `Baobart Design/baobart-icons.js` est la source livrée avec les maquettes
 * (D1, versée le 13/11/2026). C'est un script de navigateur : il déclare un
 * élément `<bb-icon>` qui dessine par `innerHTML`. On n'en garde que les
 * tracés, lus ici comme du TEXTE — rien de ce fichier ne s'exécute, ni au
 * build, ni dans les tests.
 *
 * Chaque icône y est une ligne :
 *
 *     home: { f: '<path d="…"/>', l: '<path d="…"/>' },
 *
 *   — `f` : les formes. Elles sont dessinées DEUX fois : en aplat de couleur,
 *     décalé de 1,6 px vers le bas à droite, puis en trait noir par-dessus ;
 *   — `l` : des lignes en plus, en trait seulement.
 *
 * Les libellés français (« Accueil », « Tableau de bord »…) viennent de la
 * planche, `Baobart Design/Baobart Icons.dc.html`, tableau `CATS`.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * PLUTÔT ÉCHOUER QUE PERDRE UN MORCEAU
 *
 * Une forme que l'analyse ne reconnaît pas ne doit pas disparaître en
 * silence : l'icône se dessinerait, amputée, et personne ne le verrait. Chaque
 * chaîne est donc relue en entier — ce qui n'a pas été reconnu lève une
 * erreur. Même chose pour une ligne d'icône mal formée.
 */

/** Les quatre formes que la source emploie (mesuré le 13/11/2026). */
export type TypeForme = "path" | "circle" | "rect" | "ellipse";

/**
 * Une forme, ses attributs gardés en TEXTE et dans l'ordre de la source :
 * resérialisée, elle redonne la chaîne d'origine à l'identique — c'est ce que
 * vérifie `lib/icones/icones.test.ts`.
 */
export interface Forme {
  t: TypeForme;
  a: Readonly<Record<string, string>>;
}

export interface DefinitionIcone {
  groupe: string;
  libelle: string;
  /** `f` de la source : aplat décalé, puis trait. */
  formes: readonly Forme[];
  /** `l` de la source : trait seulement. */
  lignes: readonly Forme[];
}

export interface IconeLue {
  nom: string;
  groupe: string;
  formes: Forme[];
  lignes: Forme[];
  /** Les deux chaînes telles qu'écrites dans la source. */
  brut: { f: string; l: string };
}

const TYPES: ReadonlySet<string> = new Set(["path", "circle", "rect", "ellipse"]);

const LIGNE_ICONE = /^\s+([a-zA-Z][a-zA-Z0-9]*): \{ f: '([^']*)', l: '([^']*)' \},?\s*$/;
const COMMENTAIRE_GROUPE = /^\s+\/\/ (.+?)\s*$/;
const ELEMENT = /<([a-z]+)((?:\s+[a-zA-Z-]+="[^"]*")*)\/>/g;
const ATTRIBUT = /([a-zA-Z-]+)="([^"]*)"/g;

/** Lit une chaîne de formes SVG. Lève si un morceau n'est pas reconnu. */
export function lireFormes(chaine: string, ou: string): Forme[] {
  const formes: Forme[] = [];
  let reconnu = "";

  for (const m of chaine.matchAll(ELEMENT)) {
    const [entier, t, attributs] = m;
    if (!TYPES.has(t!)) {
      throw new Error(`${ou} : forme <${t}> inconnue — à ajouter à TypeForme, pas à ignorer.`);
    }
    const a: Record<string, string> = {};
    for (const [, nom, valeur] of attributs!.matchAll(ATTRIBUT)) {
      a[nom!] = valeur!;
    }
    formes.push({ t: t as TypeForme, a });
    reconnu += entier;
  }

  if (reconnu !== chaine) {
    throw new Error(`${ou} : une partie de « ${chaine} » n'a pas été reconnue.`);
  }
  return formes;
}

/** Remet une forme en texte, dans la syntaxe de la source. */
export function ecrireForme(f: Forme): string {
  const attributs = Object.entries(f.a)
    .map(([nom, valeur]) => ` ${nom}="${valeur}"`)
    .join("");
  return `<${f.t}${attributs}/>`;
}

/**
 * Les icônes de `baobart-icons.js`, dans l'ordre de la source.
 *
 * Seules comptent les lignes entre `const I = {` et la fermeture de l'objet :
 * le reste du fichier est le code de l'élément `<bb-icon>`.
 */
export function lireSourceIcones(texte: string): IconeLue[] {
  const lignes = texte.split(/\r?\n/);
  const debut = lignes.findIndex((l) => /^\s+const I = \{\s*$/.test(l));
  if (debut === -1) throw new Error("baobart-icons.js : objet `const I = {` introuvable.");

  const icones: IconeLue[] = [];
  let groupe = "";

  for (let i = debut + 1; i < lignes.length; i++) {
    const ligne = lignes[i]!;
    if (/^\s+\};\s*$/.test(ligne)) return icones;
    if (ligne.trim() === "") continue;

    const commentaire = COMMENTAIRE_GROUPE.exec(ligne);
    if (commentaire) {
      groupe = commentaire[1]!;
      continue;
    }

    const m = LIGNE_ICONE.exec(ligne);
    if (!m) throw new Error(`baobart-icons.js, ligne ${i + 1} : icône mal formée — « ${ligne.trim()} ».`);
    const [, nom, f, l] = m;
    icones.push({
      nom: nom!,
      groupe,
      formes: lireFormes(f!, `${nom} (f)`),
      lignes: lireFormes(l!, `${nom} (l)`),
      brut: { f: f!, l: l! },
    });
  }

  throw new Error("baobart-icons.js : l'objet des icônes ne se ferme pas.");
}

/**
 * Les libellés de la planche : `nom → { groupe, libelle }`.
 *
 * Tableau `CATS` de `Baobart Icons.dc.html`, une entrée par groupe :
 * `['Navigation', 'home:Accueil|dashboard:Tableau de bord|…']`.
 */
export function lireLibellesPlanche(html: string): Map<string, { groupe: string; libelle: string }> {
  const bloc = /const CATS = \[([\s\S]*?)\n\s*\];/.exec(html);
  if (!bloc) throw new Error("Baobart Icons.dc.html : tableau `CATS` introuvable.");

  const libelles = new Map<string, { groupe: string; libelle: string }>();
  for (const [, groupe, liste] of bloc[1]!.matchAll(/\['([^']+)', '((?:[^'\\]|\\.)*)'\]/g)) {
    for (const paire of liste!.replace(/\\'/g, "'").split("|")) {
      const [nom, libelle] = paire.split(":");
      if (!nom || !libelle) throw new Error(`Baobart Icons.dc.html : entrée « ${paire} » mal formée.`);
      libelles.set(nom, { groupe: groupe!, libelle });
    }
  }
  return libelles;
}
