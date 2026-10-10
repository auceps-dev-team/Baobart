/**
 * Moteur de frais Baobart.
 *
 * Traduit la logique vérifiée dans `purchase.rb#calculate_fees` du dépôt
 * antiwork/gumroad (MIT, lu comme spécification), adaptée au FCFA.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UNE SEULE COMMISSION, QUI QUE SOIT CELUI QUI A AMENÉ L'ACHETEUR
 *
 * Gumroad facture selon QUI a amené l'acheteur : un taux bas quand c'est le
 * créateur, 30 % tout compris quand c'est la plateforme. Ce module a porté les
 * deux régimes (DIRECT, DECOUVERTE) jusqu'en v1.88.1, et le plan directeur
 * (§2.4) en faisait la règle.
 *
 * Décision du 10/10/2026 : Baobart prend la même commission que la plateforme
 * apporte l'acheteur ou non. Le second régime n'avait d'ailleurs jamais servi
 * — `finaliserVente` passait `"DIRECT"` en dur, aucune vente n'était
 * attribuée à l'exploration — mais il attendait dans le barème, et un audit
 * l'a lu comme la règle en vigueur. Il est retiré plutôt que laissé dormir.
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

export interface FeeSchedule {
  /** Commission Baobart, la même pour toute vente. */
  commissionBp: number;
  /** Frais de la passerelle de paiement (mobile money, carte). */
  processorRateBp: number;
  /** Part fixe Baobart. */
  fixedFee: number;
  /** Part fixe de la passerelle. */
  processorFixedFee: number;
}

/**
 * Barème par défaut, en XOF.
 *
 * `commissionBp` : 10 %, la recommandation du §2.4 (le plan hésitait avec
 * 20 %), appliquée à toute vente depuis la décision du 10/10/2026.
 *
 * `processorRateBp` vient de l'hypothèse « ~1,5 % » du modèle économique.
 * Il reste à la charge du créateur : 10 % + 1,5 % = 88,5 % pour lui.
 * Les parts fixes sont à 0 tant que les coûts réels par transaction mobile
 * money ne sont pas mesurés — en poser une au hasard fausserait le prix
 * plancher des petits produits.
 */
export const BAREME_XOF: FeeSchedule = {
  commissionBp: 1_000, // 10 %
  processorRateBp: 150, // 1,5 %
  fixedFee: 0,
  processorFixedFee: 0,
};

export interface FeeInput {
  /** Prix unitaire encaissé, en unité mineure. */
  unitPrice: number;
  quantity?: number;
  currency?: Currency;
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
  /**
   * Pourboire ajouté par l'acheteur.
   *
   * ──────────────────────────────────────────────────────────────────────────
   * IL ENTRE DANS LE BRUT, UNE FOIS — PAS PAR UNITÉ
   *
   * Un pourboire se donne à la commande, pas à l'exemplaire : quelqu'un qui
   * achète trois licences et ajoute 1 000 F donne mille francs, pas trois
   * mille. Le multiplier par la quantité prélèverait à l'acheteur trois fois
   * ce qu'il a voulu donner — et le prélèvement serait réel, chez son
   * opérateur.
   *
   * Il est soumis aux mêmes frais que le reste : il emprunte le même rail de
   * paiement, qui coûte le même pourcentage. Le créateur touche donc un
   * pourboire net, pas brut, et c'est ce que fait Gumroad.
   *
   * Conséquence voulue : un pourboire sur une ressource gratuite produit un
   * brut non nul, donc une vente encaissée. C'est exactement ce qu'on veut —
   * sans quoi soutenir un créateur qui offre son travail serait impossible.
   */
  tipAmount?: number;
  schedule?: FeeSchedule;
}

export interface FeeBreakdown {
  /** Prix × quantité + pourboire, avant tout prélèvement. */
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
    affiliateBasisPoints = 0,
    sellerBearsAffiliateFee = false,
    taxAmount = 0,
    tipAmount = 0,
    schedule = BAREME_XOF,
  } = input;

  assertMinorAmount(unitPrice, "unitPrice");
  assertMinorAmount(taxAmount, "taxAmount");
  assertMinorAmount(tipAmount, "tipAmount");
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new RangeError(`quantity doit être un entier ≥ 1, reçu : ${quantity}`);
  }
  if (affiliateBasisPoints < 0 || affiliateBasisPoints > 10_000) {
    throw new RangeError(
      `affiliateBasisPoints doit être entre 0 et 10 000, reçu : ${affiliateBasisPoints}`,
    );
  }

  // Le pourboire s'ajoute UNE fois, hors de la multiplication : voir
  // `tipAmount` dans `FeeInput`.
  const gross = unitPrice * quantity + tipAmount;

  // Un produit gratuit ne coûte rien à personne (règle vérifiée dans
  // calculate_fees : `price_cents == 0 → fee_cents = 0`). Sans ça, la part
  // fixe rendrait le gratuit déficitaire pour le créateur.
  if (gross === 0) {
    return {
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

  const platformFee = applyBp(gross, schedule.commissionBp) + schedule.fixedFee;

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
export function minimumViablePrice(schedule: FeeSchedule = BAREME_XOF): number {
  const fixed = schedule.processorFixedFee + schedule.fixedFee;
  if (fixed === 0) return 0;

  const variableBp = schedule.commissionBp + schedule.processorRateBp;

  // On cherche le plus petit prix p tel que p − frais(p) ≥ 0.
  const remainingShare = (10_000 - variableBp) / 10_000;
  if (remainingShare <= 0) return Number.POSITIVE_INFINITY;

  return Math.ceil(fixed / remainingShare);
}

// ─────────────────────────────────────────────────────── remboursement ──────

/**
 * Quelle fraction d'un montant proportionnel a déjà été consommée par les
 * remboursements successifs.
 *
 * Sert à répartir au prorata n'importe quelle part figée sur une ligne — la
 * commission retenue, une part d'affilié — quand la ligne est remboursée en
 * plusieurs fois.
 *
 * L'arrondi est ce qui compte. Un `round` appliqué à chaque remboursement
 * isolément peut, sur une suite de remboursements partiels totalisant la vente
 * entière, dériver d'un franc. Un franc n'est rien ; un franc pris à quelqu'un
 * sans raison est un défaut. On calcule donc chaque part **par différence sur
 * le cumul**, ce qui fait tomber l'écart à zéro par construction.
 */
export function partProportionnelle(input: {
  /** Brut encaissé sur la ligne : prix unitaire × quantité. */
  brut: number;
  /** La part à répartir, figée sur la ligne entière. */
  part: number;
  /** Cumul déjà remboursé avant ce remboursement-ci. */
  dejaRembourse: number;
  /** Montant du remboursement en cours. */
  montant: number;
}): number {
  const { brut, part, dejaRembourse, montant } = input;
  if (brut <= 0) return 0;

  const avant = Math.round((dejaRembourse * part) / brut);
  const apres = Math.round(
    (Math.min(brut, dejaRembourse + montant) * part) / brut,
  );

  return Math.max(0, apres - avant);
}

/**
 * La part du prix qui revient au créateur, dite en pour cent.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE SEULE PHRASE POUR TOUT LE SITE
 *
 * L'accueil et l'inscription annonçaient « 90 % » en calculant `100 −
 * commission` chacun de leur côté. Mesuré le 25/09 (Qualitytest S-90pc) : une
 * vente de 10 000 F crédite 8 850 F — 88,5 %, parce que les frais
 * d'opérateur (1,5 %) restent aussi à la charge du vendeur. L'écran des gains
 * avait été corrigé en v1.69.8 ; l'accueil et l'inscription, non (relevé le
 * 04/10). La phrase vit désormais ici, à côté du barème qu'elle décrit. (La
 * maquette, elle, annonce « 80 % » : un taux abandonné à la lecture du dépôt
 * de référence, VERIFICATION_GUMROAD §2.1.)
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE SEULE PART, PUISQU'UNE SEULE COMMISSION
 *
 * Décision du 10/10/2026 (voir l'en-tête). L'écran des gains a un temps
 * annoncé « 70 % quand l'acheteur te trouve par l'exploration » : ce régime
 * n'a jamais été appliqué, il est retiré du barème.
 */
export function partDuCreateur(bareme: FeeSchedule = BAREME_XOF): string {
  const bp = 10_000 - bareme.commissionBp - bareme.processorRateBp;
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(bp / 100)} %`;
}
