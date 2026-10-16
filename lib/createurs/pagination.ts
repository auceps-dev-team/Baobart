/**
 * Les numéros de page à montrer : « 1 2 3 … 6 Suivant → », comme la maquette
 * (`profilPages`).
 *
 * La première, la dernière, et une fenêtre de trois autour de la courante —
 * décalée contre les bords, d'où « 1 2 3 » en première page. Un trou d'une
 * seule page s'écrit en chiffre plutôt qu'en « … » : des points de suspension
 * qui cachent une seule page font un clic de plus pour rien.
 */
export type Marque = number | "…";

export function numerosAMontrer(page: number, pages: number): Marque[] {
  if (pages <= 1) return [1];
  const debut = Math.max(1, Math.min(page - 1, pages - 2));
  const fenetre = [debut, debut + 1, debut + 2];
  const gardes = new Set([1, pages, ...fenetre].filter((n) => n >= 1 && n <= pages));
  const tries = [...gardes].sort((a, b) => a - b);
  const sortie: Marque[] = [];
  for (const [i, n] of tries.entries()) {
    const avant = tries[i - 1];
    if (avant !== undefined && n - avant === 2) sortie.push(avant + 1);
    else if (avant !== undefined && n - avant > 2) sortie.push("…");
    sortie.push(n);
  }
  return sortie;
}
