/**
 * (Re)crée la base de test et y applique les migrations.
 *
 * Passe par un script Node plutôt qu'une ligne de `package.json` : poser une
 * variable d'environnement dans un script npm ne s'écrit pas pareil sous
 * Windows et sous Unix, et ce dépôt doit tourner sur les deux.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

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

/**
 * Recrée la base à neuf, quand c'est possible.
 *
 * En local, Postgres tourne dans un conteneur : on la détruit et on la
 * reconstruit, pour partir d'un état connu. En intégration continue, le
 * service Postgres crée déjà la base au démarrage et aucun client `psql` n'est
 * installé sur le runner — il n'y a rien à recréer, seulement des migrations à
 * appliquer. Le script s'adapte au lieu d'exiger un Docker qui n'existe pas.
 */
function recreerLaBase() {
  try {
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
    return true;
  } catch {
    return false;
  }
}

console.log(`Préparation de la base « ${nomBase} »…`);
if (!recreerLaBase()) {
  console.log(
    "Pas de conteneur Docker joignable : on suppose la base déjà créée " +
      "(service Postgres d'intégration continue) et on applique les migrations.",
  );
}

console.log("Application des migrations…");
// On appelle l'entrée JS de Prisma avec le Node courant, plutôt que `npx`.
// Deux raisons : `shell: true` concatène les arguments sans les échapper, et
// Node 24 refuse d'exécuter un `.cmd` sans shell — donc `npx.cmd` échoue aussi.
// Résoudre le module contourne les deux et ne dépend pas de la plateforme.
const prisma = createRequire(import.meta.url).resolve("prisma/build/index.js");
// Les DEUX variables, pas seulement `DATABASE_URL`.
//
// Le schéma déclare `directUrl` : pour une migration, Prisma lit celle-là et
// ignore `url`. Ne surcharger que `DATABASE_URL` enverrait donc les migrations
// sur la base que `DIRECT_URL` désigne — en local la base de développement, et
// sur un poste mal configuré la base de production. La panne est silencieuse :
// le script annonce « base de test prête » alors qu'il a migré ailleurs.
run(process.execPath, [prisma, "migrate", "deploy"], {
  env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
});

console.log("Base de test prête.");
