import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { db, unique } from "./fixtures/donnees";

/**
 * Les passages de l'ordonnanceur, appelés par HTTP comme Vercel les appelle.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE CHAÎNON QUE NI L'UNITAIRE NI L'INTÉGRATION NE VOIENT
 *
 * `publierLesArticlesDus` a six tests d'intégration depuis v1.53.1.
 * `lib/systeme/cron.integration.test.ts` en ajoute douze sur le gestionnaire.
 * Tous passent, et **aucun ne prouve que Next sert la route à cette adresse**.
 *
 * Ils importent la fonction `GET` et l'appellent. Si le fichier était rangé
 * sous `app/api/crons/blog/` — avec un s — ils passeraient tous, et Vercel
 * appellerait une URL qui n'existe pas.
 *
 * Ce n'est pas une hypothèse d'école : c'est exactement la forme du défaut qui
 * a fait que, pendant six versions, aucun article planifié n'a jamais été
 * publié en production. Le code marchait, la route existait, personne
 * n'appelait. La différence tenait à une ligne dans un fichier que rien ne
 * reliait au code.
 *
 * Ce parcours ferme le chaînon : il part d'une requête HTTP sur l'URL réelle,
 * contre un vrai build, et finit sur une ligne changée en base.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL PARCOURT `vercel.json`, IL NE RECOPIE PAS LA LISTE
 *
 * Recopier les six chemins ici ferait une septième liste à tenir à jour, et la
 * prochaine route ajoutée ne serait pas couverte. On lit le fichier qui fait
 * autorité — celui que Vercel lit aussi.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * SEULES DEUX ROUTES SONT APPELÉES AVEC LE SECRET
 *
 * Les quatre autres ont de vrais effets : `versements` déclenche des virements,
 * `courriels` vide une file d'envoi, `commandes` et `abonnements` touchent à
 * des cycles de facturation. Les lancer « pour voir si ça répond » contre une
 * base de test serait un geste irréversible pour une information que le refus
 * sans secret donne déjà.
 *
 * Ce que ça laisse non couvert est dit franchement plutôt que masqué par un
 * test qui n'appelle rien.
 */

const JOUR = 86_400_000;

/** Les chemins que Vercel appellera vraiment. */
function cheminsPlanifies(): string[] {
  // Lu au moment du test, pas figé : c'est le fichier qui fait autorité.
  const brut = readFileSync("vercel.json", "utf8");
  return (JSON.parse(brut) as { crons: { path: string }[] }).crons.map(
    (c) => c.path,
  );
}

function secret(): string {
  const valeur = process.env.CRON_SECRET;
  if (!valeur) {
    throw new Error(
      "CRON_SECRET absent : ce parcours ne peut rien prouver sans lui.",
    );
  }
  return valeur;
}

test.describe("la garde des passages", () => {
  test("toutes les routes planifiées sont servies, et refusent sans secret", async ({
    request,
  }) => {
    const chemins = cheminsPlanifies();
    expect(chemins.length, "vercel.json ne planifie rien").toBeGreaterThan(0);

    for (const chemin of chemins) {
      const reponse = await request.get(chemin);

      // 404 et non 401 : une route d'ordonnanceur n'a pas à confirmer son
      // existence à qui n'a pas le secret.
      //
      // Le message d'échec distingue les deux causes possibles, parce qu'elles
      // n'appellent pas la même correction : 200 veut dire « la garde est
      // tombée », et tout autre code veut dire « la route n'est pas là où
      // vercel.json croit ».
      expect(
        reponse.status(),
        `${chemin} a répondu ${reponse.status()} — attendu 404 (route servie et gardée)`,
      ).toBe(404);
    }
  });

  test("un mauvais secret ne passe pas davantage", async ({ request }) => {
    const reponse = await request.get("/api/cron/blog", {
      headers: { authorization: "Bearer pas-le-bon-secret-du-tout" },
    });

    expect(reponse.status()).toBe(404);
  });
});

test.describe("le passage du blog", () => {
  test("publie un article dont l'heure est venue, et laisse le reste", async ({
    request,
  }) => {
    // ════════════════════════════════════════════════════════════════════════
    // LE PARCOURS QUI MANQUAIT
    //
    // Requête HTTP réelle → route servie par un vrai build → fonction →
    // écriture en base. Chaque maillon a été testé séparément ; c'est leur
    // enchaînement qui ne l'avait jamais été, et c'est lui qui était rompu.
    const marque = unique("cron-e2e-");

    const auteur = await db.user.create({
      data: {
        email: `${marque}@baobart.test`,
        platformRole: "ADMIN",
        profile: { create: { username: marque, displayName: "Plume e2e" } },
      },
      select: { id: true },
    });

    const planifier = (suffixe: string, quand: Date) =>
      db.blogPost.create({
        data: {
          authorId: auteur.id,
          title: `Article ${suffixe}`,
          slug: `${marque}-${suffixe}`,
          body: "Un corps assez long pour ressembler à un vrai article publié.",
          state: "BROUILLON",
          scheduledAt: quand,
        },
        select: { id: true },
      });

    const du = await planifier("du", new Date(Date.now() - JOUR));
    const vieux = await planifier("vieux", new Date(Date.now() - 30 * JOUR));
    const futur = await planifier("futur", new Date(Date.now() + JOUR));

    // ── L'appel ────────────────────────────────────────────────────────────
    const reponse = await request.get("/api/cron/blog", {
      headers: { authorization: `Bearer ${secret()}` },
    });

    expect(reponse.status()).toBe(200);
    const bilan = (await reponse.json()) as { publies: number };
    // `toBeGreaterThanOrEqual` et non `toBe` : la base e2e n'est vidée qu'une
    // fois par campagne, et un autre parcours a pu y laisser un brouillon
    // planifié. Exiger le compte exact ferait échouer ce test pour une raison
    // qui n'est pas la sienne.
    expect(bilan.publies).toBeGreaterThanOrEqual(2);

    // ── Le verdict, lu en base ─────────────────────────────────────────────
    const apres = await db.blogPost.findMany({
      where: { id: { in: [du.id, vieux.id, futur.id] } },
      select: { id: true, state: true, scheduledAt: true, publishedAt: true },
    });
    const parId = new Map(apres.map((a) => [a.id, a]));

    // L'échéance dépassée paraît, et sa planification est consommée : un
    // second passage ne doit pas la retrouver.
    expect(parId.get(du.id)?.state).toBe("PUBLIE");
    expect(parId.get(du.id)?.scheduledAt).toBeNull();
    expect(parId.get(du.id)?.publishedAt).not.toBeNull();

    // Un retard de trente jours se rattrape. La condition est « l'heure est
    // passée », jamais « c'est cette heure-ci » — sans quoi une panne perdrait
    // définitivement l'article.
    expect(parId.get(vieux.id)?.state).toBe("PUBLIE");

    // Et le futur reste tranquille.
    expect(parId.get(futur.id)?.state).toBe("BROUILLON");
    expect(parId.get(futur.id)?.scheduledAt).not.toBeNull();
  });

  test("un second passage immédiat ne republie rien", async ({ request }) => {
    const marque = unique("cron-e2e-bis-");

    const auteur = await db.user.create({
      data: {
        email: `${marque}@baobart.test`,
        platformRole: "ADMIN",
        profile: { create: { username: marque, displayName: "Plume bis" } },
      },
      select: { id: true },
    });

    const article = await db.blogPost.create({
      data: {
        authorId: auteur.id,
        title: "Article à ne publier qu'une fois",
        slug: `${marque}-unique`,
        body: "Un corps assez long pour ressembler à un vrai article publié.",
        state: "BROUILLON",
        scheduledAt: new Date(Date.now() - JOUR),
      },
      select: { id: true },
    });

    const entete = { authorization: `Bearer ${secret()}` };
    await request.get("/api/cron/blog", { headers: entete });

    const second = await request.get("/api/cron/blog", { headers: entete });
    expect((await second.json()).publies).toBe(0);

    // Et la date de parution n'a pas bougé au second passage : la republier
    // ferait remonter l'article en tête de la liste publique à chaque heure.
    const apres = await db.blogPost.findUniqueOrThrow({
      where: { id: article.id },
      select: { state: true, publishedAt: true },
    });
    expect(apres.state).toBe("PUBLIE");
    expect(apres.publishedAt).not.toBeNull();
  });
});

test.describe("le passage juridique", () => {
  test("répond et rend son bilan", async ({ request }) => {
    // Appelé avec le secret parce qu'il n'a pas d'effet de bord hors de sa
    // propre table : il ne clôt que des dossiers dont l'échéance est passée,
    // et il n'y en a aucun dans une base fraîche.
    const reponse = await request.get("/api/cron/juridique", {
      headers: { authorization: `Bearer ${secret()}` },
    });

    expect(reponse.status()).toBe(200);
    expect(await reponse.json()).toMatchObject({ clos: expect.any(Number) });
  });
});
