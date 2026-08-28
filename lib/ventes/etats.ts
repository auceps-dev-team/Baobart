/**
 * Les cinq états d'une vente, vus par le vendeur.
 *
 * Ils ne sont pas stockés : ils se déduisent de la ligne d'achat — montant
 * remboursé, litige ouvert, accès retiré. Une colonne d'état de plus serait une
 * vérité de plus à tenir à jour, et donc une de plus à voir diverger.
 *
 * Repris de `Baobart Design/Baobart Dashboard.dc.html` (`SALE_STATES`).
 */

export type EtatVente =
  | "ENCAISSEE"
  | "CONTESTEE"
  | "PARTIEL"
  | "REMBOURSEE"
  | "RETIREE";

export const ETATS_VENTE: Record<EtatVente, { sens: string; ton: string }> = {
  ENCAISSEE: { sens: "Paiement encaissé, accès actif.", ton: "neutre" },
  CONTESTEE: {
    sens: "L'acheteur a ouvert un litige auprès de son opérateur.",
    ton: "casse",
  },
  PARTIEL: {
    sens: "Remboursement partiel déjà appliqué. L'accès reste actif.",
    ton: "attend",
  },
  REMBOURSEE: {
    sens: "Intégralement remboursée, accès retiré. État terminal.",
    ton: "dort",
  },
  RETIREE: {
    sens: "Accès retiré sans remboursement. État terminal, contestable par l'acheteur.",
    ton: "dort",
  },
};

export const ORDRE_VENTE: EtatVente[] = [
  "ENCAISSEE",
  "CONTESTEE",
  "PARTIEL",
  "REMBOURSEE",
  "RETIREE",
];

/**
 * L'état d'une vente, déduit dans un ordre qui compte.
 *
 * Le litige l'emporte sur tout : l'argent a été repris, le reste est
 * secondaire. Vient ensuite le remboursement intégral, puis le retrait
 * d'accès — qui peut coexister avec un remboursement partiel, et c'est
 * précisément pourquoi il passe après.
 */
export function etatDeLaVente(input: {
  state: string;
  brut: number;
  rembourse: number;
  litige: boolean;
  accesRetire: boolean;
}): EtatVente {
  if (input.litige) return "CONTESTEE";
  if (input.brut > 0 && input.rembourse >= input.brut) return "REMBOURSEE";
  if (input.rembourse > 0) return "PARTIEL";
  if (input.accesRetire) return "RETIREE";
  return "ENCAISSEE";
}
