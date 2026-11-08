import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * La configuration que Stryker lance (`stryker.config.json`), et elle seule.
 *
 * Stryker glisse de petites erreurs dans le code — un `>=` changé en `>`, un
 * `&&` en `||` — et relance les tests : une erreur que personne n'attrape dit
 * qu'un test manque. Il ne relance ici que les tests UNITAIRES des modules
 * purs : un test d'intégration rejoué des centaines de fois contre PostgreSQL
 * prendrait des heures, et n'apprendrait rien de plus sur une règle pure.
 *
 * Ajoutée le 08/11/2026 avec le lot 2 (mérites). Lancement à la main :
 * `pnpm test:mutation`. Pas dans la CI : un passage dure plusieurs minutes.
 */
const racine = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": racine,
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["lib/badges/*.test.ts", "lib/systeme/contraste.test.ts"],
    exclude: ["**/*.integration.test.ts"],
  },
});
