import { appendFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { db } from "./fixtures/donnees";
import { fermerLeBandeau, seConnecter } from "./fixtures/session";

/**
 * Q-30 sur toutes les pages (décidé le 21/11/2026) — le relevé brut.
 *
 * axe-core, règle `color-contrast` (WCAG 2 AA, 4,5:1 pour un texte courant).
 * Les pages de la recette (7) sont gardées par `contraste.spec.ts` ; celui-ci
 * passe sur les 108 pages de l'application, chacune avec le compte qui la
 * voit vraiment, et des listes PLEINES : une liste vide cache le contraste de
 * ses lignes.
 *
 * Il suppose une base remplie par `prisma/seed.ts`, `prisma/seed-demo.ts`,
 * `scripts/comptes-de-test.ts` et `scripts/design/remplir-listes.ts` : il ne
 * tourne donc que si CONTRASTE_COMPLET est posé, pas dans la suite ordinaire.
 *
 * Une page dont le paramètre n'a aucune donnée est SAUTÉE et le dit — jamais
 * comptée comme propre.
 */
test.skip(!process.env.CONTRASTE_COMPLET, "relevé complet : poser CONTRASTE_COMPLET sur une base remplie");

type Compte = "visiteur" | "createur" | "client" | "admin";

async function idDe(email: string) {
  return (await db.user.findUniqueOrThrow({ where: { email }, select: { id: true } })).id;
}
const COMPTES: Record<Exclude<Compte, "visiteur">, string> = {
  createur: "createur@baobart.test",
  client: "client@baobart.test",
  admin: "admin@baobart.test",
};

/** Le premier identifiant trouvé, ou `null` : la page sera sautée. */
const premier = async <T>(p: Promise<T | null>) => p;

const createurId = () => idDe(COMPTES.createur);

const ROUTES: Array<{ chemin: string; compte: Compte; resoudre?: () => Promise<string | null> }> = [
  // ── Publiques ───────────────────────────────────────────────────────────
  ...[
    "/", "/a-propos", "/blog", "/changelog", "/communautes", "/conditions", "/confidentialite", "/connexion",
    "/connexion/telephone", "/connexion/verification", "/contact", "/cookies", "/createurs", "/documentation",
    "/evenements", "/explore", "/fonctionnalites", "/infolettre/confirmer", "/infolettre/desinscription",
    "/inscription", "/jobs", "/licences", "/mot-de-passe-oublie", "/regles-de-publication", "/services",
    "/signalement", "/sponsoriser", "/support", "/tarifs",
    "/labo/animata", "/labo/boutons", "/labo/explorations", "/labo/icones",
  ].map((chemin) => ({ chemin, compte: "visiteur" as Compte })),
  { chemin: "/reinitialiser/jeton-inconnu", compte: "visiteur" },
  {
    chemin: "/products/:p", compte: "visiteur",
    resoudre: async () => (await db.product.findFirst({ where: { status: "PUBLISHED" }, select: { slug: true } }))?.slug ?? null,
  },
  {
    chemin: "/createurs/:p", compte: "visiteur",
    resoudre: async () => (await db.profile.findFirst({ where: { user: { email: COMPTES.createur } }, select: { username: true } }))?.username ?? null,
  },
  {
    chemin: "/blog/:p", compte: "visiteur",
    resoudre: async () => (await premier(db.blogPost.findFirst({ where: { state: "PUBLIE", publishedAt: { not: null } }, select: { slug: true } })))?.slug ?? null,
  },
  {
    chemin: "/communautes/:p", compte: "visiteur",
    resoudre: async () => (await db.community.findFirst({ select: { slug: true } }))?.slug ?? null,
  },
  {
    chemin: "/evenements/:p", compte: "visiteur",
    resoudre: async () => (await db.event.findFirst({ where: { state: "PUBLIE" }, select: { id: true } }))?.id ?? null,
  },
  {
    chemin: "/jobs/:p", compte: "visiteur",
    resoudre: async () => (await db.jobPosting.findFirst({ where: { state: "PUBLIE" }, select: { id: true } }))?.id ?? null,
  },
  {
    chemin: "/services/:p", compte: "visiteur",
    resoudre: async () => (await db.serviceOffer.findFirst({ where: { state: "PUBLIE" }, select: { id: true } }))?.id ?? null,
  },

  // ── Membre connecté, hors tableau de bord ───────────────────────────────
  ...["/communautes/nouvelle", "/jobs/deposer", "/jobs/mes-offres", "/jobs/mes-propositions", "/services/deposer", "/signalement/deposer"]
    .map((chemin) => ({ chemin, compte: "createur" as Compte })),
  {
    chemin: "/acheter/:p", compte: "client",
    resoudre: async () => (await db.product.findFirst({ where: { status: "PUBLISHED", price: { gt: 0 } }, select: { slug: true } }))?.slug ?? null,
  },
  {
    chemin: "/achat/:p", compte: "client",
    resoudre: async () => (await db.order.findFirst({ where: { buyer: { email: COMPTES.client } }, select: { id: true } }))?.id ?? null,
  },
  {
    chemin: "/jobs/:p/postuler", compte: "client",
    resoudre: async () => (await db.jobPosting.findFirst({ where: { state: "PUBLIE" }, select: { id: true } }))?.id ?? null,
  },

  // ── Tableau de bord, créateur ───────────────────────────────────────────
  ...[
    "/dashboard", "/dashboard/abonnements", "/dashboard/achats", "/dashboard/apercu", "/dashboard/avis", "/dashboard/badges",
    "/dashboard/bibliotheque", "/dashboard/blog", "/dashboard/blog/nouveau", "/dashboard/boutique", "/dashboard/collections",
    "/dashboard/commandes", "/dashboard/commissions", "/dashboard/devenir-vendeur", "/dashboard/evenements",
    "/dashboard/evenements/nouveau", "/dashboard/forfait", "/dashboard/gains", "/dashboard/infolettre", "/dashboard/mes-dossiers",
    "/dashboard/notifications", "/dashboard/notifications/reglages", "/dashboard/produits", "/dashboard/produits/nouveau",
    "/dashboard/profil", "/dashboard/promos", "/dashboard/publicites", "/dashboard/publicites/nouvelle",
    "/dashboard/remboursements", "/dashboard/statistiques", "/dashboard/suivis", "/dashboard/telechargements",
    "/dashboard/temoignage", "/dashboard/ventes", "/dashboard/ventes/remboursements", "/dashboard/versements",
  ].map((chemin) => ({ chemin, compte: "createur" as Compte })),
  {
    chemin: "/dashboard/produits/:p", compte: "createur",
    resoudre: async () => (await db.product.findFirst({ where: { sellerId: await createurId() }, select: { id: true } }))?.id ?? null,
  },
  {
    chemin: "/dashboard/collections/:p", compte: "createur",
    resoudre: async () => (await db.board.findFirst({ where: { ownerId: await createurId() }, select: { id: true } }))?.id ?? null,
  },
  {
    chemin: "/dashboard/blog/:p", compte: "createur",
    resoudre: async () => (await premier(db.blogPost.findFirst({ where: { authorId: await createurId() }, select: { id: true } })))?.id ?? null,
  },
  {
    chemin: "/dashboard/evenements/:p", compte: "createur",
    resoudre: async () => (await db.event.findFirst({ where: { organizerId: await createurId() }, select: { id: true } }))?.id ?? null,
  },
  {
    chemin: "/dashboard/evenements/:p/inscrits", compte: "createur",
    resoudre: async () => (await db.event.findFirst({ where: { organizerId: await createurId() }, select: { id: true } }))?.id ?? null,
  },
  {
    chemin: "/dashboard/jobs/:p/candidatures", compte: "createur",
    resoudre: async () => (await db.jobPosting.findFirst({ where: { recruiterId: await createurId() }, select: { id: true } }))?.id ?? null,
  },
  {
    chemin: "/dashboard/publicites/:p", compte: "createur",
    resoudre: async () => (await db.ad.findFirst({ where: { createdById: await createurId() }, select: { id: true } }))?.id ?? null,
  },
  {
    chemin: "/dashboard/bibliotheque/certificat/:p", compte: "client",
    resoudre: async () => (await db.orderItem.findFirst({ where: { order: { buyer: { email: COMPTES.client } }, state: "SUCCESSFUL" }, select: { id: true } }))?.id ?? null,
  },

  // ── Tableau de bord, administration ─────────────────────────────────────
  ...[
    "/dashboard/messages-recus", "/dashboard/moderation", "/dashboard/remboursements-a-trancher", "/dashboard/signalements",
    "/dashboard/statuts", "/dashboard/temoignages",
    "/dashboard/systeme/blocklist", "/dashboard/systeme/configuration", "/dashboard/systeme/emails",
    "/dashboard/systeme/membres", "/dashboard/systeme/paiements", "/dashboard/systeme/versements",
  ].map((chemin) => ({ chemin, compte: "admin" as Compte })),
];

/**
 * Ce que les graines ne créent pas : un article, un événement, une offre, un
 * service, une communauté, une collection et une publicité du créateur de
 * test, publiés. Sans eux, douze routes étaient sautées au premier relevé
 * (22/11/2026). Une fois par base : chacun se retrouve par sa marque.
 */
const MARQUE = "contraste-q30";
async function assurerDonnees() {
  const createur = await createurId();
  const dans = (jours: number) => new Date(Date.now() + jours * 86_400_000);

  if (!(await db.blogPost.findFirst({ where: { slug: MARQUE } }))) {
    await db.blogPost.create({
      data: { authorId: createur, title: "Contraste : un article", slug: MARQUE, body: "Un paragraphe pour mesurer.\n\nUn second, plus long, pour remplir la page.", state: "PUBLIE", publishedAt: new Date() },
    });
  }
  if (!(await db.event.findFirst({ where: { title: "Contraste : un atelier" } }))) {
    await db.event.create({
      data: { organizerId: createur, title: "Contraste : un atelier", kind: "WORKSHOP", description: "Un atelier pour mesurer le contraste.", startsAt: dans(10), endsAt: dans(11), state: "PUBLIE" },
    });
  }
  if (!(await db.jobPosting.findFirst({ where: { title: "Contraste : une offre" } }))) {
    await db.jobPosting.create({
      data: { recruiterId: createur, title: "Contraste : une offre", type: "FREELANCE", mode: "REMOTE", description: "Une offre pour mesurer le contraste.", state: "PUBLIE" },
    });
  }
  if (!(await db.serviceOffer.findFirst({ where: { title: "Contraste : un service" } }))) {
    const categorie = await db.serviceCategory.findFirstOrThrow({ select: { id: true } });
    await db.serviceOffer.create({
      data: { creatorId: createur, categoryId: categorie.id, title: "Contraste : un service", description: "Un service pour mesurer le contraste.", startingPrice: 25_000, deliveryDays: 5, state: "PUBLIE" },
    });
  }
  if (!(await db.community.findFirst({ where: { slug: MARQUE } }))) {
    await db.community.create({ data: { creatorId: createur, name: "Contraste : une communauté", slug: MARQUE } });
  }
  if (!(await db.board.findFirst({ where: { ownerId: createur, title: "Contraste : une collection" } }))) {
    await db.board.create({ data: { ownerId: createur, title: "Contraste : une collection" } });
  }
  if (!(await db.ad.findFirst({ where: { title: "Contraste : une publicité" } }))) {
    await db.ad.create({
      data: { title: "Contraste : une publicité", imageUrl: "/og.png", imageWidth: 1200, imageHeight: 630, linkUrl: "https://example.org", frequency: 1, createdById: createur },
    });
  }
}

/**
 * Faire défiler jusqu'en bas, comme un lecteur, avant de mesurer.
 *
 * Les effets au défilement (`components/anime/defilement.tsx`) font
 * apparaître les sections en entrant à l'écran : au premier relevé, axe
 * mesurait des titres hors de l'écran, encore transparents (1,06:1) — un état
 * que personne ne voit. L'état intermédiaire, lui, est couvert autrement : le
 * plancher de `defil-allume` passe de 0,18 à 0,6 (5,50:1 sur /a-propos, dont le
 * paragraphe est lui-même à 0,85), gardé par `contraste.spec.ts` sans défilement.
 */
async function defilerJusquEnBas(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 25));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page.waitForTimeout(250);
}

async function mesurer(page: Page, etiquette: string) {
  const r = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
  const noeuds = r.violations.flatMap((v) => v.nodes);
  if (process.env.AXE_RELEVE) {
    for (const n of noeuds) {
      const d = (n.any[0]?.data ?? {}) as { contrastRatio?: number; fgColor?: string; bgColor?: string; fontSize?: string; fontWeight?: string };
      appendFileSync(
        process.env.AXE_RELEVE,
        `${etiquette}\t${d.contrastRatio}\t${d.fgColor}\t${d.bgColor}\t${d.fontSize}\t${d.fontWeight}\t${n.target.join(" ")}\t${n.html.slice(0, 160).replace(/\s+/g, " ")}\n`,
      );
    }
  }
  return noeuds.length;
}

test.beforeAll(async () => {
  await assurerDonnees();
});

for (const largeur of [1440, 360]) {
  test.describe(`contraste à ${largeur} px — toutes les pages (Q-30)`, () => {
    test.use({ viewport: { width: largeur, height: largeur === 360 ? 740 : 900 } });

    for (const route of ROUTES) {
      test(`${route.chemin} (${route.compte})`, async ({ page, context, baseURL }) => {
        let chemin = route.chemin;
        if (route.resoudre) {
          const p = await route.resoudre();
          test.skip(p === null, `aucune donnée pour ${route.chemin} : page NON mesurée`);
          chemin = chemin.replace(":p", encodeURIComponent(p!));
        }
        if (route.compte !== "visiteur") await seConnecter(context, await idDe(COMPTES[route.compte]), baseURL!);

        const reponse = await page.goto(chemin);
        await fermerLeBandeau(page);
        await defilerJusquEnBas(page);
        const finale = new URL(page.url()).pathname;
        const n = await mesurer(page, `${largeur}\t${route.chemin}\t${route.compte}`);
        if (process.env.AXE_PAGES) {
          appendFileSync(process.env.AXE_PAGES, `${largeur}\t${route.chemin}\t${route.compte}\t${reponse?.status()}\t${finale}\t${n}\n`);
        }
        expect.soft(n, `${chemin} à ${largeur} px : textes sous 4,5:1`).toBe(0);
      });
    }
  });
}
