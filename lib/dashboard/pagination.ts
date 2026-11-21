/**
 * Paginer une liste du tableau de bord.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LA RÈGLE (demandée le 14/11/2026)
 *
 * Une liste paginée ne descend jamais plus bas que la barre latérale, sur un
 * écran de bureau (1440 × 900). La taille de page de chaque liste n'est donc pas
 * un nombre rond choisi d'avance : c'est le nombre de lignes qui tiennent sous
 * le menu, MESURÉ avec `pnpm design:remplir-listes` puis `pnpm design:captures`
 * (mesure « descend … px sous le menu »). Chaque constante `PAR_PAGE` dit, dans
 * son commentaire, la mesure dont elle sort.
 *
 * La page vit dans l'adresse (`?page=2`) : le bouton « retour », le
 * rechargement et le partage d'un lien gardent la page ; les filtres s'y
 * combinent. Une page hors limites (`?page=99`, `?page=abc`) est ramenée dans
 * les bornes plutôt que de rendre une liste vide.
 */

/** La page demandée, ramenée entre 1 et `pages`. */
export function pageDemandee(brut: string | undefined, pages: number): number {
  const n = Number.parseInt(brut ?? "1", 10);
  return Math.min(Math.max(1, Number.isFinite(n) ? n : 1), Math.max(1, pages));
}

export interface PagePaginee<T> {
  page: number;
  pages: number;
  total: number;
  visibles: T[];
}

/** Découpe une liste déjà lue. `pages` vaut au moins 1 : une liste vide a une page, vide. */
export function paginer<T>(elements: readonly T[], brut: string | undefined, parPage: number): PagePaginee<T> {
  if (!Number.isInteger(parPage) || parPage < 1) throw new Error(`paginer : taille de page invalide (${parPage})`);
  const pages = Math.max(1, Math.ceil(elements.length / parPage));
  const page = pageDemandee(brut, pages);
  return { page, pages, total: elements.length, visibles: elements.slice((page - 1) * parPage, page * parPage) };
}

/**
 * L'adresse de la page `n`, avec les autres paramètres de l'adresse courante.
 * La page 1 n'écrit pas `page=1` : une seule adresse par page, pas deux.
 */
export function adressePaginee(chemin: string, parametres: Record<string, string | undefined>, n: number): string {
  const p = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(parametres)) {
    if (cle !== "page" && valeur) p.set(cle, valeur);
  }
  if (n > 1) p.set("page", String(n));
  return p.size > 0 ? `${chemin}?${p}` : chemin;
}
