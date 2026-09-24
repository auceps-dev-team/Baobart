/**
 * Les types de `lire-catalogue.mjs`.
 *
 * Le module reste en JavaScript parce que deux scripts `.mjs` l'importent et
 * que node ne charge pas de TypeScript sans chaîne de compilation. Cette
 * déclaration existe pour que son test, lui, soit écrit en TypeScript comme
 * tous les autres.
 *
 * Elle est écrite à la main, donc elle peut mentir. Ce qui l'en empêche :
 * `lire-catalogue.test.ts` appelle réellement ces fonctions et compare leur
 * résultat au module TypeScript. Une déclaration fausse ferait tomber le test,
 * pas passer le typecheck en silence.
 */

export declare const SOURCE: string;

export interface DeuxListes {
  /** Tout fichier nommé par une entrée du catalogue — couverture et aperçus. */
  catalogues: string[];
  /** Tout fichier nommé par ECARTES. */
  ecartes: string[];
  /** Ceux que le catalogue cite plus d'une fois. */
  doublons: string[];
}

/** Sépare et lit un contenu déjà chargé. Lève sur anomalie de structure. */
export declare function analyser(brut: string, ou?: string): DeuxListes;

/** `analyser`, sur `SOURCE`. */
export declare function lireLesDeuxListes(): Promise<DeuxListes>;

/** Ce qu'on téléverse d'un dossier, et ce qu'on en retire. */
export declare function partagerLeDossier(
  noms: string[],
  ecartes: string[],
  extensionsServies: string[],
): { aPoser: string[]; aRetirer: string[] };

/** Les trois états d'un fichier du dossier, plus les deux anomalies. */
export declare function classer(
  noms: string[],
  catalogues: string[],
  ecartes: string[],
): { manquants: string[]; desDeux: string[]; sansAvis: string[] };
