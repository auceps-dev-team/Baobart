/**
 * (Re)crée la base de test et y applique les migrations.
 *
 * Passe par un script Node plutôt qu'une ligne de `package.json` : poser une
 * variable d'environnement dans un script npm ne s'écrit pas pareil sous
 * Windows et sous Unix, et ce dépôt doit tourner sur les deux.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const url =
  process.env.DATABASE_URL_TEST ??
  "postgresql://baobart:baobart@localhost:5433/baobart_test?schema=public";

const nomBase = new URL(url).pathname.replace(/^\//, "");
const conteneur = process.env.POSTGRES_CONTAINER ?? "baobart-postgres";

function run(commande, args, options = {}) {
  execFileSync(commande, args, { stdio: "inherit", ...options });
}

console.log(`Recréation de la base « ${nomBase} »…`);
run("docker", [
  "exec",
  conteneur,
  "psql",
  "-U",
  "baobart",
  "-d",
  "postgres",
  "-c",
  `DROP DATABASE IF EXISTS ${nomBase};`,
  "-c",
  `CREATE DATABASE ${nomBase} OWNER baobart;`,
]);

console.log("Application des migrations…");
// `npx.cmd` sous Windows plutôt que `shell: true` : passer des arguments à
// travers un shell les concatène sans les échapper.
run(process.platform === "win32" ? "npx.cmd" : "npx", [
  "prisma",
  "migrate",
  "deploy",
], {
  env: { ...process.env, DATABASE_URL: url },
});

console.log("Base de test prête.");
