/**
 * Formatage monétaire Baobart.
 *
 * RÈGLE FONDATRICE (PLAN §6.1, §11.6) : tout montant est un **entier**, exprimé
 * dans la plus petite unité de la devise (ISO 4217). Le XOF ayant 0 décimale,
 * « entiers FCFA » et « unité mineure » sont la même chose : aucun cas
 * particulier à coder, aucune valeur flottante ne circule jamais.
 *
 *   XOF : 180000  → « 180 000 F »
 *   EUR : 1250    → « 12,50 € »
 */

export const CURRENCIES = [
  "XOF",
  "NGN",
  "GHS",
  "KES",
  "ZAR",
  "MAD",
  "USD",
  "EUR",
] as const;

export type Currency = (typeof CURRENCIES)[number];

/** Nombre de décimales ISO 4217. Le XOF n'en a aucune. */
const EXPONENT: Record<Currency, number> = {
  XOF: 0,
  NGN: 2,
  GHS: 2,
  KES: 2,
  ZAR: 2,
  MAD: 2,
  USD: 2,
  EUR: 2,
};

type SymbolPlacement = "before" | "after";

const SYMBOL: Record<Currency, { glyph: string; placement: SymbolPlacement }> = {
  XOF: { glyph: "F", placement: "after" },
  NGN: { glyph: "₦", placement: "before" },
  GHS: { glyph: "GH₵", placement: "before" },
  KES: { glyph: "KSh", placement: "before" },
  ZAR: { glyph: "R", placement: "before" },
  MAD: { glyph: "MAD", placement: "after" },
  USD: { glyph: "$", placement: "before" },
  EUR: { glyph: "€", placement: "after" },
};

/** Espace insécable étroit — le séparateur de milliers de la maquette. */
const NBSP = " ";

export function decimalsFor(currency: Currency): number {
  return EXPONENT[currency];
}

/** Convertit un montant saisi par un humain (12,50 €) en entier stockable (1250). */
export function toMinorUnits(amount: number, currency: Currency): number {
  return Math.round(amount * 10 ** EXPONENT[currency]);
}

/** L'inverse : 1250 EUR → 12.5. À n'utiliser que pour l'affichage. */
export function fromMinorUnits(minor: number, currency: Currency): number {
  return minor / 10 ** EXPONENT[currency];
}

/**
 * Formate un montant entier pour l'affichage.
 * `formatMoney(180000, "XOF")` → « 180 000 F »
 */
export function formatMoney(minor: number, currency: Currency = "XOF"): string {
  const decimals = EXPONENT[currency];
  const { glyph, placement } = SYMBOL[currency];

  const digits = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  })
    .format(fromMinorUnits(minor, currency))
    // Intl produit U+202F ou U+00A0 selon les runtimes : on normalise.
    .replace(/[  \s]/g, NBSP);

  return placement === "before"
    ? `${glyph}${NBSP}${digits}`
    : `${digits}${NBSP}${glyph}`;
}

/** Étiquette « GRATUIT » du design system, sinon le prix formaté. */
export function formatPrice(minor: number, currency: Currency = "XOF"): string {
  return minor === 0 ? "GRATUIT" : formatMoney(minor, currency);
}

/** Compteurs de la maquette : « 2 340 dl », « 12,4 k ». */
export function formatCount(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) {
    const k = value / 1000;
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(k)}${NBSP}k`;
  }
  const m = value / 1_000_000;
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(m)}${NBSP}M`;
}
