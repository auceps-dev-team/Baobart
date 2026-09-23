/**
 * Les routes d'ordonnanceur, appelées comme l'ordonnanceur les appelle.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI CE FICHIER N'EXISTAIT PAS, ET AURAIT DÛ
 *
 * `publierLesArticlesDus` a six tests d'intégration depuis v1.53.1. Ils passent
 * tous. Et pendant six versions, **aucun article planifié n'a jamais été
 * publié en production** : la route existait, la fonction marchait, et personne
 * n'appelait la route.
 *
 * Le trou était exactement là. On avait testé la fonction ; le chemin qui y
 * mène — « un appel HTTP arrive, porteur d'un secret, et des articles
 * paraissent » — n'était couvert nulle part.
 *
 * `ordonnanceur.test.ts` vérifie qu'une route planifiée existe. Celui-ci
 * vérifie qu'elle **fait quelque chose**. Les deux étaient nécessaires, et les
 * deux manquaient.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA GARDE EST ÉPROUVÉE AUTANT QUE L'EFFET
 *
 * Ces routes déclenchent des écritures en masse depuis un simple GET : publier
 * des articles, clore des dossiers, vider une file de courriels. Sans secret,
 * c'est une URL publique qui les déclenche.
 *
 * On éprouve donc les trois refus — pas de secret, mauvais secret, secret de la
 * bonne longueur mais faux — et l'on vérifie qu'aucun n'a d'effet de bord.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES MODULES SONT IMPORTÉS EN TÊTE, PAS PAR CHEMIN CALCULÉ
 *
 * Un `import(\`@/app/api/cron/${nom}/route\`)` serait plus court et ne
 * résoudrait rien : Vite ne sait pas suivre un chemin entièrement dynamique, et
 * le test échouerait à l'import plutôt que sur ce qu'il mesure.
 *
 * La table explicite a un second mérite : le dernier test vérifie qu'elle
 * couvre **exactement** ce que `vercel.json` planifie. Ajouter une route sans
 * l'ajouter ici fait tomber le test — ce qui est précisément la discipline qui
 * a manqué.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { GET as abonnements } from "@/app/api/cron/abonnements/route";
import { GET as blog } from "@/app/api/cron/blog/route";
import { GET as commandes } from "@/app/api/cron/commandes/route";
import { GET as courriels } from "@/app/api/cron/courriels/route";
import { GET as juridique } from "@/app/api/cron/juridique/route";
import { GET as securite } from "@/app/api/cron/securite/route";
import { GET as versements } from "@/app/api/cron/versements/route";
import { db } from "@/lib/db";

type Gestionnaire = (requete: Request) => Promise<Response>;

/** Le chemin planifié → son gestionnaire. Tenu à jour par le dernier test. */
const ROUTES: Record<string, Gestionnaire> = {
  "/api/cron/abonnements": abonnements,
  "/api/cron/blog": blog,
  "/api/cron/commandes": commandes,
  "/api/cron/courriels": courriels,
  "/api/cron/juridique": juridique,
  "/api/cron/securite": securite,
  "/api/cron/versements": versements,
};

const SECRET = "secret-de-test-pour-l-ordonnanceur";

let secretOrigine: string | undefined;

beforeAll(() => {
  secretOrigine = process.env.CRON_SECRET;
  process.env.CRON_SECRET = SECRET;
});

afterAll(() => {
  process.env.CRON_SECRET = secretOrigine;
});

let n = 0;

beforeEach(() => {
  n = 0;
});

/** Un appel d'ordonnanceur, avec ou sans le bon secret. */
function appel(jeton: string | null): Request {
  return new Request("https://baobart.test/api/cron/passage", {
    headers: jeton === null ? {} : { authorization: `Bearer ${jeton}` },
  });
}

async function auteur() {
  n += 1;
  return db.user.create({
    data: {
      email: `cron-${n}@baobart.test`,
      platformRole: "ADMIN",
      profile: { create: { username: `plume-cron-${n}`, displayName: `Plume ${n}` } },
    },
    select: { id: true },
  });
}

/**
 * Un article planifié, écrit directement en base.
 *
 * On ne passe pas par `creer` puis `planifier` : ce fichier éprouve la ROUTE,
 * pas la rédaction. Monter l'article à la main garde le verdict dépendant de
 * la seule chose qu'on mesure.
 */
async function articlePlanifie(quand: Date, auteurId: string) {
  n += 1;
  return db.blogPost.create({
    data: {
      authorId: auteurId,
      title: `Article planifié ${n}`,
      slug: `article-planifie-${n}-${Date.now()}`,
      body: "Un corps suffisamment long pour ressembler à un vrai article.",
      state: "BROUILLON",
      scheduledAt: quand,
    },
    select: { id: true, slug: true },
  });
}

const HIER = new Date(Date.now() - 86_400_000);
const DEMAIN = new Date(Date.now() + 86_400_000);

describe("la garde", () => {
  it("rend 404 sans secret, et ne publie rien", async () => {
    // 404 et non 401 : une route d'ordonnanceur n'a pas à confirmer son
    // existence à qui n'a pas le secret.
    const qui = await auteur();
    const article = await articlePlanifie(HIER, qui.id);

    const reponse = await blog(appel(null));
    expect(reponse.status).toBe(404);

    const apres = await db.blogPost.findUniqueOrThrow({
      where: { id: article.id },
      select: { state: true },
    });
    expect(apres.state).toBe("BROUILLON");
  });

  it("rend 404 sur un mauvais secret", async () => {
    expect((await blog(appel("pas-le-bon"))).status).toBe(404);
  });

  it("rend 404 sur un secret de la bonne longueur mais faux", async () => {
    // La comparaison est à durée constante et compare d'abord les longueurs.
    // Ce cas éprouve la boucle : un secret plus court serait refusé avant
    // qu'elle ne tourne, et la boucle ne serait jamais couverte.
    const memeLongueur = "x".repeat(SECRET.length);
    expect(memeLongueur.length).toBe(SECRET.length);

    expect((await blog(appel(memeLongueur))).status).toBe(404);
  });

  it("garde toutes les routes planifiées, pas seulement le blog", async () => {
    for (const [chemin, gestionnaire] of Object.entries(ROUTES)) {
      expect((await gestionnaire(appel(null))).status, chemin).toBe(404);
      expect((await gestionnaire(appel("pas-le-bon"))).status, chemin).toBe(404);
    }
  });
});

describe("le passage du blog", () => {
  it("publie ce dont l'heure est venue, et rend son bilan", async () => {
    // LE test qui manquait. Il part d'un appel HTTP et finit sur un article
    // publié — tout le chemin que six versions n'ont jamais parcouru.
    const qui = await auteur();
    const du = await articlePlanifie(HIER, qui.id);

    const reponse = await blog(appel(SECRET));

    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toMatchObject({ publies: 1 });

    const apres = await db.blogPost.findUniqueOrThrow({
      where: { id: du.id },
      select: { state: true, scheduledAt: true, publishedAt: true },
    });
    expect(apres.state).toBe("PUBLIE");
    // La planification est consommée : un second passage ne la retrouve pas.
    expect(apres.scheduledAt).toBeNull();
    expect(apres.publishedAt).not.toBeNull();
  });

  it("laisse tranquille ce dont l'heure n'est pas venue", async () => {
    const qui = await auteur();
    const pasEncore = await articlePlanifie(DEMAIN, qui.id);

    expect(await (await blog(appel(SECRET))).json()).toMatchObject({ publies: 0 });

    const apres = await db.blogPost.findUniqueOrThrow({
      where: { id: pasEncore.id },
      select: { state: true },
    });
    expect(apres.state).toBe("BROUILLON");
  });

  it("publie les uns sans toucher aux autres", async () => {
    const qui = await auteur();
    const du = await articlePlanifie(HIER, qui.id);
    const pasEncore = await articlePlanifie(DEMAIN, qui.id);

    expect(await (await blog(appel(SECRET))).json()).toMatchObject({ publies: 1 });

    const etats = await db.blogPost.findMany({
      where: { id: { in: [du.id, pasEncore.id] } },
      orderBy: { id: "asc" },
      select: { id: true, state: true },
    });
    expect(new Map(etats.map((e) => [e.id, e.state]))).toEqual(
      new Map([
        [du.id, "PUBLIE"],
        [pasEncore.id, "BROUILLON"],
      ]),
    );
  });

  it("rattrape plusieurs heures manquées d'un seul passage", async () => {
    // La condition est « l'heure est passée », jamais « c'est cette heure-ci ».
    // Chercher l'égalité perdrait définitivement tout article dont l'heure
    // tombe pendant une panne.
    const qui = await auteur();
    for (const jours of [1, 5, 30]) {
      await articlePlanifie(new Date(Date.now() - jours * 86_400_000), qui.id);
    }

    expect(await (await blog(appel(SECRET))).json()).toMatchObject({ publies: 3 });
    expect(await db.blogPost.count({ where: { state: "PUBLIE" } })).toBe(3);
  });

  it("ne publie rien deux fois quand deux passages se suivent", async () => {
    const qui = await auteur();
    await articlePlanifie(HIER, qui.id);

    expect(await (await blog(appel(SECRET))).json()).toMatchObject({ publies: 1 });
    expect(await (await blog(appel(SECRET))).json()).toMatchObject({ publies: 0 });
  });

  it("rend 200 quand rien n'est planifié", async () => {
    // Un passage à vide n'est pas une erreur : l'ordonnanceur lit le code de
    // retour, et un 500 horaire devient une alerte qu'on apprend à ignorer.
    const reponse = await blog(appel(SECRET));

    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toMatchObject({ publies: 0 });
  });
});

describe("le passage juridique", () => {
  it("répond et rend son bilan, même à vide", async () => {
    const reponse = await juridique(appel(SECRET));

    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toMatchObject({ clos: 0 });
  });
});

describe("la table des routes", () => {
  it("couvre exactement ce que `vercel.json` planifie", async () => {
    // Le lien entre ce fichier et l'ordonnanceur réel. Ajouter une route à
    // `vercel.json` sans l'ajouter à `ROUTES` fait tomber ce test — et c'est
    // précisément la discipline qui a manqué en v1.53.1, à un cran près.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    const planifies = (
      JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as {
        crons: { path: string }[];
      }
    ).crons.map((c) => c.path);

    expect(planifies.sort()).toEqual(Object.keys(ROUTES).sort());
  });
});
