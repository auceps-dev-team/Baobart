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

/**
 * Les routes d'ordonnanceur sont éprouvées dans `ordonnanceur.spec.ts`.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE BLOC EXISTAIT ICI, ET IL DONNAIT UNE FAUSSE ASSURANCE
 *
 * Il portait une liste en dur de **trois** chemins — versements, courriels,
 * commandes — écrite en août, quand il n'y en avait que trois. `abonnements`
 * est arrivé ensuite, puis `blog`, puis `juridique` : aucun n'y a jamais été
 * ajouté.
 *
 * Trois sur six, sous un titre qui dit « les routes d'ordonnanceur ». Un
 * lecteur pressé — ou un auteur qui ajoute une route — y voit une couverture
 * complète.
 *
 * `ordonnanceur.spec.ts` lit `vercel.json` au lieu de recopier les chemins :
 * il couvre les six, et couvrira la septième sans que personne y pense. C'est
 * la seule forme de cette vérification qui ne se périme pas.
 *
 * Retiré le 19 septembre 2026, le jour où l'on a découvert que `/api/cron/blog`
 * n'était planifié nulle part depuis six versions.
 */
