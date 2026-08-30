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

/**
 * Les tables à vider, demandées à la base plutôt qu'écrites à la main.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI PAS UNE LISTE
 *
 * Il y en avait une. Elle a manqué `PaymentWebhookEvent` — une table neuve, et
 * la seule sans clé étrangère vers `User`, donc la seule que le `CASCADE` ne
 * rattrapait pas. Les rappels de paiement se sont accumulés d'un test à
 * l'autre et d'un passage à l'autre, jusqu'à ce que l'anti-rejeu refuse des
 * événements légitimes. Le symptôme était parfaitement trompeur : des tests
 * qui passent seuls et échouent en lot.
 *
 * Une liste manuelle est une promesse que chaque table future y sera ajoutée.
 * Personne ne tient ce genre de promesse. `CASCADE` rend l'ordre indifférent,
 * il n'y avait donc rien à gagner à l'écrire.
 */
async function tablesAVider(): Promise<string[]> {
  const lignes = await db.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  return lignes.map((l) => l.tablename);
}

/** Calculée une fois : le schéma ne bouge pas pendant un passage. */
let cibles: string | null = null;

beforeEach(async () => {
  if (cibles === null) {
    const noms = await tablesAVider();
    if (noms.length === 0) {
      throw new Error(
        "Aucune table trouvée dans baobart_test — la base est-elle migrée ?",
      );
    }
    cibles = noms.map((t) => `"${t}"`).join(", ");
  }

  await db.$executeRawUnsafe(`TRUNCATE TABLE ${cibles} RESTART IDENTITY CASCADE`);
});
