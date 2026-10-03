/**
 * Où tombent les bannières dans la mosaïque.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX RÈGLES, DÉCIDÉES LE 03/10
 *
 *   — chaque publicité a sa fréquence : « tous les 10 produits » la place
 *     après le 10ᵉ, le 20ᵉ, le 30ᵉ… C'est la règle du plugin en mode base ;
 *   — un écart minimal global : jamais deux bannières à moins de N produits
 *     l'une de l'autre, même quand deux fréquences tombent au même rang.
 *
 * Quand plusieurs pubs tombent au même rang, elles alternent. Le plugin prenait
 * toujours la première de sa liste (`get_ad_at_position`) : une pub à
 * fréquence 5 et une à 10 ne laissaient jamais la seconde paraître.
 *
 * Lu dans le plugin, et à ne pas reproduire : en mode « base », les réglages
 * min et max du widget ne servent à rien — seule la fréquence de chaque pub
 * compte. Ici l'écart minimal est réellement appliqué.
 *
 * Pur et déterministe : le placement des n premiers produits ne dépend pas des
 * suivants, donc « charger plus » ne déplace aucune bannière déjà vue.
 */

export interface PubAPlacer {
  id: string;
  frequence: number;
}

/**
 * Rend, pour chaque rang où une bannière s'insère, l'identifiant de la pub.
 * Le rang p signifie « après le p-ième produit » (p commence à 1).
 */
export function placerLesPublicites(
  nombreDeProduits: number,
  pubs: readonly PubAPlacer[],
  ecartMinimal: number,
): Map<number, string> {
  const places = new Map<number, string>();
  const valides = pubs.filter((p) => Number.isInteger(p.frequence) && p.frequence >= 1);
  if (valides.length === 0) return places;

  const ecart = Math.max(1, Math.floor(ecartMinimal));
  let derniere: number | null = null;

  for (let rang = 1; rang <= nombreDeProduits; rang += 1) {
    const candidates = valides.filter((p) => rang % p.frequence === 0);
    if (candidates.length === 0) continue;
    if (derniere !== null && rang - derniere < ecart) continue;

    places.set(rang, candidates[places.size % candidates.length]!.id);
    derniere = rang;
  }

  return places;
}

/** Une case de la mosaïque : un produit, ou une bannière. */
export type Case<P, A> =
  | { nature: "produit"; produit: P }
  | { nature: "pub"; pub: A; rang: number };

/** Intercale les bannières entre les produits, à leur place. */
export function intercaler<P, A extends { id: string }>(
  produits: readonly P[],
  pubs: readonly (A & { frequence: number })[],
  ecartMinimal: number,
): Case<P, A>[] {
  const places = placerLesPublicites(produits.length, pubs, ecartMinimal);
  const parId = new Map(pubs.map((p) => [p.id, p]));
  const cases: Case<P, A>[] = [];

  produits.forEach((produit, i) => {
    cases.push({ nature: "produit", produit });
    const id = places.get(i + 1);
    const pub = id ? parId.get(id) : undefined;
    if (pub) cases.push({ nature: "pub", pub, rang: i + 1 });
  });

  return cases;
}
