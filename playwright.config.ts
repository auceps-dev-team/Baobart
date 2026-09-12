import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

/**
 * Les tests au navigateur.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QU'ILS ATTRAPENT, ET QUE LE RESTE NE VOIT PAS
 *
 * Les tests d'intégration éprouvent des fonctions contre une vraie base : ils
 * savent qu'un achat crédite le bon solde. Ils ne savent pas si un bouton
 * existe, si un formulaire envoie les bons champs, ni si une page rend 404 à
 * qui n'a rien à y faire.
 *
 * C'est exactement le trou de ce projet : dix-huit écrans dont plusieurs
 * affichent des données qu'aucun parcours ne produit. Un test qui traverse
 * l'application dit lesquels sont réellement praticables.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UNE BASE ET UN PORT À PART
 *
 * `baobart_e2e`, sur le port 3200. Les deux sont délibérés : le navigateur ne
 * doit pas piétiner la base d'intégration, et le serveur de test ne doit pas
 * entrer en conflit avec le `pnpm dev` que vous avez peut-être déjà ouvert.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI 3200 ET NON 3100, DEPUIS v1.51.0
 *
 * Ce fichier disait 3100 « pour ne pas gêner votre `pnpm dev` » — en supposant
 * que celui-ci tournait sur 3000. Sur cette machine, 3000 est pris par une
 * autre application : le serveur de développement a migré sur 3100, et
 * `package.json` l'y fixe désormais.
 *
 * Les deux se sont donc retrouvés sur le même port, avec une conséquence
 * discrète et grave : `reuseExistingServer` aurait fait passer toute la suite
 * e2e **contre le serveur de développement**. Or c'est exactement ce que le
 * bloc ci-dessous explique qu'il ne faut pas faire — la redirection après
 * action serveur n'aboutit pas en mode développement, et deux parcours
 * justes échouent.
 *
 * Un échec qui ne vient pas du code testé est pire qu'une absence de test :
 * il apprend à ne plus croire la suite.
 */

const PORT = Number(process.env.E2E_PORT ?? 3200);
const BASE = `http://127.0.0.1:${PORT}`;

const url =
  process.env.DATABASE_URL_E2E ??
  "postgresql://baobart:baobart@localhost:5433/baobart_e2e?schema=public";

export default defineConfig({
  testDir: "./e2e",
  // Un parcours qui traverse l'inscription, l'achat et le téléchargement fait
  // plusieurs allers-retours serveur. Trente secondes est court.
  timeout: 60_000,
  expect: { timeout: 10_000 },

  // Les parcours partagent une base : les paralléliser ferait disparaître les
  // données d'un test sous les pieds d'un autre. Même raison qu'en intégration.
  workers: 1,
  fullyParallel: false,

  // Un test instable qui passe au second essai reste un test instable. On ne
  // masque pas : en local aucun réessai, et l'intégration continue en accorde
  // un seul pour absorber la lenteur d'un runner partagé.
  retries: process.env.CI ? 1 : 0,

  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: BASE,
    // La trace ne sert qu'à comprendre un échec ; la garder sur les réussites
    // remplirait le disque pour rien.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  globalSetup: "./e2e/preparation.ts",

  webServer: {
    // ──────────────────────────────────────────────────────────────────────
    // UN VRAI BUILD, ET C'EST NÉGOCIÉ CHER
    //
    // La première version de ce fichier lançait `next dev` : démarrage en cinq
    // secondes, compilation à la demande, itération rapide. Elle a produit deux
    // échecs qui n'existaient pas.
    //
    // En mode développement, la redirection qui suit une action serveur
    // n'aboutit pas : le serveur répond bien 303 avec sa cible, et le client
    // abandonne la requête React qui devait l'y emmener. Le formulaire reste
    // sur « Un instant… », le compte est pourtant créé et la session ouverte.
    // Contre un build, le même parcours passe.
    //
    // Une suite qui échoue sur du code correct ne coûte pas seulement du temps :
    // elle apprend à ne plus la croire. On paie donc les deux minutes de build.
    //
    // `E2E_COMMAND` reste là pour qui veut délibérément viser un serveur déjà
    // lancé — en sachant ce qu'il fait.
    command:
      process.env.E2E_COMMAND ??
      `pnpm exec next build && pnpm exec next start -p ${PORT}`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,

      // Playwright pose `NODE_ENV=test`, et `next build` refuse toute valeur
      // non standard : la construction démarre quand même, puis échoue au rendu
      // des pages d'erreur avec un message qui ne parle de rien de tel. On remet
      // donc la valeur attendue — après l'étalement, qui l'avait écrasée.
      NODE_ENV: "production",
      // Les DEUX, parce que le schéma déclare `directUrl` : n'en surcharger
      // qu'une enverrait les écritures sur la base de développement.
      DATABASE_URL: url,
      DIRECT_URL: url,

      // Sans opérateur branché, la simulation est le seul moyen d'aller au bout
      // d'un achat. Elle crédite sans encaisser — c'est fait pour.
      CHECKOUT_SIMULATION_ENABLED: "1",

      APP_URL: BASE,

      // Les courriels s'écrivent dans le journal, ils ne partent nulle part.
      EMAIL_DRIVER: "console",

      // Aucun opérateur de paiement : le tunnel passe par la simulation.
      PAYMENTS_DRIVER: "",

      // Les compteurs en mémoire suffisent. En pratique ils ne se déclenchent
      // pas : une requête locale n'a pas d'en-tête d'adresse, et la garde
      // laisse alors passer. Les tests qui veulent l'éprouver posent l'en-tête
      // eux-mêmes.
      RATE_LIMIT_DRIVER: "memoire",
    },
  },
});
