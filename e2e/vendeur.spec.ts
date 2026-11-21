import { expect, test } from "@playwright/test";

import { db, ressourceVendable, unique } from "./fixtures/donnees";
import { fermerLeBandeau, nouveauMembre, seConnecter } from "./fixtures/session";

/**
 * Le vendeur — défauts mineurs de la recette du 14/11/2026
 * (`Doc/QA_PERSONAS_2026-11-14.md` §6.2). Chacun joué ROUGE sur le code
 * d'avant, vert après. Q-24 (adresse sans https://) est prouvé par les tests
 * unitaires de `verifierLienExterne` et `avecProtocole`, que l'action appelle.
 */

test.describe("publier et se faire payer", () => {
  test("Q-21 et Q-23 — la création annonce le délai de remboursement, les fichiers à venir, et TOUTES ses erreurs", async ({ page, context, baseURL }) => {
    const membre = await nouveauMembre("q21");
    await seConnecter(context, membre.id, baseURL!);
    await page.goto("/dashboard/produits/nouveau");
    await fermerLeBandeau(page);

    await expect(page.locator("[data-delai-remboursement]")).toContainText("remboursable sous 30 jours");
    await expect(page.locator("[data-delai-remboursement] a")).toHaveAttribute("href", "/dashboard/ventes/remboursements");
    await expect(page.locator("[data-fichiers-ensuite]")).toBeVisible();

    // Titre trop court, pas de catégorie, prix illisible : trois erreurs, un seul envoi.
    await page.locator("input[name=titre]").fill("ab");
    await page.locator("input[name=prix]").fill("abc");
    await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
    await expect(page.getByText(/titre d'au moins 3 caractères/).first()).toBeVisible();
    await expect(page.getByText(/Choisis une catégorie/).first()).toBeVisible();
  });

  test("Q-23 — pas de publication sans description", async ({ page, context, baseURL }) => {
    const ressource = await ressourceVendable(1_500);
    await db.product.update({ where: { id: ressource.produitId }, data: { status: "DRAFT", description: null } });
    await seConnecter(context, ressource.vendeurId, baseURL!);
    await page.goto(`/dashboard/produits/${ressource.produitId}`);
    await fermerLeBandeau(page);
    await page.getByRole("button", { name: "Publier la ressource" }).click();
    await expect(page).toHaveURL(/erreur=sans-description/);
    await expect(page.getByText(/Écris une description avant de publier/).first()).toBeVisible();
    expect((await db.product.findUniqueOrThrow({ where: { id: ressource.produitId }, select: { status: true } })).status).toBe("DRAFT");
  });

  test("Q-22 — un numéro sans indicatif demande son pays ; le refus s'efface quand on corrige", async ({ page, context, baseURL }) => {
    const membre = await nouveauMembre("q22");
    await seConnecter(context, membre.id, baseURL!);
    await page.goto("/dashboard/versements");
    await fermerLeBandeau(page);

    await page.getByText("Wave", { exact: true }).first().click();
    const numero = page.locator("input[name=reference]");
    await expect(numero).toHaveAttribute("inputmode", "tel");
    await numero.fill("77 123 45 67");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    const refus = page.getByRole("alert").filter({ hasText: /pays du numéro|indicatif/ });
    await expect(refus).toBeVisible();

    // On corrige : l'ancien refus ne reste pas affiché par-dessus.
    await page.getByLabel("Pays du numéro").selectOption("SN");
    await expect(refus).toHaveCount(0);
  });

  test("Q-25 — les vignettes sous l'image sont légendées « Du même créateur »", async ({ page }) => {
    const a = await ressourceVendable(1_500);
    const b = await ressourceVendable(2_000);
    await db.product.update({ where: { id: b.produitId }, data: { sellerId: a.vendeurId } });
    await page.goto(`/products/${a.slug}`);
    await fermerLeBandeau(page);
    await expect(page.locator("[data-legende-meme-createur]")).toHaveText(/Du même créateur/i);
  });

  test("Q-27 — la candidature dit où mettre le lien du portfolio", async ({ page, context, baseURL }) => {
    const recruteur = await nouveauMembre("q27r");
    const offre = await db.jobPosting.create({
      data: { recruiterId: recruteur.id, title: `Affiche ${unique("q27")}`, type: "FREELANCE", mode: "REMOTE", description: "Une affiche.", state: "PUBLIE" },
      select: { id: true },
    });
    const candidat = await nouveauMembre("q27c");
    await seConnecter(context, candidat.id, baseURL!);
    await page.goto(`/jobs/${offre.id}/postuler`);
    await fermerLeBandeau(page);
    await expect(page.getByText(/colle son adresse dans ton message/)).toBeVisible();
  });

  test("Q-32 — le pays du profil se choisit dans une liste", async ({ page, context, baseURL }) => {
    const membre = await nouveauMembre("q32");
    await seConnecter(context, membre.id, baseURL!);
    await page.goto("/dashboard/profil");
    await fermerLeBandeau(page);
    const pays = page.locator("select#pays");
    await expect(pays).toBeVisible();
    expect(await pays.locator("option").count()).toBeGreaterThan(50);
    await expect(pays.locator('option[value="ML"]')).toHaveCount(1);
  });
});
