/**
 * Moteur de frais Baobart.
 *
 * Traduit la logique vérifiée dans `purchase.rb#calculate_fees` du dépôt
 * antiwork/gumroad (MIT, lu comme spécification), adaptée au FCFA.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LES DEUX RÉGIMES
 *
 * Gumroad ne facture pas un taux unique : il facture selon QUI a amené
 * l'acheteur. Baobart reprend ce principe, parce qu'il aligne le prix sur le
 * service réellement rendu.
 *
 *   DIRECT     le créateur a amené l'acheteur (son lien, son audience).
 *              Baobart n'a fourni que l'infrastructure → commission basse.
 *
 *   DECOUVERTE l'acheteur vient du feed, de la recherche ou d'une collection
 *              éditoriale. Baobart a fourni la vente elle-même → commission
 *              haute, mais AUCUN frais fixe : le créateur n'avance rien et ne
 *              paie que s'il a vendu.
 *
 * C'est aussi ce qui remplace la publicité au CPM : un créateur qui veut plus
 * de visibilité relève son propre taux « découverte » au lieu d'acheter des
 * impressions. Il ne prend aucun risque de trésorerie — ce qui compte sur un
 * marché où les créateurs n'avancent pas d'argent.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UNITÉS
 *
 * Montants : entiers, en unité mineure ISO 4217 (le XOF n'a pas de décimale,
 * donc « FCFA entier »). Voir lib/i18n/money.ts.
 *
 * Taux : points de base (1/10 000). 10 % = 1000 bp, 2,9 % = 290 bp.
 * Gumroad raisonne en « pour mille » (`_per_thousand`, où 100 = 10 %) ; on
 * convertit en points de base pour n'avoir qu'une seule unité de taux dans
 * tout le code — `Affiliate.basisPoints` est déjà en points de base.
 *
 * Aucun flottant ne sort d'ici : les divisions sont arrondies immédiatement.
 */

import type { Currency } from "@/lib/i18n/money";

export type FeeRegime = "DIRECT" | "DECOUVERTE";

export interface FeeSchedule {
  /** Commission Baobart quand le créateur amène l'acheteur. */
  directRateBp: number;
  /**
   * Prélèvement TOTAL quand Baobart amène l'acheteur, frais de passerelle
   * INCLUS — comme chez Gumroad, où les 30 % absorbent le coût du processeur.
   */
  decouverteRateBp: number;
  /** Frais de la passerelle de paiement (mobile money, carte). */
  processorRateBp: number;
  /** Part fixe Baobart, régime DIRECT uniquement. */
  fixedFee: number;
  /** Part fixe de la passerelle. */
  processorFixedFee: number;
}

/**
 * Barème par défaut, en XOF.
 *
 * ⚠️ Deux de ces valeurs sont des DÉCISIONS COMMERCIALES encore ouvertes
 * (PLAN §2.8-1) et non des constantes techniques :
 *   - `directRateBp` : 10 % est la recommandation du §2.4 (le plan hésitait
 *     avec 20 %). La lecture de Gumroad rend le choix moins coûteux : le taux
 *     bas n'est appliqué qu'aux ventes que Baobart n'a pas générées.
 *   - `decouverteRateBp` : 30 % est la valeur de Gumroad, reprise telle quelle
 *     faute de mieux. À calibrer sur le marché ouest-africain.
 *
 * `processorRateBp` vient de l'hypothèse « ~1,5 % » du modèle économique.
 * Les parts fixes sont à 0 tant que les coûts réels par transaction mobile
 * money ne sont pas mesurés — en poser une au hasard fausserait le prix
 * plancher des petits produits.
 */
export const BAREME_XOF: FeeSchedule = {
  directRateBp: 1_000, // 10 %
  decouverteRateBp: 3_000, // 30 %
  processorRateBp: 150, // 1,5 %
  fixedFee: 0,
  processorFixedFee: 0,
};

export interface FeeInput {
  /** Prix unitaire encaissé, en unité mineure. */
  unitPrice: number;
  quantity?: number;
  currency?: Currency;
  regime: FeeRegime;
  /** Part de l'affilié en points de base. 0 ou absent = pas d'affilié. */
  affiliateBasisPoints?: number;
  /**
   * Qui absorbe la quote-part de commission de l'affilié.
   * `false` (défaut, comportement Gumroad) : l'affilié la supporte, sa part
   * est réduite proportionnellement. `true` : le vendeur l'absorbe et
   * l'affilié touche son pourcentage sur le brut.
   */
  sellerBearsAffiliateFee?: boolean;
  /** Taxe collectée EN PLUS du prix, due à l'administration fiscale. */
  taxAmount?: number;
  schedule?: FeeSchedule;
}

export interface FeeBreakdown {
  regime: FeeRegime;
  /** Prix × quantité, avant tout prélèvement. */
  gross: number;
  /** Ce que l'acheteur débourse réellement (brut + taxe). */
  buyerTotal: number;
  platformFee: number;
  processorFee: number;
  affiliateCredit: number;
  taxAmount: number;
  /** Ce qui alimente le solde du vendeur. */
  sellerNet: number;
}

function assertMinorAmount(value: number, name: string): void {
  if (!Number.isInteger(value)) {
    throw new TypeError(
      `${name} doit être un entier en unité mineure, reçu : ${value}`,
    );
  }
  if (value < 0) {
    throw new RangeError(`${name} ne peut pas être négatif, reçu : ${value}`);
  }
}

/** Applique un taux en points de base à un montant entier. */
function applyBp(amount: number, basisPoints: number): number {
  return Math.round((amount * basisPoints) / 10_000);
}

/**
 * Calcule la décomposition complète d'une ligne d'achat.
 *
 * Invariante garantie : `gross === sellerNet + platformFee + processorFee +
 * affiliateCredit`. La taxe est hors de cette égalité — elle est collectée en
 * plus du prix et n'a jamais appartenu au vendeur.
 */
export function computeFees(input: FeeInput): FeeBreakdown {
  const {
    unitPrice,
    quantity = 1,
    regime,
    affiliateBasisPoints = 0,
    sellerBearsAffiliateFee = false,
    taxAmount = 0,
    schedule = BAREME_XOF,
  } = input;

  assertMinorAmount(unitPrice, "unitPrice");
  assertMinorAmount(taxAmount, "taxAmount");
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new RangeError(`quantity doit être un entier ≥ 1, reçu : ${quantity}`);
  }
  if (affiliateBasisPoints < 0 || affiliateBasisPoints > 10_000) {
    throw new RangeError(
      `affiliateBasisPoints doit être entre 0 et 10 000, reçu : ${affiliateBasisPoints}`,
    );
  }

  const gross = unitPrice * quantity;

  // Un produit gratuit ne coûte rien à personne (règle vérifiée dans
  // calculate_fees : `price_cents == 0 → fee_cents = 0`). Sans ça, la part
  // fixe rendrait le gratuit déficitaire pour le créateur.
  if (gross === 0) {
    return {
      regime,
      gross: 0,
      buyerTotal: taxAmount,
      platformFee: 0,
      processorFee: 0,
      affiliateCredit: 0,
      taxAmount,
      sellerNet: 0,
    };
  }

  const processorFee =
    applyBp(gross, schedule.processorRateBp) + schedule.processorFixedFee;

  let platformFee: number;
  if (regime === "DECOUVERTE") {
    // Le taux « découverte » est TOUT COMPRIS : Baobart absorbe le coût de la
    // passerelle dedans, et ne prend aucune part fixe.
    const totalTake = applyBp(gross, schedule.decouverteRateBp);
    platformFee = Math.max(0, totalTake - processorFee);
  } else {
    platformFee = applyBp(gross, schedule.directRateBp) + schedule.fixedFee;
  }

  // Part de l'affilié : pourcentage du BRUT, diminué de sa quote-part de la
  // commission plateforme — sauf si le vendeur choisit de l'absorber.
  // Arrondi au plancher, comme Gumroad (`affiliate_cents.floor`).
  let affiliateCredit = 0;
  if (affiliateBasisPoints > 0) {
    const onGross = Math.floor((gross * affiliateBasisPoints) / 10_000);
    const shareOfFee = sellerBearsAffiliateFee
      ? 0
      : Math.floor((platformFee * affiliateBasisPoints) / 10_000);
    affiliateCredit = Math.max(0, onGross - shareOfFee);
  }

  const sellerNet = gross - platformFee - processorFee - affiliateCredit;

  return {
    regime,
    gross,
    buyerTotal: gross + taxAmount,
    platformFee,
    processorFee,
    affiliateCredit,
    taxAmount,
    sellerNet,
  };
}

/**
 * Plus petit prix à partir duquel le vendeur touche encore quelque chose.
 *
 * Sert à poser un prix plancher par devise : sans lui, les parts fixes rendent
 * les tout petits produits déficitaires pour le créateur — c'est la raison
 * d'être du `min_price` par devise chez Gumroad.
 */
export function minimumViablePrice(
  regime: FeeRegime,
  schedule: FeeSchedule = BAREME_XOF,
): number {
  const fixed =
    schedule.processorFixedFee + (regime === "DIRECT" ? schedule.fixedFee : 0);
  if (fixed === 0) return 0;

  const variableBp =
    regime === "DIRECT"
      ? schedule.directRateBp + schedule.processorRateBp
      : schedule.decouverteRateBp;

  // On cherche le plus petit prix p tel que p − frais(p) ≥ 0.
  const remainingShare = (10_000 - variableBp) / 10_000;
  if (remainingShare <= 0) return Number.POSITIVE_INFINITY;

  return Math.ceil(fixed / remainingShare);
}

// ─────────────────────────────────────────────────────── remboursement ──────

/**
 * Ce que le créateur rend sur un remboursement partiel.
 *
 * Il ne rend que sa part nette : la commission de la plateforme et les frais
 * du processeur ne sont jamais entrés dans son solde. Même arithmétique que
 * `purchase.rb` chez Gumroad, qui écrit `decrement − (fee/price × decrement)`
 * — soit `decrement × net/brut`.
 *
 * L'arrondi est celui qui compte. Un `round` par remboursement peut, sur une
 * suite de remboursements partiels totalisant la vente entière, débiter le
 * créateur d'un franc de plus que ce qu'il a touché. Un franc n'est rien ; un
 * franc pris à quelqu'un sans raison est un défaut. On calcule donc chaque
 * part **par différence sur le cumul**, ce qui fait tomber l'écart à zéro par
 * construction.
 */
export function partNetteRemboursee(input: {
  /** Brut encaissé sur la ligne : prix unitaire × quantité. */
  brut: number;
  /** Net déjà crédité au créateur pour cette ligne. */
  net: number;
  /** Cumul déjà remboursé avant ce remboursement-ci. */
  dejaRembourse: number;
  /** Montant du remboursement en cours. */
  montant: number;
}): number {
  const { brut, net, dejaRembourse, montant } = input;
  if (brut <= 0) return 0;

  const avant = Math.round((dejaRembourse * net) / brut);
  const apres = Math.round(
    (Math.min(brut, dejaRembourse + montant) * net) / brut,
  );

  return Math.max(0, apres - avant);
}
