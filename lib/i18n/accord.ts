/**
 * Le mot qui suit un nombre, accordé : « 1 ressource », « 2 ressources ».
 *
 * Q-34 (recette du 14/11/2026) : « 1 ressources », « 1 créatifs »,
 * « 1 familles », « 1 ventes », « 1 abonnés » sur l'accueil, Explorer, la
 * vitrine et les cartes. Chaque écran écrivait son pluriel en dur.
 *
 * La règle française : le singulier jusqu'à 1 inclus, zéro compris
 * (« 0 ressource ») ; le pluriel à partir de 2. Rend le MOT seulement, pour
 * que chaque écran garde sa mise en forme du nombre (« 1 000 », « 1,2 k »).
 */
export function accorde(n: number, singulier: string, pluriel = `${singulier}s`): string {
  return Math.abs(n) >= 2 ? pluriel : singulier;
}
