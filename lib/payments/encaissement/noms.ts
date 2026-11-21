/**
 * Le nom d'un pilote d'encaissement, tel qu'un acheteur peut le lire.
 *
 * Q-35 (recette du 14/11/2026) : la page de paiement affichait « Paiement
 * traité par aucun. » — le code interne du pilote, quand aucun opérateur n'est
 * branché et que l'achat passe par la simulation de test. `null` veut dire :
 * pas d'opérateur, c'est une simulation ; l'écran le dit en clair.
 *
 * Module pur, sans dépendance : le formulaire de paiement (client) le lit aussi.
 */
const NOMS: Record<string, string | null> = {
  paystack: "Paystack",
  flutterwave: "Flutterwave",
  "bac-a-sable": "le bac à sable de test",
  aucun: null,
};

export function nomAfficheDuPilote(nom: string): string | null {
  return NOMS[nom] ?? null;
}
