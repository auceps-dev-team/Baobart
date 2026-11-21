/**
 * Une adresse écrite sans protocole — « drive.google.com/file/… » — reçoit
 * `https://`. Celles qui en ont un le gardent, et la vérification qui suit
 * décide : `http:`, `javascript:`, `data:` restent refusés là où ils l'étaient.
 *
 * Q-24 (recette du 14/11/2026) : le lien d'un fichier refusait
 * « drive.google.com/… » sans « https:// », quand les réseaux du profil
 * complétaient un identifiant tout seuls. Deux tolérances pour une même
 * saisie ; une seule désormais, pour le lien de fichier et le portfolio.
 */
export function avecProtocole(brut: string): string {
  const s = brut.trim();
  if (s.length === 0) return s;
  return /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
}
