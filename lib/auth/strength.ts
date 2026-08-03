/**
 * Longueur minimale et jauge de force du mot de passe.
 *
 * Séparé de `password.ts` **exprès** : le formulaire est un composant client et
 * a besoin de ces deux choses, alors que le hachage repose sur `node:crypto`.
 * Les mélanger ferait entrer une bibliothèque Node dans le bundle navigateur —
 * le build échoue, ou pire, il passe et la page casse à l'exécution.
 */

export const LONGUEUR_MOT_DE_PASSE_MIN = 8;

/**
 * Force du mot de passe, de 0 à 3 — les trois segments de la jauge de la
 * maquette. Volontairement simple : elle informe la personne, elle ne bloque
 * rien au-delà de la longueur minimale.
 */
export function forceMotDePasse(motDePasse: string): 0 | 1 | 2 | 3 {
  if (motDePasse.length < LONGUEUR_MOT_DE_PASSE_MIN) return 0;

  let points = 1;
  const varie =
    /[a-z]/.test(motDePasse) &&
    /[A-Z]/.test(motDePasse) &&
    /[0-9]/.test(motDePasse);
  const symbole = /[^A-Za-z0-9]/.test(motDePasse);

  if (varie || motDePasse.length >= 12) points += 1;
  if (symbole && motDePasse.length >= 12) points += 1;

  return Math.min(points, 3) as 0 | 1 | 2 | 3;
}
