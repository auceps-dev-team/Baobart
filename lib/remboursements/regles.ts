/**
 * Les règles des demandes de remboursement.
 *
 * Module pur : la fiche, l'écran de l'acheteur, celui du créateur, le support
 * et les tests lisent les mêmes bornes.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * D'OÙ VIENNENT CES RÈGLES
 *
 * Décidé le 05/10, sur le modèle de Gumroad lu dans son dépôt
 * (`app/models/refund_policy.rb`, le 05/10) : chaque créateur choisit un
 * délai parmi une liste fermée, trente jours par défaut, affiché sur la fiche.
 * Gumroad propose aussi six mois ; Baobart s'arrête à trente jours. Puis :
 * l'acheteur demande, le créateur accepte ou refuse avec un motif, et sans
 * réponse sous sept jours le support tranche. Comme dans les conditions de
 * Gumroad (§7.2 b), un paiement contesté auprès de la banque ne se rembourse
 * pas en plus.
 */

export const DELAIS = [0, 7, 14, 30] as const;
export type Delai = (typeof DELAIS)[number];
export const DELAI_PAR_DEFAUT: Delai = 30;

/** Au-delà, la demande passe au support. */
export const JOURS_AVANT_SUPPORT = 7;

export const MOTIF_MIN = 10;
export const MOTIF_MAX = 2000;
export const REFUS_MIN = 8;

const JOUR = 86_400_000;

export function delaiValide(n: number): n is Delai {
  return (DELAIS as readonly number[]).includes(n);
}

/** Ce que la fiche écrit à côté de la licence. */
export function libelleDelai(jours: number): string {
  return jours === 0 ? "aucun remboursement" : `remboursable sous ${jours} jours`;
}

export type Refus =
  | "NON_PAYE"
  | "GRATUIT"
  | "DEJA_REMBOURSE"
  | "CONTESTE"
  | "SANS_REMBOURSEMENT"
  | "DELAI_DEPASSE"
  | "DEJA_DEMANDE";

export const MESSAGES_REFUS: Record<Refus, string> = {
  NON_PAYE: "Cet achat n'est pas payé.",
  GRATUIT: "Cette ressource était offerte : il n'y a rien à rembourser.",
  DEJA_REMBOURSE: "Cet achat est déjà remboursé.",
  CONTESTE: "Ce paiement est contesté auprès de ta banque : c'est elle qui tranche.",
  SANS_REMBOURSEMENT: "Le créateur n'accepte pas de remboursement pour cette ressource.",
  DELAI_DEPASSE: "Le délai de remboursement de cet achat est passé.",
  DEJA_DEMANDE: "Une demande a déjà été faite pour cet achat.",
};

export interface FaitsAchat {
  /** `OrderItem.state`. */
  etat: string;
  /** Prix × quantité. */
  paye: number;
  rembourse: number;
  /** Contestation ouverte et non renversée. */
  conteste: boolean;
  delaiJours: number;
  /** L'encaissement, lu au grand livre. */
  payeLe: Date;
  dejaDemande: boolean;
}

export type Eligibilite = { ok: true; jusquA: Date } | { ok: false; motif: Refus };

export function eligibilite(f: FaitsAchat, maintenant: Date): Eligibilite {
  if (f.etat !== "SUCCESSFUL") return { ok: false, motif: f.etat === "NOT_CHARGED" ? "GRATUIT" : "NON_PAYE" };
  if (f.paye <= 0) return { ok: false, motif: "GRATUIT" };
  if (f.rembourse >= f.paye) return { ok: false, motif: "DEJA_REMBOURSE" };
  if (f.conteste) return { ok: false, motif: "CONTESTE" };
  if (f.dejaDemande) return { ok: false, motif: "DEJA_DEMANDE" };
  if (f.delaiJours <= 0) return { ok: false, motif: "SANS_REMBOURSEMENT" };
  const jusquA = new Date(f.payeLe.getTime() + f.delaiJours * JOUR);
  if (maintenant.getTime() > jusquA.getTime()) return { ok: false, motif: "DELAI_DEPASSE" };
  return { ok: true, jusquA };
}

/** Le jour où une demande sans réponse passe au support. */
export function passeAuSupportLe(demandeeLe: Date): Date {
  return new Date(demandeeLe.getTime() + JOURS_AVANT_SUPPORT * JOUR);
}

export function motifValide(motif: string): boolean {
  const m = motif.trim();
  return m.length >= MOTIF_MIN && m.length <= MOTIF_MAX;
}
