import { PrismaClient } from "@prisma/client";

/**
 * Client Prisma — singleton paresseux.
 *
 * Le hot-reload de Next.js recrée les modules à chaque édition : sans ce cache
 * global, chaque rechargement ouvre un nouveau pool et épuise les connexions
 * Postgres (piège n°3 du PLAN §8.1).
 *
 * L'instanciation est volontairement différée jusqu'au premier accès réel : les
 * tests unitaires, le typecheck et la collecte de données de `next build` ne
 * doivent pas échouer uniquement parce que `prisma generate` n'a pas encore pu
 * télécharger ses engines dans un environnement isolé. Au runtime, le premier
 * appel à `db.product…` construit le client comme avant.
 *
 * L'instrumentation des requêtes lentes est branchée dès M0 (PLAN §8.2-5) :
 * on veut voir les régressions arriver, pas les découvrir en production.
 */

const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS ?? 200);

type PrismaClientInstance = InstanceType<typeof PrismaClient>;

function createPrismaClient(): PrismaClientInstance {
  const client = new PrismaClient({
    log: [
      { emit: "event", level: "query" },
      { emit: "stdout", level: "warn" },
      { emit: "stdout", level: "error" },
    ],
  }) as PrismaClientInstance;

  client.$on("query", (event: { duration: number; query: string }) => {
    if (event.duration >= SLOW_QUERY_MS) {
      console.warn(`[requête lente ${event.duration} ms] ${event.query}`);
    }
  });

  return client;
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientInstance;
};

function prisma(): PrismaClientInstance {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
}

export const db = new Proxy({} as PrismaClientInstance, {
  get(_target, property, receiver) {
    const client = prisma();
    const value = Reflect.get(client, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
