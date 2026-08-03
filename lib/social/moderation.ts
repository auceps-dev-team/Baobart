/**
 * Signalement automatique des commentaires.
 *
 * Reprend la technique de `adult_keyword_detector.rb` — normaliser, découper
 * en mots, comparer — sans reprendre sa liste, qui vise le contenu adulte d'un
 * catalogue anglophone. Sur un fil de commentaires, le tort concret est
 * l'insulte adressée à un créateur sur sa propre vitrine.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SIGNALER, PAS SUPPRIMER
 *
 * Une liste de mots est un instrument grossier : « con » est une insulte, une
 * commune de l'Ariège et le début de « conception ». Bloquer sur cette base
 * ferait taire des gens de bonne foi et donnerait à la plateforme un pouvoir
 * qu'elle exerce mal. On marque, le créateur tranche — il a déjà le droit de
 * retirer ce qui est déposé chez lui.
 *
 * La normalisation est ce qui fait le travail. Sans elle, « c.o.n.n.a.r.d » et
 * « CoNNaRd » passent, et la liste ne sert qu'à attraper les distraits.
 */

/**
 * Mots qui déclenchent un signalement.
 *
 * Volontairement court. Une liste longue attrape surtout des innocents, et
 * chaque faux signalement use l'attention du créateur jusqu'à ce qu'il cesse
 * de regarder. À enrichir avec ce que le terrain remonte, pas par anticipation.
 */
const MOTS_SIGNALES = [
  "connard",
  "connasse",
  "salope",
  "enculé",
  "encule",
  "pute",
  "putain",
  "batard",
  "bâtard",
  "nique",
  "niquer",
  "ntm",
  "fdp",
  "pd",
  "tapette",
  "negro",
  "nègre",
  "bougnoule",
  "sale arabe",
  "sale noir",
  "sale blanc",
];

/** Les mots composés se cherchent dans le texte recomposé, pas jeton par jeton. */
const EXPRESSIONS = MOTS_SIGNALES.filter((m) => m.includes(" "));
const MOTS_SIMPLES = new Set(MOTS_SIGNALES.filter((m) => !m.includes(" ")));

/**
 * Normalise un texte pour la comparaison.
 *
 * Les accents tombent, tout passe en minuscules, et **tout ce qui n'est pas
 * une lettre devient un espace**. C'est ce dernier point qui compte : sans
 * lui, « c.o.n.n.a.r.d » et « c0nnard » traversent la liste sans la toucher.
 */
export function normaliserPourModeration(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Ce commentaire mérite-t-il d'être signalé au créateur ?
 *
 * Compare mot entier par mot entier : « conception » ne doit pas déclencher
 * parce qu'il commence comme une insulte.
 */
export function meriteSignalement(texte: string): boolean {
  const normalise = normaliserPourModeration(texte);
  if (normalise.length === 0) return false;

  for (const expression of EXPRESSIONS) {
    if (normalise.includes(normaliserPourModeration(expression))) return true;
  }

  // Les lettres isolées sont recollées avant comparaison : « c o n n a r d »,
  // écrit ainsi pour passer entre les mailles, redevient un mot.
  const jetons = normalise.split(" ");
  const recolle = jetons.filter((j) => j.length === 1).join("");

  for (const jeton of jetons) {
    if (MOTS_SIMPLES.has(jeton)) return true;
  }

  for (const mot of MOTS_SIMPLES) {
    if (recolle.includes(mot)) return true;
  }

  return false;
}
