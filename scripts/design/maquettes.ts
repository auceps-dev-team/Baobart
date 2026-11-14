/**
 * Lire les maquettes `Baobart Design/*.dc.html` comme du texte, et les ouvrir
 * sur l'écran voulu.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI MODIFIER L'ÉTAT DE DÉPART
 *
 * Sauf « Baobart Mobile », les maquettes ne sont pas des planches fixes : ce
 * sont des composants à état. Un clic dans le menu change `this.state`, et un
 * autre écran se dessine. Aucune ne lit de paramètre d'URL (lu dans
 * `support.js`, le 14/11/2026 : `location.search` n'y sert qu'au thème).
 *
 * Toutes résolvent en revanche leur écran par `this.state.X || this.props.X` :
 *
 *   Accueil         state.screen, state.docKey, state.open
 *   Auth            state.mode   || props.mode   || "login"
 *   Parcours Achat  state.screen || props.ecran  || "pay"
 *   Dashboard       state.role   || props.role   || "acheteur", puis state.key
 *
 * Poser la valeur dans la déclaration `state = { … }` suffit donc à ouvrir la
 * maquette sur n'importe quel écran, sans cliquer.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LE PIÈGE : LE REPLI SILENCIEUX
 *
 * Une valeur inconnue ne lève rien. Le Dashboard retombe sur la première
 * entrée du menu (`|| nav[0].key`), l'Accueil sur un écran vide. Une capture
 * « réussie » montrerait alors le mauvais écran. D'où trois gardes :
 *
 *   - `poserEtat` lève si la déclaration est introuvable ou ambiguë ;
 *   - les fonctions `ecrans…` lisent la liste des écrans DANS le source, et
 *     `maquettes.test.ts` vérifie que la table des écrans n'en invente aucun
 *     et n'en oublie aucun ;
 *   - le script de capture signale deux captures identiques au pixel près.
 */

export type ValeurEtat = string | number | boolean | null;

const DEBUT_ETAT = /(^|\n)([ \t]*)state = \{/g;

/**
 * Pose des valeurs dans la déclaration `state = { … };` de la maquette.
 *
 * Une clé déjà déclarée voit sa valeur remplacée ; une clé absente est
 * ajoutée en tête. Rien d'autre du fichier n'est touché — en particulier pas
 * les `setState({ screen: … })` des gestionnaires de clic.
 */
export function poserEtat(html: string, valeurs: Record<string, ValeurEtat>): string {
  const debuts = [...html.matchAll(DEBUT_ETAT)];
  if (debuts.length === 0) throw new Error("maquette : aucune déclaration « state = { » trouvée");
  if (debuts.length > 1) throw new Error(`maquette : ${debuts.length} déclarations « state = { », une seule attendue`);

  const ouverture = debuts[0]!.index! + debuts[0]![0].length; // juste après « { »
  const fin = html.indexOf("};", ouverture);
  if (fin === -1) throw new Error("maquette : déclaration « state = { » jamais fermée par « }; »");

  let corps = html.slice(ouverture, fin);
  const ajouts: string[] = [];

  for (const [cle, valeur] of Object.entries(valeurs)) {
    if (!/^[A-Za-z_$][\w$]*$/.test(cle)) throw new Error(`maquette : clé d'état invalide « ${cle} »`);
    const litteral = JSON.stringify(valeur);
    // Précédée de « { » (début) ou d'une virgule : `open:` ne prend pas `openMenu:`.
    const motif = new RegExp(`((?:^|,)\\s*)${cle}:\\s*(?:null|true|false|-?\\d+(?:\\.\\d+)?|"[^"\\n]*")`);
    if (motif.test(corps)) {
      corps = corps.replace(motif, `$1${cle}: ${litteral}`);
    } else {
      ajouts.push(`${cle}: ${litteral}`);
    }
  }

  const tete = ajouts.length > 0 ? ` ${ajouts.join(", ")},` : "";
  return html.slice(0, ouverture) + tete + corps + html.slice(fin);
}

/** Les propriétés déclarées par `data-props` (encodées en entités HTML). */
export function lireProps(source: string): Record<string, { options?: string[]; default?: unknown }> {
  const m = source.match(/data-props="([^"]*)"/);
  if (!m) return {};
  const json = m[1]!.replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&amp;", "&");
  return JSON.parse(json) as Record<string, { options?: string[]; default?: unknown }>;
}

/** Le texte du bloc `const NOM = …` jusqu'à sa fermeture « ]; » ou « }; » en début de ligne. */
function bloc(source: string, nom: string): string {
  const debut = source.search(new RegExp(`\\nconst ${nom} = [\\[{]`));
  if (debut === -1) throw new Error(`maquette : constante ${nom} introuvable`);
  const fin = source.slice(debut).search(/\n[\]}];/);
  if (fin === -1) throw new Error(`maquette : constante ${nom} jamais fermée`);
  return source.slice(debut, debut + fin);
}

/** Dashboard : les entrées du menu, par rôle, dans l'ordre de la maquette. */
export function menuDashboard(source: string): Record<string, { cle: string; libelle: string }[]> {
  const nav = bloc(source, "NAV");
  const roles: Record<string, { cle: string; libelle: string }[]> = {};
  let courant: string | null = null;
  for (const ligne of nav.split("\n")) {
    const role = ligne.match(/^\s{2}(\w+): \[/);
    if (role) {
      courant = role[1]!;
      roles[courant] = [];
      continue;
    }
    const entree = ligne.match(/\{ key: "([\w]+)", label: "([^"]+)"/);
    if (entree && courant) roles[courant]!.push({ cle: entree[1]!, libelle: entree[2]! });
  }
  return roles;
}

/** Dashboard : les sous-écrans atteints par onglets (`const …_TABS`), hors l'onglet parent. */
export function ongletsDashboard(source: string): { cle: string; libelle: string; parent: string }[] {
  const onglets: { cle: string; libelle: string; parent: string }[] = [];
  for (const m of source.matchAll(/\nconst \w+_TABS = (\[.*\]);/g)) {
    const paires = JSON.parse(m[1]!) as [string, string][];
    const parent = paires[0]![0];
    for (const [cle, libelle] of paires.slice(1)) onglets.push({ cle, libelle, parent });
  }
  return onglets;
}

/** Accueil : les valeurs que prend `screen`, telles que le rendu les compare. */
export function ecransAccueil(source: string): string[] {
  return [...new Set([...source.matchAll(/screen === "([a-z_]+)"/g)].map((m) => m[1]!))].sort();
}

/** Accueil : les pages de documentation du menu (`doc: "…"`). */
export function docsAccueil(source: string): string[] {
  return [...new Set([...bloc(source, "NAV").matchAll(/doc: "([a-z_]+)"/g)].map((m) => m[1]!))].sort();
}

/** Mobile : les écrans marqués `data-screen-label`, dans l'ordre. */
export function ecransMobile(source: string): string[] {
  return [...source.matchAll(/data-screen-label="([^"]+)"/g)].map((m) => m[1]!);
}
