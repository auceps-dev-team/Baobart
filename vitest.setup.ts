/**
 * Préparation des tests d'intégration.
 *
 * Les tests qui touchent la base tournent sur `baobart_test`, JAMAIS sur la base
 * de développement : le grand livre est immuable et les écritures comptables ne
 * se suppriment pas. Un test qui écrirait dans la base de dev y laisserait des
 * lignes qu'on ne peut plus retirer.
 *
 * Entre chaque test, les tables sont vidées par TRUNCATE — qui ne déclenche pas
 * les triggers ligne à ligne, et contourne donc légitimement l'immuabilité.
 */

import { existsSync } from "node:fs";

import { beforeEach } from "vitest";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const urlTest = process.env.DATABASE_URL_TEST;
if (urlTest) {
  process.env.DATABASE_URL = urlTest;
}

// Le TRUNCATE de nettoyage dépasse forcément le seuil de requête lente. Ce
// n'est pas un signal, c'est du bruit : on relève le seuil pour les tests.
process.env.SLOW_QUERY_MS = "10000";

// L'import doit venir APRÈS la bascule d'URL : le client lit l'environnement
// à l'instanciation.
const { db } = await import("./lib/db");

const TABLES_A_VIDER = [
  "ConsumptionEvent",
  "DownloadQuota",
  "Subscription",
  "BalanceTransaction",
  "Balance",
  "Payout",
  "Refund",
  "LicenseKey",
  "OrderItem",
  "Order",
  "Cart",
  "RiskStateChange",
  "ProductFile",
  "Variant",
  "Product",
  "MediaAsset",
  "Profile",
  "User",
];

beforeEach(async () => {
  const cibles = TABLES_A_VIDER.map((t) => `"${t}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${cibles} RESTART IDENTITY CASCADE`);
});
