import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const racine = fileURLToPath(new URL(".", import.meta.url));

// Même alias que tsconfig.json. Il doit être posé sur CHAQUE projet : la
// configuration racine n'est pas héritée par les projets Vitest.
const resolve = { alias: { "@": racine } };

export default defineConfig({
  test: {
    // Les tests d'intégration partagent une base qu'on vide entre chaque test :
    // les exécuter en parallèle ferait disparaître les données d'un fichier
    // sous les pieds d'un autre. L'option n'existe qu'à la racine, elle
    // s'applique donc aussi aux tests unitaires — ils sont assez rapides pour
    // que ça ne se voie pas.
    fileParallelism: false,
    projects: [
      {
        // Décideurs purs : ni base, ni réseau, ni DOM. Doivent rester rapides
        // et exécutables partout (BLUEPRINT §7 : « garder lib/domain sans
        // dépendances React »).
        resolve,
        test: {
          name: "unite",
          environment: "node",
          include: ["lib/**/*.test.ts", "jobs/**/*.test.ts"],
          exclude: ["**/*.integration.test.ts"],
        },
      },
      {
        // Câblage réel : Prisma, Postgres, transactions, triggers.
        // Pas de parallélisme entre fichiers — ils partagent une base qu'on vide.
        resolve,
        test: {
          name: "integration",
          environment: "node",
          include: ["lib/**/*.integration.test.ts"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
