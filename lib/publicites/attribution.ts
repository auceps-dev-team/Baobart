/**
 * À quelle publicité doit-on une vente ?
 *
 * ════════════════════════════════════════════════════════════════════════════
 * À CELLE QUI MENAIT À LA RESSOURCE ACHETÉE, ET À ELLE SEULE
 *
 * Le plugin attribuait à la dernière bannière cliquée **toute** vente des trente
 * jours suivants. Une bannière « Rentrée scolaire » cliquée par curiosité
 * s'attribuait ainsi l'achat d'un pack de polices trois semaines plus tard :
 * le compteur montait, et il mentait.
 *
 * Ici une vente ne revient qu'à une bannière dont le lien menait à la fiche de
 * la ressource achetée. Ce que ça implique : une bannière qui mène vers une
 * boutique, une collection ou un site extérieur n'aura jamais de vente
 * attribuée. L'écran d'administration le dit, au lieu d'afficher un zéro qu'on
 * lirait « cette campagne ne vend pas ».
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CINQ CLICS RETENUS, PAS UN
 *
 * Un cookie qui ne retient que le dernier clic perd la vente dès qu'on clique
 * une seconde bannière avant de revenir acheter par la première. On garde les
 * cinq derniers, le plus récent d'abord ; c'est lui qui l'emporte si deux
 * bannières menaient à la même fiche.
 *
 * Le cookie ne porte que des identifiants de bannières — ni compte, ni
 * adresse. Il est posé par le serveur (`HttpOnly`) : un visiteur peut le
 * réécrire, mais il ne peut y gagner qu'une ligne de plus dans nos chiffres,
 * jamais un prix ni un accès. L'identifiant est revérifié en base avant toute
 * écriture.
 *
 * Pur : se teste sans requête ni cookie réel.
 */

import { CLICS_RETENUS } from "@/lib/publicites/types";

/** Un identifiant cuid, et rien qui y ressemble de loin. */
const ID = /^c[a-z0-9]{20,32}$/;

export function lireClics(brut: string | undefined | null): string[] {
  if (!brut) return [];
  return brut
    .split(".")
    .filter((id) => ID.test(id))
    .slice(0, CLICS_RETENUS);
}

/** Le cookie après un clic : celui-ci en tête, sans doublon, cinq au plus. */
export function ajouterClic(brut: string | undefined | null, id: string): string {
  if (!ID.test(id)) return lireClics(brut).join(".");
  return [id, ...lireClics(brut).filter((x) => x !== id)].slice(0, CLICS_RETENUS).join(".");
}

/**
 * La bannière à qui revient l'achat de la ressource `slug`, parmi les clics
 * retenus (déjà relus en base, dans l'ordre du cookie). `null` si aucune ne
 * menait à sa fiche.
 */
export function pubMenantA(
  slug: string,
  clics: readonly string[],
  pubs: readonly { id: string; linkUrl: string }[],
): string | null {
  const parId = new Map(pubs.map((p) => [p.id, p.linkUrl]));
  for (const id of clics) {
    const lien = parId.get(id);
    if (lien && cheminDe(lien) === `/products/${slug}`) return id;
  }
  return null;
}

/** Le chemin d'un lien interne, sans requête ni ancre. `null` s'il sort du site. */
function cheminDe(lien: string): string | null {
  if (!lien.startsWith("/") || lien.startsWith("//")) return null;
  const chemin = lien.split(/[?#]/)[0]!;
  return chemin.length > 1 ? chemin.replace(/\/+$/, "") : chemin;
}
