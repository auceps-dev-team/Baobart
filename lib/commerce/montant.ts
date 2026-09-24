import "server-only";

import { prixPlancher } from "@/lib/commerce/codes-promo";

/**
 * Montant choisi par l'acheteur — §3.4-B (pourboires) et §3.4-D (« coffee »).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX LIGNES DE LA MATRICE, UN SEUL MÉCANISME
 *
 * « Pourboires » et « produits coffee » demandent la même chose : que
 * l'acheteur décide combien. Les traiter séparément aurait donné deux chemins
 * d'encaissement parallèles à tenir en phase — et le jour où l'un gagne une
 * règle que l'autre n'a pas, personne ne s'en aperçoit avant une plainte.
 *
 * `LIBRE` couvre le produit « coffee » : le créateur propose un montant, et
 * l'acheteur met ce qu'il veut au-dessus d'un plancher. Le pourboire s'ajoute
 * à un prix fixe. Les deux arrivent dans le même calcul de frais.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE PLANCHER N'EST PAS UNE OPINION
 *
 * `prixPlancher()` — déjà employé par les codes promo — dit à partir de quel
 * montant une vente est possible : au-dessous, les frais dépassent
 * l'encaissement, et zéro franc ne s'encaisse chez aucun opérateur.
 *
 * Le créateur peut poser un plancher plus haut ; il ne peut pas descendre
 * sous celui-là. Le lui laisser produirait des ventes que l'opérateur refuse,
 * après les avoir ouvertes — c'est-à-dire devant l'acheteur.
 */

export type ModePrix = "FIXED" | "LIBRE";

/**
 * Le plafond d'un pourboire.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * C'EST UN GARDE-FOU DE SAISIE, PAS UNE RÈGLE COMMERCIALE
 *
 * Personne ne veut brider la générosité. Ce plafond existe parce qu'un zéro de
 * trop se tape vite : 50 000 devient 500 000, et la somme part chez
 * l'opérateur telle quelle.
 *
 * Sans lui, rien ne casserait tout de suite — l'opérateur refuserait
 * probablement, mais **après** que la commande soit ouverte et que l'acheteur
 * ait quitté le site. Le refus tomberait sur son téléphone, sans explication.
 * Le poser ici, c'est le dire pendant qu'on peut encore corriger.
 *
 * Un million de francs CFA, soit environ mille cinq cents euros. Qui veut
 * donner davantage peut le faire en deux fois, et nous écrire.
 */
export const PLAFOND_POURBOIRE = 1_000_000;

export type MotifMontant =
  /** Sous le plancher du créateur, ou sous celui de la plateforme. */
  | "TROP_BAS"
  /** Pas un entier, ou négatif. */
  | "INVALIDE"
  /** Au-dessus du plafond de saisie. */
  | "POURBOIRE_TROP_HAUT";

export interface MontantRetenu {
  ok: true;
  /** Ce qui sera facturé pour la ressource. */
  prix: number;
  /** Ce qui s'ajoute, ou zéro. */
  pourboire: number;
  /** La somme, pour l'affichage. */
  total: number;
}

export type SuiteMontant =
  | MontantRetenu
  | { ok: false; motif: MotifMontant; minimum?: number };

export const MESSAGES_MONTANT: Record<MotifMontant, string> = {
  TROP_BAS: "Ce montant est trop bas pour que la vente aboutisse.",
  INVALIDE: "Indique un montant en francs, sans centime.",
  POURBOIRE_TROP_HAUT: "Ce pourboire dépasse ce qu'on accepte en une fois.",
};

/**
 * Le montant minimum acceptable pour une ressource à prix libre.
 *
 * Le plus exigeant du plancher de la plateforme et de celui du créateur : le
 * second peut monter, jamais descendre.
 */
export function minimumLibre(minPriceDuCreateur: number | null): number {
  return Math.max(prixPlancher(), minPriceDuCreateur ?? 0);
}

export interface EntreeMontant {
  mode: ModePrix;
  /** Le prix du créateur — fixe, ou suggéré en `LIBRE`. */
  prix: number;
  /** Le plancher du créateur, en `LIBRE`. */
  minPrice: number | null;
  /** Le créateur invite-t-il un pourboire ? */
  pourboiresOuverts: boolean;
  /** Ce que l'acheteur a tapé pour le montant, en `LIBRE`. */
  montantChoisi?: string | number | null;
  /** Ce qu'il a tapé pour le pourboire. */
  pourboireChoisi?: string | number | null;
}

/**
 * Décide de ce qu'on facture.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QUE L'ACHETEUR ENVOIE N'EST JAMAIS PRIS TEL QUEL
 *
 * Les deux champs viennent du formulaire, donc du navigateur, donc de
 * n'importe où. En `FIXED`, un montant envoyé est **ignoré** — pas refusé,
 * ignoré : refuser révélerait qu'il existe un chemin où il compterait.
 *
 * Et un pourboire envoyé sur une ressource qui n'en invite pas est ignoré de
 * même. Sans cela, on facturerait un supplément que le créateur n'a jamais
 * proposé, sur une fiche qui ne l'annonce pas.
 */
export function retenirLeMontant(entree: EntreeMontant): SuiteMontant {
  const prix =
    entree.mode === "LIBRE"
      ? lireUnEntier(entree.montantChoisi)
      : entree.prix;

  if (prix === null) return { ok: false, motif: "INVALIDE" };

  if (entree.mode === "LIBRE") {
    const minimum = minimumLibre(entree.minPrice);
    if (prix < minimum) return { ok: false, motif: "TROP_BAS", minimum };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAS DE `?? 0` ICI, ET C'EST TOUTE LA DIFFÉRENCE
  //
  // La première version écrivait `lireUnEntier(...) ?? 0`. Le `??` avalait le
  // `null` — c'est-à-dire le refus — et le transformait en zéro.
  //
  // Conséquence : quelqu'un qui tape « 2OOO » avec des lettres O donne zéro
  // franc, l'achat aboutit, et rien ne le lui dit. Il croit avoir soutenu un
  // créateur qui ne reçoit rien. Aucune erreur nulle part.
  //
  // Le test l'a attrapé. `lireUnEntier` rend déjà `0` pour un champ vide, qui
  // est le seul cas où l'absence vaut zéro.
  //
  // Ignoré, pas refusé, quand le créateur n'invite pas de pourboire : refuser
  // révélerait qu'il existe un chemin où il compterait.
  const pourboire = entree.pourboiresOuverts
    ? lireUnEntier(entree.pourboireChoisi)
    : 0;

  if (pourboire === null) return { ok: false, motif: "INVALIDE" };
  if (pourboire > PLAFOND_POURBOIRE) {
    return { ok: false, motif: "POURBOIRE_TROP_HAUT" };
  }

  return { ok: true, prix, pourboire, total: prix + pourboire };
}

/**
 * Un entier positif, ou `null` si ce n'en est pas un.
 *
 * Les espaces et les séparateurs de milliers sont tolérés : « 2 500 » et
 * « 2.500 » sont ce qu'on tape naturellement, et les refuser ferait échouer
 * une saisie correcte pour une question de typographie.
 *
 * Un champ vide rend `0`, pas `null` : ne rien mettre dans un pourboire
 * facultatif veut dire « pas de pourboire », pas « erreur de saisie ».
 */
function lireUnEntier(brut: string | number | null | undefined): number | null {
  if (brut === null || brut === undefined) return 0;
  if (typeof brut === "number") {
    return Number.isInteger(brut) && brut >= 0 ? brut : null;
  }

  const net = brut.replace(/[\s. ]/g, "").trim();
  if (net === "") return 0;
  if (!/^\d+$/.test(net)) return null;

  const valeur = Number(net);
  return Number.isSafeInteger(valeur) ? valeur : null;
}

/**
 * Les montants à proposer en un clic, pour une ressource à prix libre.
 *
 * Trois boutons valent mieux qu'un champ vide : personne ne sait quoi donner,
 * et un champ vide se remplit surtout du montant le plus bas.
 *
 * Ceux du créateur s'il en a posé ; sinon on en dérive du prix suggéré, ce qui
 * évite un écran nu sur une ressource qu'il n'a pas fini de régler.
 */
export function montantsSuggeres(
  prix: number,
  minPrice: number | null,
  declares: unknown,
): number[] {
  const minimum = minimumLibre(minPrice);

  const duCreateur = Array.isArray(declares)
    ? (declares as unknown[])
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v) && v >= minimum)
    : [];

  if (duCreateur.length > 0) {
    return [...new Set(duCreateur)].sort((a, b) => a - b).slice(0, 4);
  }

  const base = Math.max(prix, minimum);

  return [...new Set([base, base * 2, base * 5])]
    .filter((v) => v >= minimum)
    .sort((a, b) => a - b);
}
