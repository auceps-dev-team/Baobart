import { expect, test } from "@playwright/test";

import { db, ressourceVendable, unique } from "./fixtures/donnees";
import { fermerLeBandeau, nouveauMembre, seConnecter } from "./fixtures/session";

/**
 * Navigation et compte — défauts mineurs de la recette du 14/11/2026
 * (`Doc/QA_PERSONAS_2026-11-14.md`, §6.2). Chacun a été joué ROUGE sur le code
 * d'avant la correction, puis vert après (mesures dans le message de commit).
 */

test.describe("navigation et compte", () => {
  test("Q-11 — Échap ferme la fenêtre d'épingle, pas la fiche ouverte dessous", async ({ page, context, baseURL }) => {
    const ressource = await ressourceVendable(1_500);
    const membre = await nouveauMembre("q11");
    await db.board.create({ data: { ownerId: membre.id, title: `Planches ${membre.marque}` } });
    await seConnecter(context, membre.id, baseURL!);

    // La fiche s'ouvre EN FENÊTRE quand on y arrive depuis la mosaïque.
    await page.goto("/explore");
    await fermerLeBandeau(page);
    await page.locator(`a[href="/products/${ressource.slug}"]`).first().click();
    const fiche = page.getByRole("dialog", { name: "Détail de la ressource" });
    await expect(fiche).toBeVisible();

    await fiche.getByRole("button", { name: /Collection/ }).click();
    // Par son nom : elle s'ouvre DANS la fiche, qui est elle aussi un dialogue.
    const choix = page.getByRole("dialog", { name: "Ranger dans une collection" });
    await expect(choix).toBeVisible();
    await expect(choix).toContainText(`Planches ${membre.marque}`);

    await page.keyboard.press("Escape");
    await expect(choix).toHaveCount(0);
    // Mesuré le 14/11 : la fiche se fermait aussi, retour à la liste.
    await expect(fiche).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/products/${ressource.slug}`));
  });

  test("Q-13 — une adresse inconnue ne déclenche aucune erreur serveur", async ({ page }) => {
    const erreurs: string[] = [];
    page.on("response", (r) => {
      if (r.status() >= 500) erreurs.push(`${r.status()} ${new URL(r.url()).pathname}`);
    });
    const reponse = await page.goto(`/une-adresse-qui-n-existe-pas-${unique("q13")}`);
    expect(reponse?.status()).toBe(404);
    // Le préchargement des liens part après le rendu, quand le navigateur est
    // libre. Pas « networkidle » : mesuré le 20/11, cette page ne l'atteint pas.
    // Quatre secondes suffisaient à voir les trois 500 de /, /explore, /cookies.
    await page.waitForTimeout(4_000);
    expect(erreurs).toEqual([]);
  });

  test("Q-16 — l'acheteur se déconnecte depuis son tableau de bord", async ({ page, context, baseURL }) => {
    const membre = await nouveauMembre("q16");
    await seConnecter(context, membre.id, baseURL!);
    await page.goto("/dashboard/apercu");
    await fermerLeBandeau(page);

    await page.locator("[data-sidebar]").getByRole("button", { name: "Se déconnecter" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/dashboard"));

    await page.goto("/dashboard/achats");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("Q-17 — sans la case cochée, aucun lien ne part", async ({ page }) => {
    const membre = await nouveauMembre("q17");
    const email = `${membre.marque}@baobart.test`;
    await page.goto("/mot-de-passe-oublie");
    await fermerLeBandeau(page);

    await page.locator("input[name=email]").fill(email);
    await page.getByRole("button", { name: "Envoyer le lien" }).click();
    await expect(page.getByText(/coche la case/i).first()).toBeVisible();
    expect(await db.emailOutbox.count({ where: { recipient: email } })).toBe(0);

    await page.locator("input[name=conditions]").check();
    await page.getByRole("button", { name: "Envoyer le lien" }).click();
    await expect(page.getByText(/un lien vient d'y partir/i).first()).toBeVisible();
  });

  test("Q-18 — renvoyé vers la connexion, on garde la page demandée", async ({ page }) => {
    await page.goto("/dashboard/achats");
    await expect(page).toHaveURL(/\/connexion\?suite=%2Fdashboard%2Fachats/);
    await expect(page.locator("input[type=hidden][name=suite]")).toHaveValue("/dashboard/achats");
  });

  test("Q-26 — le recruteur retrouve ses offres ; un candidat n'a pas le bouton", async ({ page, context, baseURL }) => {
    const recruteur = await nouveauMembre("q26r");
    const titre = `Affiche pour un festival ${recruteur.marque}`;
    await db.jobPosting.create({
      data: { recruiterId: recruteur.id, title: titre, type: "FREELANCE", mode: "REMOTE", description: "Une affiche.", state: "PUBLIE" },
    });

    await seConnecter(context, recruteur.id, baseURL!);
    await page.goto("/jobs");
    await fermerLeBandeau(page);
    await page.getByRole("link", { name: "Mes offres" }).click();
    await expect(page).toHaveURL(/\/jobs\/mes-offres/);
    const offre = page.locator("article", { hasText: titre });
    await expect(offre).toBeVisible();
    await expect(offre.getByRole("link", { name: "Aucune candidature" })).toHaveAttribute("href", /\/dashboard\/jobs\/.+\/candidatures/);

    const candidat = await nouveauMembre("q26c");
    await seConnecter(context, candidat.id, baseURL!);
    await page.goto("/jobs");
    await expect(page.getByRole("link", { name: "Mes offres" })).toHaveCount(0);
  });
});
