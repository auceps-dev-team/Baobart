/**
 * Règles des deux historiques de l'acheteur.
 *
 * Module pur : ni base, ni requête. Ce qui décide d'un libellé ou d'un filtre
 * se teste sans monter un Postgres, et se relit sans suivre une jointure.
 */

// ─────────────────────────────────────────────── historique des achats ──────

export const FILTRES_ACHATS = ["Toutes", "Payées", "Abonnement"] as const;
export type FiltreAchats = (typeof FILTRES_ACHATS)[number];

export function filtreAchats(valeur: string | undefined): FiltreAchats {
  return (FILTRES_ACHATS as readonly string[]).includes(valeur ?? "")
    ? (valeur as FiltreAchats)
    : "Toutes";
}

/**
 * État d'une commande, dit à l'acheteur.
 *
 * On raisonne sur les **lignes**, pas sur la commande : un panier
 * multi-vendeurs produit une charge par vendeur, dont l'une peut échouer sans
 * annuler les autres. Une commande dont une seule ligne a été remboursée n'est
 * ni « payée » ni « remboursée » — elle est partiellement remboursée, et le
 * dire évite un appel au support.
 */
export type EtatCommande =
  | "PAYÉE"
  | "PARTIELLEMENT REMBOURSÉE"
  | "REMBOURSÉE"
  | "EN ATTENTE"
  | "ÉCHOUÉE";

export interface LigneCommande {
  state: string;
  price: number;
  quantity: number;
  refundedAmount: number;
}

/**
 * Les états d'une ligne qui a réellement abouti : payée, ou offerte sans
 * prélèvement.
 *
 * Exporté parce que deux écrans en dépendent — l'historique de l'acheteur et
 * les ventes du vendeur. Les ventes recopiaient l'idée sans la liste, et
 * montraient « encaissé » un paiement échoué (mesuré le 25/09, S15).
 */
export const ETATS_ABOUTIS = ["SUCCESSFUL", "NOT_CHARGED"] as const;

export function ligneAboutie(state: string): boolean {
  return (ETATS_ABOUTIS as readonly string[]).includes(state);
}

export function etatCommande(lignes: LigneCommande[]): EtatCommande {
  if (lignes.length === 0) return "EN ATTENTE";

  const abouties = lignes.filter((l) => ligneAboutie(l.state));

  if (abouties.length === 0) {
    return lignes.some((l) => l.state === "FAILED") ? "ÉCHOUÉE" : "EN ATTENTE";
  }

  const paye = abouties.reduce((s, l) => s + l.price * l.quantity, 0);
  const rembourse = abouties.reduce((s, l) => s + l.refundedAmount, 0);

  if (rembourse <= 0) return "PAYÉE";
  // Une commande entièrement offerte n'a rien à rembourser : le rapport
  // serait une division par zéro déguisée.
  if (paye > 0 && rembourse >= paye) return "REMBOURSÉE";
  return "PARTIELLEMENT REMBOURSÉE";
}

/** Une commande remboursée n'ouvre plus le droit de télécharger. */
export function commandeTelechargeable(etat: EtatCommande): boolean {
  return etat === "PAYÉE" || etat === "PARTIELLEMENT REMBOURSÉE";
}

// ──────────────────────────────────── historique des téléchargements ────────

export const FILTRES_TELECHARGEMENTS = [
  "Tous",
  "Ce mois",
  "Achetés",
  "Gratuits",
] as const;
export type FiltreTelechargements = (typeof FILTRES_TELECHARGEMENTS)[number];

export function filtreTelechargements(
  valeur: string | undefined,
): FiltreTelechargements {
  return (FILTRES_TELECHARGEMENTS as readonly string[]).includes(valeur ?? "")
    ? (valeur as FiltreTelechargements)
    : "Tous";
}

/** Premier instant du mois courant, dans le fuseau du serveur. */
export function debutDuMois(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * « 3 fois », « 1 fois » — comme la maquette.
 *
 * Un même fichier repris après une connexion coupée compte pour ce qu'il est :
 * deux retraits. Masquer les reprises donnerait à l'acheteur l'impression
 * d'avoir perdu un téléchargement.
 */
export function libelleRepetitions(nombre: number): string {
  return `${nombre} fois`;
}

/** « AI, PNG » : ce que contient la ressource, sans doublon ni vide. */
export function formatsLisibles(nomsDeFichiers: string[]): string {
  const extensions = nomsDeFichiers
    .map((n) => {
      const point = n.lastIndexOf(".");
      return point > 0 ? n.slice(point + 1).toUpperCase() : "";
    })
    .filter((e) => e.length > 0 && e.length <= 5);

  return [...new Set(extensions)].join(", ");
}
