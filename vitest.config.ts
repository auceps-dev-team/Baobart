import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const racine = fileURLToPath(new URL(".", import.meta.url));

// Même alias que tsconfig.json. Il doit être posé sur CHAQUE projet : la
// configuration racine n'est pas héritée par les projets Vitest.
//
// `server-only` est un marqueur : importé hors d'un composant serveur, il lève.
// C'est exactement ce qu'on veut au build — c'est ce garde qui aurait attrapé
// Prisma parti dans le bundle navigateur. Mais Vitest n'est ni l'un ni l'autre,
// donc on le remplace par le module vide que le paquet fournit pour ce cas.
const resolve = {
  alias: {
    "@": racine,
    "server-only": fileURLToPath(
      new URL("./node_modules/server-only/empty.js", import.meta.url),
    ),
  },
};

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
          // `scripts/` y est depuis le 24/09/2026 : les scripts de catalogue
          // n'avaient aucun test, et deux erreurs de comptage y sont passées
          // inaperçues faute de quoi que ce soit qui les rejoue.
          include: ["lib/**/*.test.ts", "jobs/**/*.test.ts", "scripts/**/*.test.ts"],
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
          // Une fois par passage, dans le processus principal : le verrou qui
          // interdit deux exécutions concurrentes sur `baobart_test`. Le
          // mettre dans `setupFiles` le ferait jouer une fois par worker, et
          // le second worker du MÊME passage se heurterait au premier.
          globalSetup: ["./vitest.global-setup.ts"],
          // Une fois par worker : la bascule d'URL et le TRUNCATE entre tests.
          setupFiles: ["./vitest.setup.ts"],
          // Le nettoyage entre deux tests vide une quarantaine de tables, et
          // chaque TRUNCATE force une écriture disque. Sous Docker Windows,
          // cela dépasse régulièrement les dix secondes par défaut — c'est le
          // système de fichiers qui est lent, pas le code. Le délai de test
          // suit, parce qu'une transaction Serializable sur un disque lent
          // n'est pas plus rapide que le disque.
          //
          // Trente secondes suffisaient sur une machine au repos ; un test les a
          // dépassées pendant qu'un build tournait à côté. Ce délai ne protège
          // de rien d'utile — aucun de ces tests ne boucle, ils attendent le
          // disque — et un échec aléatoire en intégration continue coûte plus
          // cher que la minute qu'on économise.
          //
          // Soixante à leur tour dépassées, le 11 septembre 2026. Mesuré ce
          // jour-là, sur cette machine : le `TRUNCATE` complet prend ~50 s, et
          // un simple `SELECT 1` lancé par `docker exec` en prend 15 — c'est
          // Docker Desktop sous Windows qui est lent, pas PostgreSQL et encore
          // moins le code testé.
          //
          // Deux pistes ont été écartées après mesure : `synchronous_commit =
          // off` ne change rien (le coût est dans la recréation des fichiers,
          // pas dans le journal), et remplacer `TRUNCATE` par `DELETE`
          // supposerait des contraintes différables que Prisma ne pose pas.
          //
          // ⚠️ CORRECTION DU 14 SEPTEMBRE 2026 — l'explication était fausse.
          //
          // Ce n'était pas Docker. Après `node scripts/setup-test-db.mjs`, qui
          // détruit et recrée `baobart_test`, les MÊMES 37 tests passent de
          // ~55 s à ~3 s chacun : 107 secondes au total au lieu d'une
          // demi-heure. C'est la fragmentation de la base qui coûtait, pas le
          // système de fichiers de l'hôte.
          //
          // Le `SELECT 1` mesuré à 15 s ne mesurait pas PostgreSQL : il
          // mesurait `docker exec`, c'est-à-dire la création d'un processus
          // dans un conteneur. Une mesure juste, sur le mauvais objet.
          //
          // Ces délais restent : ils ne coûtent rien quand tout va vite, et
          // ils évitent un échec aléatoire le jour où la base a vieilli.
          hookTimeout: 150_000,
          testTimeout: 150_000,
        },
      },
    ],
  },
});
