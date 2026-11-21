/**
 * La liste du blog est-elle vide — au point de dire « Rien pour l'instant » ?
 *
 * Q-33 (recette du 14/11/2026) : avec un seul article, il passait à la une et
 * la suite restait vide ; la carte disait « Rien pour l'instant — reviens
 * bientôt » juste sous lui, comme si le blog l'était.
 *
 * Vide seulement s'il n'y a VRAIMENT rien à lire : aucun article sous la une,
 * et pas de une non plus — ou, dans une rubrique filtrée (qui n'affiche pas
 * de une), aucun article dans la rubrique.
 */
export function blogVide(input: { suite: number; rubrique: boolean; une: boolean }): boolean {
  if (input.suite > 0) return false;
  return input.rubrique || !input.une;
}
