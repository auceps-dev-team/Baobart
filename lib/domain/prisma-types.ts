/**
 * Types miroir des enums Prisma utilisées dans le code partagé.
 *
 * Pourquoi ne pas importer directement ces unions depuis `@prisma/client` ?
 * Parce que TypeScript doit pouvoir contrôler les décideurs purs même avant
 * `prisma generate` (CI fraîche, sandbox sans engines Prisma, tests unitaires).
 * Les valeurs ci-dessous sont volontairement alignées sur `prisma/schema.prisma`.
 */

export type Currency =
  | "XOF"
  | "NGN"
  | "GHS"
  | "KES"
  | "ZAR"
  | "MAD"
  | "USD"
  | "EUR";

export type ProductType =
  | "DIGITAL"
  | "BUNDLE"
  | "COMMISSION"
  | "CALL"
  | "COFFEE"
  | "PHYSICAL"
  | "MEMBERSHIP";

export type ProductFamily =
  | "ILLUSTRATION"
  | "PHOTO"
  | "MOCKUP"
  | "FONT"
  | "ICONE"
  | "LOGO"
  | "PACK"
  | "ART"
  | "AUDIO"
  | "VIDEO";

/**
 * L'état d'une ressource.
 *
 * `SUSPENDED` est un retrait juridique (loi 2013-451, art. 46) : il se
 * distingue d'`ARCHIVED`, que le créateur pose lui-même, parce que lui seul ne
 * peut pas le lever. Voir `lib/juridique/retrait.ts`.
 */
export type ProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED" | "SUSPENDED";

export type LicenseCode = "PERSONAL" | "COMMERCIAL" | "EXTENDED";

export type BalanceTransactionType =
  | "SALE"
  | "COMMISSION"
  | "REFUND"
  | "CHARGEBACK"
  | "CHARGEBACK_REVERSED"
  | "PAYOUT"
  | "AFFILIATE"
  | "POOL"
  | "TIP";
