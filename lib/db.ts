import { PrismaClient } from "@prisma/client";

/**
 * Client Prisma — singleton.
 *
 * Le hot-reload de Next.js recrée les modules à chaque édition : sans ce cache
 * global, chaque rechargement ouvre un nouveau pool et épuise les connexions
 * Postgres (piège n°3 du PLAN §8.1).
 *
 * L'instrumentation des requêtes lentes est branchée dès M0 (PLAN §8.2-5) :
 * on veut voir les régressions arriver, pas les découvrir en production.
 */

const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS ?? 200);

function createPrismaClient() {
  const client = new PrismaClient({
    log: [
      { emit: "event", level: "query" },
      { emit: "stdout", level: "warn" },
      { emit: "stdout", level: "error" },
    ],
  });

  client.$on("query", (event) => {
    if (event.duration >= SLOW_QUERY_MS) {
      console.warn(
        `[requête lente ${event.duration} ms] ${event.query}`,
      );
    }
  });

  return client;
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
