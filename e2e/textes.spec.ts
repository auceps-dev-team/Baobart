import { expect, test } from "@playwright/test";

import { db, ressourceVendable, unique } from "./fixtures/donnees";
import { acheter, fermerLeBandeau, nouveauMembre, seConnecter } from "./fixtures/session";

/**
 * Les textes — défauts de la recette du 14/11/2026 (`Doc/QA_PERSONAS_2026-11-14.md`
 * §6.2-6.3, et les promesses de la piste 1 de la suite). Chacun joué ROUGE sur le
 * code d'avant, vert après (mesures dans le message de commit).
 */

test.describe("les textes disent ce que fait le site", () => {
  test("Q-34 — une vitrine à une ressource et un abonné l'écrit au singulier", async ({ page }) => {
    const ressource = await ressourceVendable(1_500);
    // Le compteur d'abonnés est dénormalisé sur le profil : on le pose. Ce test
    // éprouve l'accord du mot, pas le décompte des abonnements (testé ailleurs).
    const profil = await db.profile.update({
      where: { userId: ressource.vendeurId },
      data: { followerCount: 1 },
      select: { username: true },
    });
    await page.goto(`/createurs/${profil.username}`);
    await fermerLeBandeau(page);
    await expect(page.getByText("abonné", { exact: true })).toBeVisible();
    await expect(page.getByText("ressource", { exact: true })).toBeVisible();
    await expect(page.getByText("abonnés", { exact: true })).toHaveCount(0);
  });

  test("Q-35 — sous la simulation, la page de paiement ne dit pas « traité par aucun »", async ({ page, context, baseURL }) => {
    const ressource = await ressourceVendable(2_000);
    const acheteur = await nouveauMembre("q35");
    await seConnecter(context, acheteur.id, baseURL!);
    await page.goto(`/acheter/${ressource.slug}`);
    await fermerLeBandeau(page);
    await expect(page.getByText(/traité par aucun/i)).toHaveCount(0);
    await expect(page.getByText(/paiement simulé : environnement de test/i).first()).toBeVisible();
    await page.getByRole("button", { name: "Côte d'Ivoire" }).click();
    await page.getByText("Orange Money").first().click();
    await expect(page.getByText(/redirigé vers Orange Money/i)).toHaveCount(0);
    await expect(page.getByText(/paiement simulé \(Orange Money\)/i)).toBeVisible();
  });

  test("Q-36 — les états d'une vente portent leurs accents ; les entrées du menu mènent quelque part", async ({ page, context, baseURL }) => {
    const ressource = await ressourceVendable(2_500);
    const acheteur = await nouveauMembre("q36a");
    await seConnecter(context, acheteur.id, baseURL!);
    await acheter(page, ressource.slug);

    await seConnecter(context, ressource.vendeurId, baseURL!);
    await page.goto("/dashboard/ventes");
    await fermerLeBandeau(page);
    await expect(page.getByText("ENCAISSÉE").first()).toBeVisible();
    await expect(page.getByText("ENCAISSEE", { exact: true })).toHaveCount(0);
    await expect(page.locator("[data-sidebar]").getByText("Avis & commentaires")).toBeVisible();
    await expect(page.locator("[data-sidebar]").getByText("Créateur feedback")).toHaveCount(0);

    // Q-42 : la règle paie un mensuel au DERNIER cycle du mois (testée dans
    // lib/payments/payout-schedule.test.ts) ; l'aide disait « le premier ».
    await page.goto("/dashboard/versements");
    await expect(page.getByText(/au dernier jour de versement du mois/i).first()).toBeAttached();
    await expect(page.getByText(/le premier jour de versement du mois/i)).toHaveCount(0);
  });

  test("Q-36 — le menu du compte mène aux règles de publication et au support", async ({ page, context, baseURL }) => {
    const membre = await nouveauMembre("q36m");
    await seConnecter(context, membre.id, baseURL!);
    await page.goto("/explore");
    await fermerLeBandeau(page);
    // Le menu du compte s'ouvre au survol du bloc qui porte le nom du membre.
    await page.getByTitle(`Membre ${membre.marque}`).hover();
    await expect(page.locator('a[href="/regles-de-publication"]').first()).toBeAttached();
    await expect(page.locator('a[href="/support"]').first()).toBeAttached();
  });

  test("Q-20 — « trois choses » : les trois sont écrites, et ce qui manque est désigné", async ({ page, context, baseURL }) => {
    const membre = await nouveauMembre("q20");
    await seConnecter(context, membre.id, baseURL!);
    await page.goto("/services/deposer");
    await fermerLeBandeau(page);
    await expect(page.locator("[data-conditions-service] li")).toHaveCount(3);
    await expect(page.getByText(/ce qui te manque/i)).toBeVisible();
  });

  // Q-33 : la règle est dans lib/blog/liste.ts, testée unitairement. Un test au
  // navigateur supposait UN seul article publié — faux dès que d'autres tests en
  // publient (mesuré le 20/11 : 4 dans la suite complète).

  test("Q-42 et la piste 1 — les promesses suivent le code", async ({ page }) => {
    await page.goto("/inscription");
    await fermerLeBandeau(page);
    await expect(page.getByText("Toutes les ressources offertes, sans limite")).toBeVisible();
    await expect(page.getByText(/téléchargements gratuits chaque mois/i)).toHaveCount(0);
    // Aucun moyen de connexion tiers n'est branché dans cet environnement.
    await expect(page.getByText(/ou continuer avec/i)).toHaveCount(0);
    await expect(page.getByText(/bientôt, avec/i)).toBeVisible();

    await page.goto("/a-propos");
    await expect(page.getByText("Vends en Afrique de l'Ouest")).toBeVisible();
    await expect(page.getByText(/tu reçois chaque semaine/i)).toHaveCount(0);

    await page.goto("/tarifs");
    await expect(page.getByText(/Le solde part chaque semaine/i)).toHaveCount(0);
  });
});
