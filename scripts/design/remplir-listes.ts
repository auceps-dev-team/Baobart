/**
 * Remplit les listes du tableau de bord au-delà d'une page, pour MESURER la pagination.
 *
 *   pnpm design:remplir-listes            # pose 30 éléments par liste (idempotent)
 *   pnpm design:remplir-listes -- --purger # retire tout ce que ce script a posé
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI
 *
 * La règle demandée le 14/11 — « une liste paginée ne dépasse jamais la barre
 * latérale » — se juge sur une liste PLEINE. Les données de démonstration en
 * laissent la plupart vides : une liste vide tient toujours sous le menu, et la
 * mesure réussirait sans rien mesurer. Ce script en remplit trente de chaque
 * sorte, pour les comptes de `pnpm comptes:test`, puis `pnpm design:captures`
 * dit, page par page, de combien la page descend sous le menu.
 *
 * Tout ce qu'il pose porte la marque `liste-` (adresses, slugs, clés, codes) :
 * `--purger` le retrouve sans toucher au reste.
 *
 * Il refuse toute base qui n'est pas locale : il crée des commandes réussies,
 * qui n'ont rien à faire ailleurs qu'en développement.
 */
import { PrismaClient } from "@prisma/client";

const N = 30;
const MARQUE = "liste-";
const db = new PrismaClient();

function refuserSiCeNEstPasLocal() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("localhost") && !url.includes("127.0.0.1")) {
    console.error("Refus : DATABASE_URL ne pointe pas sur une base locale.");
    process.exit(1);
  }
}

async function compte(email: string) {
  const u = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!u) throw new Error(`Compte ${email} absent : lancer « pnpm comptes:test » d'abord.`);
  return u.id;
}

async function purger() {
  const membres = await db.user.findMany({ where: { email: { startsWith: MARQUE } }, select: { id: true } });
  const ids = membres.map((m) => m.id);
  const produits = await db.product.findMany({ where: { slug: { startsWith: MARQUE } }, select: { id: true } });
  const pids = produits.map((p) => p.id);

  await db.productReview.deleteMany({ where: { OR: [{ authorId: { in: ids } }, { productId: { in: pids } }] } });
  await db.like.deleteMany({ where: { productId: { in: pids } } });
  const commandes = await db.order.findMany({ where: { items: { some: { productId: { in: pids } } } }, select: { id: true } });
  await db.orderItem.deleteMany({ where: { orderId: { in: commandes.map((c) => c.id) } } });
  await db.order.deleteMany({ where: { id: { in: commandes.map((c) => c.id) } } });
  await db.product.deleteMany({ where: { id: { in: pids } } });
  await db.follow.deleteMany({ where: { OR: [{ followerId: { in: ids } }, { followingId: { in: ids } }] } });
  await db.board.deleteMany({ where: { title: { startsWith: "Liste collection " } } });
  await db.notification.deleteMany({ where: { cle: { startsWith: MARQUE } } });
  await db.offerCode.deleteMany({ where: { code: { startsWith: "LISTE" } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`purgé : ${ids.length} membres, ${pids.length} ressources, ${commandes.length} commandes`);
}

async function remplir() {
  const client = await compte("client@baobart.test");
  const createur = await compte("createur@baobart.test");
  const pas = (i: number) => new Date(Date.now() - i * 3_600_000); // une heure d'écart : un ordre stable

  // Trente membres, qui suivent le créateur, et que le client suit.
  const membres: string[] = [];
  for (let i = 1; i <= N; i++) {
    const u = await db.user.create({
      data: {
        email: `${MARQUE}membre-${i}@baobart.test`,
        profile: { create: { username: `${MARQUE}membre-${i}`, displayName: `Membre de liste ${i}` } },
      },
      select: { id: true },
    });
    membres.push(u.id);
  }
  await db.follow.createMany({
    data: membres.flatMap((m, i) => [
      { followerId: client, followingId: m, createdAt: pas(i) },
      { followerId: m, followingId: createur, createdAt: pas(i) },
    ]),
  });

  // Trente ressources du créateur, achetées et aimées par le client.
  for (let i = 1; i <= N; i++) {
    const p = await db.product.create({
      data: {
        sellerId: createur,
        name: `Ressource de liste ${i}`,
        slug: `${MARQUE}ressource-${i}`,
        price: 1_000 * i,
        currency: "XOF",
        status: "PUBLISHED",
        createdAt: pas(i),
      },
      select: { id: true },
    });
    await db.order.create({
      data: {
        buyerId: client,
        total: 1_000 * i,
        currency: "XOF",
        createdAt: pas(i),
        items: { create: { productId: p.id, quantity: 1, price: 1_000 * i, state: "SUCCESSFUL" } },
      },
    });
    await db.like.create({ data: { userId: client, productId: p.id, createdAt: pas(i) } });
    await db.productReview.create({
      data: { productId: p.id, authorId: membres[i - 1]!, rating: 1 + (i % 5), body: `Avis de liste ${i}.`, createdAt: pas(i) },
    });
  }

  // Trente collections, trente notifications de chaque côté, trente codes promo.
  await db.board.createMany({
    data: Array.from({ length: N }, (_, i) => ({ ownerId: client, title: `Liste collection ${i + 1}`, createdAt: pas(i) })),
  });
  await db.notification.createMany({
    data: [client, createur].flatMap((userId) =>
      Array.from({ length: N }, (_, i) => ({
        userId,
        type: "INFO",
        cle: `${MARQUE}${userId}-${i + 1}`,
        titre: `Notification de liste ${i + 1}`,
        corps: "Posée par scripts/design/remplir-listes.ts pour mesurer la pagination.",
        createdAt: pas(i),
      })),
    ),
  });
  await db.offerCode.createMany({
    data: Array.from({ length: N }, (_, i) => ({
      sellerId: createur,
      code: `LISTE${String(i + 1).padStart(2, "0")}`,
      type: "PERCENT",
      amount: 10,
      createdAt: pas(i),
    })),
  });
  console.log(`posé : ${N} de chaque — membres, abonnements, ressources, commandes, j'aime, avis, collections, notifications, codes`);
}

async function main() {
  refuserSiCeNEstPasLocal();
  await purger();
  if (!process.argv.includes("--purger")) await remplir();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
