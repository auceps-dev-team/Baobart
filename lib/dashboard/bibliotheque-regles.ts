import { encaisseDe } from "@/lib/domain/encaisse";

/**
 * Les règles de « Ma bibliothèque », sans base de données.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI L'ÉCRAN EXISTE (31/10/2026)
 *
 * Mesuré dans l'audit du 31/10 (`Doc/ETAT_DU_PROJET_2026-10.md`, Q2-3) :
 * après un achat, « Télécharger maintenant » menait à l'historique des
 * téléchargements, qui lit `ConsumptionEvent` — ce qu'on a DÉJÀ retiré. Un
 * acheteur qui venait de payer y lisait « Rien téléchargé pour l'instant »,
 * et l'Aperçu, qui lit le même journal, ne montrait rien non plus.
 *
 * La maquette (`Baobart Dashboard.dc.html`, page `bibliotheque`) avait prévu
 * l'écran qui manquait : « Tout ce que tu possèdes, nommé par son titre — pas
 * par un numéro de commande. Ce que tu n'as pas encore retiré apparaît en
 * premier. » Il part donc des ACHATS (`OrderItem`), pas des retraits.
 */

/** Ce qu'il faut savoir d'une ligne d'achat pour dire si elle reste à toi. */
export interface LigneAchetee {
  price: number;
  quantity: number;
  tipAmount: number;
  refundedAmount: number;
  chargebackAt: Date | null;
  chargebackReversedAt: Date | null;
  accessRevokedAt: Date | null;
}

/**
 * La ressource reste-t-elle à l'acheteur ?
 *
 * Les mêmes motifs que la route de livraison (`lib/domain/downloads.ts`) et
 * que le bouton de la fiche (`droitDeTelecharger`) : un remboursement
 * intégral — prix ET pourboire, `encaisseDe` —, une contestation en cours,
 * un accès retiré par le vendeur. Montrer dans la bibliothèque une ressource
 * que la route refusera au clic serait promettre ce qu'on ne tient pas.
 *
 * Un remboursement partiel laisse la ressource : c'est la règle de la fiche.
 */
export function resteAToi(ligne: LigneAchetee): boolean {
  const paye = encaisseDe(ligne);
  if (paye > 0 && ligne.refundedAmount >= paye) return false;
  if (ligne.chargebackAt !== null && ligne.chargebackReversedAt === null) return false;
  if (ligne.accessRevokedAt !== null) return false;
  return true;
}

/**
 * L'ordre de la maquette : ce qui n'a jamais été retiré d'abord (« c'est à
 * toi, ça t'attend »), du plus récent achat au plus ancien ; puis le reste,
 * du dernier retrait au plus ancien.
 */
export function ordreBibliotheque(
  a: { acheteLe: Date; dernierRetrait: Date | null },
  b: { acheteLe: Date; dernierRetrait: Date | null },
): number {
  if ((a.dernierRetrait === null) !== (b.dernierRetrait === null)) {
    return a.dernierRetrait === null ? -1 : 1;
  }
  if (a.dernierRetrait && b.dernierRetrait) {
    return b.dernierRetrait.getTime() - a.dernierRetrait.getTime();
  }
  return b.acheteLe.getTime() - a.acheteLe.getTime();
}

/** « 42 Mo », « 1,2 Go », « 800 Ko » — ou `null` quand on ne sait pas. */
export function poidsLisible(octets: number | null): string | null {
  if (octets === null || octets <= 0) return null;
  const mo = octets / (1024 * 1024);
  if (mo >= 1024) return `${(mo / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Go`;
  if (mo >= 1) return `${Math.round(mo)} Mo`;
  return `${Math.max(1, Math.round(octets / 1024))} Ko`;
}

/**
 * Une licence permet-elle un usage commercial ?
 *
 * `null` — la ressource n'a pas choisi — vaut commerciale : c'est la licence
 * affichée par défaut sur la fiche (`LICENCE_PAR_DEFAUT`,
 * `lib/products/queries.ts`).
 */
export function licenceCommerciale(code: "PERSONAL" | "COMMERCIAL" | "EXTENDED" | null): boolean {
  return code !== "PERSONAL";
}
