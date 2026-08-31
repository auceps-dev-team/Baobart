import { expect, test } from "@playwright/test";

/**
 * Ce que l'application refuse de montrer.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI CES TESTS-LÀ ONT LEUR PLACE AU NAVIGATEUR
 *
 * Une garde vit dans le code d'une page. Next.js **ne réexécute pas un layout**
 * entre deux pages sœurs : une garde posée dans le layout d'une section ne
 * s'exécute qu'à la première page visitée, et les suivantes s'ouvrent sans
 * contrôle. Aucun test unitaire ne voit cela — il faut naviguer.
 *
 * C'est pourquoi chaque écran d'administration appelle `exigerAdministrateur()`
 * lui-même, et pourquoi ce fichier les visite **un par un**.
 */

/** Les écrans d'exploitation. Chacun doit se garder seul. */
const ADMINISTRATION = [
  "/dashboard/systeme/configuration",
  "/dashboard/systeme/emails",
  "/dashboard/systeme/paiements",
  "/dashboard/systeme/versements",
  "/dashboard/systeme/membres",
];

test.describe("un visiteur anonyme", () => {
  test("est renvoyé vers la connexion depuis l'espace personnel", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/connexion/);
  });

  for (const chemin of ADMINISTRATION) {
    test(`ne trouve rien sur ${chemin}`, async ({ page }) => {
      const reponse = await page.goto(chemin);

      // 404, et non 403. « Accès refusé » confirmerait qu'il y a quelque chose
      // là, et donnerait à quelqu'un une raison d'insister.
      //
      // La redirection vers la connexion est acceptable aussi : elle ne dit pas
      // davantage. Ce qui ne l'est pas, c'est un 200 sur la page.
      const statut = reponse?.status() ?? 0;
      const urlFinale = page.url();

      const refuse = statut === 404 || /\/connexion/.test(urlFinale);
      expect(
        refuse,
        `${chemin} a répondu ${statut} sur ${urlFinale} — un écran d'exploitation ne doit jamais s'ouvrir à un anonyme`,
      ).toBe(true);
    });
  }
});

test.describe("les pages publiques restent publiques", () => {
  test("l'accueil s'ouvre sans compte", async ({ page }) => {
    const reponse = await page.goto("/");
    expect(reponse?.status()).toBe(200);
  });

  test("l'explorateur s'ouvre sans compte", async ({ page }) => {
    const reponse = await page.goto("/explore");
    expect(reponse?.status()).toBe(200);
  });

  test("une ressource inexistante rend 404, pas une page vide", async ({
    page,
  }) => {
    const reponse = await page.goto("/products/ressource-qui-n-existe-pas");
    expect(reponse?.status()).toBe(404);
  });
});

test.describe("les routes d'ordonnanceur", () => {
  const CRONS = [
    "/api/cron/versements",
    "/api/cron/courriels",
    "/api/cron/commandes",
  ];

  for (const chemin of CRONS) {
    test(`${chemin} rend 404 sans le secret`, async ({ request }) => {
      // 404 et non 401 : une route d'ordonnanceur n'a pas à confirmer son
      // existence à qui n'a pas le secret.
      const reponse = await request.get(chemin);
      expect(reponse.status()).toBe(404);
    });
  }
});
