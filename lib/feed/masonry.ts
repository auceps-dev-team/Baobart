/**
 * La grille masonry : combien de colonnes, et quelle carte va où.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI PAS LES COLONNES CSS
 *
 * La mosaïque reposait sur `columns: 250px` — la maquette l'écrit ainsi. Le
 * navigateur y range les cartes de haut en bas, colonne par colonne : la
 * deuxième carte de la liste tombe sous la première, pas à côté. Deux effets
 * qu'on ne voit qu'en s'en servant :
 *
 *   — « charger plus » ajoute des cartes en fin de liste, et le navigateur
 *     répartit tout à nouveau : les cartes déjà vues changent de colonne ;
 *   — une bannière placée « après le 10ᵉ produit » ne tombe pas après le
 *     10ᵉ produit à l'écran, mais quelque part dans la première colonne.
 *
 * Ici chaque carte va dans la colonne la plus courte, dans l'ordre de la
 * liste — l'ordre de lecture devient celui des rangées, comme dans la grille
 * Mayosis dont la structure est reprise. Et la répartition est incrémentale :
 * celle des n premières cartes ne dépend pas des suivantes, donc « charger
 * plus » n'en déplace aucune.
 *
 * Pur : la répartition se teste sans navigateur.
 */

/** Largeur sous laquelle une colonne ne s'ouvre pas — la maquette (`columns: 250px`). */
export const LARGEUR_MIN_COLONNE = 250;
/** Le plafond de la grille Mayosis (`list_layout: 4`). */
export const COLONNES_MAX = 4;
/** L'écart entre deux cartes, horizontal comme vertical — la maquette (`column-gap: 20px`). */
export const ECART = 20;

/** Combien de colonnes tiennent dans cette largeur, entre 1 et 4. */
export function colonnesPour(largeur: number): number {
  if (!Number.isFinite(largeur) || largeur <= 0) return 1;
  const possibles = Math.floor((largeur + ECART) / (LARGEUR_MIN_COLONNE + ECART));
  return Math.min(COLONNES_MAX, Math.max(1, possibles));
}

/**
 * Répartit des cartes de hauteurs connues dans `colonnes` colonnes.
 *
 * Rend, pour chaque colonne, les indices des cartes qu'elle porte, dans
 * l'ordre. À hauteur égale, la colonne la plus à gauche gagne : c'est ce qui
 * remplit la première rangée de gauche à droite.
 */
export function repartir(hauteurs: readonly number[], colonnes: number): number[][] {
  const n = Math.max(1, Math.floor(colonnes));
  const piles: number[][] = Array.from({ length: n }, () => []);
  const remplies = new Array<number>(n).fill(0);

  hauteurs.forEach((h, indice) => {
    let cible = 0;
    for (let c = 1; c < n; c += 1) {
      if (remplies[c]! < remplies[cible]!) cible = c;
    }
    piles[cible]!.push(indice);
    remplies[cible]! += Math.max(0, h) + ECART;
  });

  return piles;
}

/**
 * La hauteur d'une carte de ressource, estimée avant tout rendu.
 *
 * Le visuel a une hauteur fixe (`visualHeight`) ; le bloc d'informations a une
 * hauteur qui ne dépend que du titre, ramené à deux lignes au plus. Estimer
 * suffit : les colonnes sont des piles, une carte un peu plus haute que prévu
 * repousse les suivantes de sa colonne, elle ne chevauche jamais rien.
 */
export function hauteurDeCarte(input: {
  visuel: number;
  titre: string;
  largeurColonne: number;
  /** En « image pleine », les informations n'apparaissent qu'au survol. */
  infosVisibles: boolean;
}): number {
  if (!input.infosVisibles) return input.visuel;
  // 14 px en gras : environ 7,6 px par caractère ; le prix occupe la droite.
  const parLigne = Math.max(10, Math.floor((input.largeurColonne - 110) / 7.6));
  const lignes = Math.min(2, Math.max(1, Math.ceil(input.titre.length / parLigne)));
  // Marges (24) + titre (17,5 par ligne) + auteur (15) + compteurs (15) + bordure.
  return input.visuel + 24 + lignes * 17.5 + 30 + 3;
}

/**
 * Le nombre de colonnes à dessiner avant toute mesure, deviné de l'agent.
 *
 * Une colonne pour un téléphone, deux pour une tablette, quatre ailleurs. Se
 * tromper ne casse rien — la grille se corrige à l'hydratation —, mais deviner
 * juste évite que la page saute sous le pouce sur un téléphone, là où l'on
 * consulte le plus Baobart.
 */
export function colonnesDepuisAgent(agent: string | null): number {
  if (!agent) return COLONNES_MAX;
  if (/Mobi|iPhone|iPod/i.test(agent)) return 1;
  if (/iPad|Tablet|Android/i.test(agent)) return 2;
  return COLONNES_MAX;
}
