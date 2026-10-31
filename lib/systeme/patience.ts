/**
 * Quand montrer un squelette d'attente, et combien de temps le garder.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE PROBLÈME : LE FLASH, PAS LA VITESSE
 *
 * Mesuré le 30/10/2026 (`Doc/MESURES_PERFORMANCE_2026-10.md`) : construite,
 * une page répond en quelques dizaines de millisecondes sur le poste local.
 * Le squelette de `/explore` y apparaissait donc l'espace d'une ou deux images
 * — un éclair gris avant le contenu, plus gênant que pas de squelette du tout.
 *
 * Ralentir les pages a été envisagé et écarté le même jour : chez un visiteur
 * réel, le réseau ajoute déjà son attente, et l'allonger exprès ne servirait
 * personne. La règle retenue est celle, classique, des indicateurs d'attente :
 *
 *   — rien pendant les 200 premières millisecondes : une attente plus courte
 *     ne se perçoit pas, l'annoncer la rendrait visible ;
 *   — une fois montré, le squelette reste au moins 400 millisecondes : assez
 *     pour se lire comme un état, pas comme un clignotement.
 *
 * Le second point retient le contenu au plus `MINIMUM_SQUELETTE_MS` de plus,
 * et seulement quand l'attente était déjà réelle. Une page rapide n'attend
 * jamais : elle ne montre pas de squelette, elle n'a rien à compenser.
 */

/**
 * La durée du fondu quand le contenu arrive (ou quand le squelette se lève).
 * Assez court pour ne retarder personne, assez long pour que l'œil suive.
 */
export const FONDU_MS = 200;

/** Avant ce délai, le squelette reste invisible. */
export const DELAI_SQUELETTE_MS = 200;

/** Une fois visible, le squelette ne disparaît pas avant cette durée. */
export const MINIMUM_SQUELETTE_MS = 400;

/**
 * Combien de temps garder encore le squelette quand le contenu arrive.
 *
 * `visibleDepuis` : l'instant où le squelette est devenu visible, ou `null`
 * s'il ne l'a jamais été — la page est arrivée avant `DELAI_SQUELETTE_MS`.
 * Rend 0 quand il n'y a rien à retenir.
 */
export function resteAMontrer(visibleDepuis: number | null, maintenant: number): number {
  if (visibleDepuis === null) return 0;
  return Math.max(0, MINIMUM_SQUELETTE_MS - (maintenant - visibleDepuis));
}
