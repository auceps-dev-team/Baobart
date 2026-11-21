/**
 * Une base de données est-elle sur ce poste ?
 *
 * Les scripts de design qui écrivent en base (`remplir-listes.ts`, `pire-cas.ts`)
 * refusent toute base qui ne l'est pas : ils créent des comptes et des commandes
 * réussies qui n'ont rien à faire ailleurs qu'en développement.
 *
 * Ils cherchaient « localhost » n'importe où dans l'adresse. Une base distante
 * passait donc si le mot figurait dans son utilisateur, sa requête ou un
 * sous-domaine (`postgresql://u@localhost.exemple.com/db`). Relevé à la relecture
 * de #60, le 20/11/2026 ; on lit désormais l'hôte, et lui seul.
 */
const HOTES_LOCAUX = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function baseLocale(url: string): boolean {
  try {
    return HOTES_LOCAUX.has(new URL(url).hostname);
  } catch {
    return false; // une adresse illisible n'est pas une base locale
  }
}
