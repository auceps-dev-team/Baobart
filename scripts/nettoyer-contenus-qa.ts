/**
 * Retirer le contenu de test des campagnes Qualitytest.
 *
 *   pnpm exec tsx --env-file=.env scripts/nettoyer-contenus-qa.ts             # essai à blanc
 *   pnpm exec tsx --env-file=.env scripts/nettoyer-contenus-qa.ts --appliquer
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEMANDÉ LE 04/10
 *
 * Les campagnes QA laissent derrière elles des ressources, communautés,
 * événements, services, offres et articles qui paraissent sur le site public.
 * Elles en laisseront d'autres : d'où un script rejouable plutôt qu'une
 * requête tapée une fois.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUI EST DU CONTENU DE TEST
 *
 * Un titre ou un nom qui contient « QA » en mot entier, ou un slug qui porte
 * « qa » entre deux tirets. C'est la convention de toutes les campagnes
 * (« QA Libre zéro mugyxm4k », « communaute-qa-mugosqo4 »). Le reste du
 * catalogue de démonstration n'en porte jamais.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE RESSOURCE VENDUE N'EST PAS EFFACÉE
 *
 * Même règle que `supprimerRessource` (lib/products/actions.ts) : un acheteur
 * garde un droit sur ce qu'il a payé, et l'écriture comptable ne doit pas
 * devenir orpheline. Elle est archivée — retirée du site, gardée dans
 * l'historique de ses acheteurs.
 */

import { PrismaClient } from "@prisma/client";

const appliquer = process.argv.includes("--appliquer");
const db = new PrismaClient();

/** « QA » en mot entier dans un titre, ou « qa » entre tirets dans un slug. */
const TITRE = "(^|[^A-Za-zÀ-ÿ])QA([^A-Za-zÀ-ÿ]|$)";
const SLUG = "(^|-)qa(-|$)";

async function principal() {
  const produits = await db.$queryRawUnsafe<{ id: string; name: string; ventes: number }[]>(
    `SELECT p.id, p.name, (SELECT count(*)::int FROM "OrderItem" oi WHERE oi."productId" = p.id) AS ventes
       FROM "Product" p WHERE p.name ~ $1 OR p.slug ~ $2`,
    TITRE,
    SLUG,
  );
  const ids = async (table: string, titre: string, slug?: string) =>
    (
      await db.$queryRawUnsafe<{ id: string; t: string }[]>(
        `SELECT id, "${titre}" AS t FROM "${table}" WHERE "${titre}" ~ $1${slug ? ` OR "${slug}" ~ $2` : ""}`,
        ...(slug ? [TITRE, SLUG] : [TITRE]),
      )
    );

  const communautes = await ids("Community", "name", "slug");
  const evenements = await ids("Event", "title");
  const services = await ids("ServiceOffer", "title");
  const offres = await ids("JobPosting", "title");
  const articles = await ids("BlogPost", "title", "slug");
  const collections = await ids("Board", "title");

  const effacables = produits.filter((p) => p.ventes === 0);
  const vendus = produits.filter((p) => p.ventes > 0);

  const ligne = (nom: string, l: { t?: string; name?: string }[]) =>
    console.log(`${nom.padEnd(26)} ${String(l.length).padStart(3)}  ${l.map((x) => x.t ?? x.name).join(" · ").slice(0, 160)}`);
  ligne("ressources à effacer", effacables);
  ligne("ressources vendues → archivées", vendus);
  ligne("communautés", communautes);
  ligne("événements", evenements);
  ligne("services", services);
  ligne("offres d'emploi", offres);
  ligne("articles", articles);
  ligne("collections", collections);

  if (!appliquer) {
    console.log("\nEssai à blanc : rien n'est modifié. Relancer avec --appliquer.");
    return;
  }

  const sans = (l: { id: string }[]) => l.map((x) => x.id);
  await db.$transaction([
    db.productTag.deleteMany({ where: { productId: { in: sans(effacables) } } }),
    db.product.deleteMany({ where: { id: { in: sans(effacables) } } }),
    db.product.updateMany({ where: { id: { in: sans(vendus) } }, data: { status: "ARCHIVED" } }),
    db.board.deleteMany({ where: { id: { in: sans(collections) } } }),
    db.community.deleteMany({ where: { id: { in: sans(communautes) } } }),
    db.event.deleteMany({ where: { id: { in: sans(evenements) } } }),
    db.serviceOffer.deleteMany({ where: { id: { in: sans(services) } } }),
    db.jobPosting.deleteMany({ where: { id: { in: sans(offres) } } }),
    db.blogPost.deleteMany({ where: { id: { in: sans(articles) } } }),
  ]);
  console.log("\nAppliqué. Les images de ces contenus partiront au prochain passage de /api/cron/medias.");
}

principal()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
