/**
 * Ce que l'acheteur a payé pour une ligne : le prix multiplié par la quantité,
 * plus le pourboire éventuel.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI CE MODULE EXISTE (AUDIT-01, 29/10/2026)
 *
 * `OrderItem.tipAmount` vit dans une colonne séparée de `OrderItem.price`
 * (`prisma/schema.prisma`, « Les frais sont calculés sur la somme des deux
 * […]. Et le remboursement rend la somme des deux : rendre tout sauf le
 * pourboire à quelqu'un qui demande son argent serait indéfendable. »).
 *
 * Le grand livre (`rembourserLigne` dans `lib/domain/orders.ts`) respectait ce
 * contrat, mais dix-huit chemins qui décident d'un montant à rembourser, à
 * reprendre en litige, à contrôler pour l'accès au fichier ou à afficher (lu
 * le 29/10/2026) écrivaient `ligne.price * ligne.quantity` en ligne — alors que
 * 4 lignes sur 45 en base de développement portent un `tipAmount > 0` (mesuré
 * le 28/10/2026).
 *
 * Rassembler ce calcul dans une fonction pure dont la signature exige
 * `tipAmount` oblige chaque requête Prisma appelante à sélectionner la colonne,
 * sous peine d'erreur de compilation.
 */

export function encaisseDe(ligne: {
  price: number;
  quantity: number;
  tipAmount: number;
}): number {
  return ligne.price * ligne.quantity + ligne.tipAmount;
}

