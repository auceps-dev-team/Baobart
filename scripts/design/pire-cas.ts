/**
 * Le pire cas réaliste, posé dans la base de développement pour éprouver les vues.
 *
 *   pnpm design:pire-cas              # pose le jeu (idempotent : purge d'abord)
 *   pnpm design:pire-cas -- --purger  # retire tout ce que ce script a posé
 *   pnpm design:revue -- --pire-cas   # mesure les vues avec ces données
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI
 *
 * Skill Halo `break-ui` (lu le 20/11/2026) : les données de démonstration sont
 * choisies, sans que personne s'en rende compte, pour que le design ait l'air
 * juste — des noms qui tiennent sur une ligne, des compteurs sans séparateur,
 * tous les champs remplis. Ce jeu défait ce choix, champ par champ.
 *
 * Deux règles du skill, tenues ici :
 *   - plausible ou adossé au schéma, jamais aléatoire : chaque valeur est
 *     quelque chose qu'un vrai utilisateur de Baobart peut produire, ou la
 *     limite que la validation accepte réellement (voir LIMITES) ;
 *   - la donnée change, pas le composant : tout entre par la base, comme les
 *     données de démonstration. Aucun composant n'est retouché pour « voir ».
 *
 * La bascule « démonstration / pire cas » du skill est ici le choix du compte
 * et des fiches : `design:revue -- --pire-cas` ouvre les vues avec ce jeu,
 * sans `--pire-cas` avec celui de la démonstration. Rien ne change pour un
 * vrai visiteur : la bascule n'existe que dans l'outil de mesure.
 *
 * Tout ce qu'il pose se reconnaît au domaine `pire-cas.test` (adresses) et au
 * préfixe `pire-cas-` (slugs) : `--purger` le retrouve sans toucher au reste.
 * Il refuse toute base qui n'est pas locale : il crée des commandes réussies.
 */
import { PrismaClient } from "@prisma/client";

import { baseLocale } from "./base-locale";
// Les valeurs, et les limites réelles dont elles viennent : pire-cas-donnees.ts.
import { BIO, DESCRIPTION, DOMAINE, PIRE_CAS, PREFIXE } from "./pire-cas-donnees";

const db = new PrismaClient();

function refuserSiCeNEstPasLocal() {
  if (!baseLocale(process.env.DATABASE_URL ?? "")) {
    console.error("Refus : DATABASE_URL ne pointe pas sur une base locale.");
    process.exit(1);
  }
}

async function purger() {
  const comptes = await db.user.findMany({ where: { email: { endsWith: `.${DOMAINE}` } }, select: { id: true } });
  const comptesCourts = await db.user.findMany({ where: { email: { endsWith: `@${DOMAINE}` } }, select: { id: true } });
  const ids = [...comptes, ...comptesCourts].map((c) => c.id);
  const produits = await db.product.findMany({ where: { slug: { startsWith: PREFIXE } }, select: { id: true } });
  const pids = produits.map((p) => p.id);

  await db.productReview.deleteMany({ where: { OR: [{ authorId: { in: ids } }, { productId: { in: pids } }] } });
  await db.like.deleteMany({ where: { productId: { in: pids } } });
  const commandes = await db.order.findMany({ where: { items: { some: { productId: { in: pids } } } }, select: { id: true } });
  await db.orderItem.deleteMany({ where: { orderId: { in: commandes.map((c) => c.id) } } });
  await db.order.deleteMany({ where: { id: { in: commandes.map((c) => c.id) } } });
  await db.product.deleteMany({ where: { id: { in: pids } } });
  await db.follow.deleteMany({ where: { OR: [{ followerId: { in: ids } }, { followingId: { in: ids } }] } });
  await db.session.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`purgé : ${ids.length} comptes, ${pids.length} ressources, ${commandes.length} commandes`);
}

async function poser() {
  const client = await db.user.findUnique({ where: { email: "client@baobart.test" }, select: { id: true } });
  if (!client) throw new Error("Compte client@baobart.test absent : lancer « pnpm comptes:test » d'abord.");

  const creer = (c: { email: string; username: string; displayName: string }, profil: Record<string, unknown> = {}) =>
    db.user.create({
      data: { email: c.email, profile: { create: { username: c.username, displayName: c.displayName, ...profil } } },
      select: { id: true },
    });

  const long = await creer(PIRE_CAS.createurLong, {
    bio: BIO,
    city: PIRE_CAS.createurLong.city,
    country: "SN",
    // Une image qui n'existe pas : le skill veut voir le repli, pas l'icône d'image cassée.
    avatarUrl: "https://example.invalid/avatar-introuvable.jpg",
    followerCount: 1_284,
    workCount: 1,
    ratingCount: 1,
    viewCount: 1_234_567,
  });
  await creer(PIRE_CAS.createurCourt, { followerCount: 0, workCount: 0 });
  const acheteur = await creer(PIRE_CAS.acheteur);
  const emoji = await creer(PIRE_CAS.acheteuseEmoji);

  const t0 = Date.now();
  const produits: { id: string; price: number }[] = [];
  for (const [i, p] of PIRE_CAS.produits.entries()) {
    const { cle, ...champs } = p;
    produits.push(
      await db.product.create({
        data: {
          ...champs,
          sellerId: long.id,
          slug: `${PREFIXE}${cle}`,
          currency: "XOF",
          status: "PUBLISHED",
          description: cle === "long" ? DESCRIPTION : null,
          // Les plus récentes en tête des listes, dans l'ordre du tableau.
          createdAt: new Date(t0 - i * 60_000),
        },
        select: { id: true, price: true },
      }),
    );
  }

  // Ventes : l'acheteur au long nom, l'acheteuse emoji, et le client de test (ses achats et sa bibliothèque).
  for (const [i, p] of produits.entries()) {
    if (p.price === 0) continue;
    for (const buyerId of [acheteur.id, emoji.id, client.id]) {
      await db.order.create({
        data: {
          buyerId,
          total: p.price,
          currency: "XOF",
          createdAt: new Date(t0 - i * 60_000),
          items: { create: { productId: p.id, quantity: 1, price: p.price, state: "SUCCESSFUL" } },
        },
      });
    }
  }
  await db.productReview.create({
    data: {
      productId: produits[0]!.id,
      authorId: acheteur.id,
      rating: 5,
      body:
        "Très bon kit, livré complet avec les sources. J'ai pu adapter le menu à mon maquis en une soirée, et l'enseigne " +
        "a été imprimée sans retouche par l'imprimeur du marché Sandaga. Seul regret : les visuels pour TikTok sont au " +
        "format 4:5 et non 9:16, il a fallu les recadrer. Je recommande quand même sans hésiter.",
    },
  });
  await db.follow.createMany({
    data: [
      { followerId: acheteur.id, followingId: long.id },
      { followerId: emoji.id, followingId: long.id },
      { followerId: client.id, followingId: long.id },
    ],
  });
  console.log(`posé : 4 comptes, ${produits.length} ressources, des ventes, un avis — domaine ${DOMAINE}`);
}

async function main() {
  refuserSiCeNEstPasLocal();
  await purger();
  if (!process.argv.includes("--purger")) await poser();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
