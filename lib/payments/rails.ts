/**
 * Ce qu'on propose de payer, et où.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * « UN OPÉRATEUR GRISÉ NE SERT À RIEN »
 *
 * C'est la phrase de la maquette, et elle porte toute la logique de ce module.
 * Montrer Orange Money à quelqu'un au Ghana ne l'aide pas : il essaie, ça
 * échoue, et il croit que Baobart est cassé. Mieux vaut n'afficher que ce qui
 * peut aboutir dans son pays.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CETTE TABLE EST UN FILTRE D'AFFICHAGE, PAS UNE AUTORISATION
 *
 * Elle dit ce qu'on **propose**. Elle ne dit pas ce que l'opérateur acceptera :
 * cela dépend du compte marchand, du pays où il est ouvert, et de ce que
 * l'opérateur a activé dessus. C'est `pilotes/paystack.ts` qui tranche, en lui
 * demandant, et qui refuse un rail qu'il ne déclare pas.
 *
 * Autrement dit : élargir cette table ne débloque rien, et la restreindre ne
 * protège de rien. Elle ne fait qu'éviter de proposer une impasse.
 */

export interface Pays {
  code: string;
  label: string;
  devise: string;
  /** Indicatif, pour l'exemple de numéro affiché sous le champ. */
  indicatif: string;
}

export interface Rail {
  code: string;
  label: string;
  /** Les deux lettres de la pastille. */
  initiales: string;
  /** Ce qu'on dit sous le nom : à quoi s'attendre. */
  hint: string;
}

export const PAYS: readonly Pays[] = [
  { code: "SN", label: "Sénégal", devise: "XOF", indicatif: "+221" },
  { code: "CI", label: "Côte d'Ivoire", devise: "XOF", indicatif: "+225" },
  { code: "GH", label: "Ghana", devise: "GHS", indicatif: "+233" },
  { code: "BJ", label: "Bénin", devise: "XOF", indicatif: "+229" },
];

export const RAILS: readonly Rail[] = [
  {
    code: "om",
    label: "Orange Money",
    initiales: "OM",
    hint: "Validation par code sur ton téléphone",
  },
  {
    code: "wave",
    label: "Wave",
    initiales: "WV",
    hint: "Validation dans l'application Wave",
  },
  {
    code: "mtn",
    label: "MTN MoMo",
    initiales: "MT",
    hint: "Validation par code sur ton téléphone",
  },
  {
    code: "moov",
    label: "Moov Money",
    initiales: "MV",
    hint: "Validation par code sur ton téléphone",
  },
  {
    code: "carte",
    label: "Carte bancaire",
    initiales: "CB",
    hint: "Visa et Mastercard, page sécurisée de l'opérateur",
  },
];

/**
 * Les rails proposés par pays.
 *
 * ⚠️ À CONFRONTER AU COMPTE MARCHAND avant la mise en ligne. Ce sont les
 * opérateurs dominants de chaque marché, pas une liste vérifiée auprès de
 * Paystack — leur catalogue dépend du pays où le compte est ouvert. Le premier
 * paiement réel de chaque pays doit être essayé rail par rail.
 *
 * La carte bancaire figure partout : elle ne dépend pas d'un opérateur local.
 */
const PAR_PAYS: Record<string, readonly string[]> = {
  SN: ["om", "wave", "carte"],
  CI: ["om", "mtn", "moov", "wave", "carte"],
  GH: ["mtn", "carte"],
  BJ: ["mtn", "moov", "carte"],
};

/** Le pays par défaut. Le franc CFA est le marché premier de Baobart. */
export const PAYS_PAR_DEFAUT = "CI";

export function paysValide(code: string | undefined): string {
  return PAYS.some((p) => p.code === code) ? code! : PAYS_PAR_DEFAUT;
}

export function railsDe(codePays: string): Rail[] {
  const permis = PAR_PAYS[paysValide(codePays)] ?? [];
  return RAILS.filter((r) => permis.includes(r.code));
}

export function railValide(codePays: string, codeRail: string | undefined): string {
  const permis = railsDe(codePays);
  return permis.some((r) => r.code === codeRail) ? codeRail! : (permis[0]?.code ?? "carte");
}

export function paysDe(code: string): Pays {
  return PAYS.find((p) => p.code === paysValide(code))!;
}

/**
 * Faut-il demander le numéro de téléphone ?
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LA RÉPONSE DÉPEND DE L'OPÉRATEUR, PAS DU RAIL
 *
 * Paystack présente sa propre page et y demande lui-même le numéro : le lui
 * réclamer d'abord ferait saisir la même chose deux fois, et donnerait à
 * Baobart une donnée personnelle dont il n'a aucun usage.
 *
 * Flutterwave, lui, en a besoin **avant** l'ouverture : c'est le numéro qui
 * désigne le réseau vers lequel part l'invite. Sans lui, son pilote retombe sur
 * la carte bancaire.
 *
 * La carte bancaire ne demande jamais de numéro, quel que soit l'opérateur.
 */
export function demandeLeTelephone(operateur: string, codeRail: string): boolean {
  if (codeRail === "carte") return false;
  return operateur === "flutterwave";
}

/** Ce qu'on explique sous le champ, ou à sa place. */
export function motDuTelephone(operateur: string, codeRail: string): string {
  if (codeRail === "carte") {
    return "Aucun numéro à donner : le paiement par carte passe par la page sécurisée de l'opérateur.";
  }
  if (operateur === "flutterwave") {
    return "C'est ce numéro qui reçoit l'invite de paiement. Il désigne aussi le réseau : un numéro MTN ne peut pas payer par Orange Money.";
  }
  return "Ton opérateur te le demandera sur sa propre page. On ne le conserve pas.";
}
