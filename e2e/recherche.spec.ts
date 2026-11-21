import { expect, test } from "@playwright/test";

import { db, ressourceVendable, unique } from "./fixtures/donnees";
import { fermerLeBandeau } from "./fixtures/session";

/**
 * La recherche de l'en-tête — Q-12, recette du 14/11/2026 : « Entrée ne mène
 * nulle part ; aucune mention "aucun résultat" ; "awa" ne trouve pas la
 * créatrice Awa Diallo (seuls les titres sont lus) ; la vignette de la
 * suggestion reste vide. »
 */
const champ = (page: import("@playwright/test").Page) => page.getByRole("textbox", { name: "Rechercher une ressource" }).first();

test.describe("la recherche de l'en-tête (Q-12)", () => {
  test("une suggestion porte la vignette de sa ressource", async ({ page }) => {
    const r = await ressourceVendable(1_500);
    await db.product.update({ where: { id: r.produitId }, data: { coverUrl: "/img/baobab-white.svg" } });
    await page.goto("/explore");
    await fermerLeBandeau(page);
    await champ(page).fill(r.nom);
    const vignette = page.locator("[data-vignette-suggestion]").first();
    await expect(vignette).toBeVisible();
    await expect(vignette).toHaveAttribute("style", /baobab-white\.svg/);
  });

  test("Entrée ouvre la première suggestion", async ({ page }) => {
    const r = await ressourceVendable(1_500);
    await page.goto("/explore");
    await fermerLeBandeau(page);
    await champ(page).fill(r.nom);
    await expect(page.locator("[data-vignette-suggestion]").first()).toBeVisible();
    await champ(page).press("Enter");
    await expect(page).toHaveURL(new RegExp(`/products/${r.slug}`));
  });

  test("un nom de créatrice la trouve", async ({ page }) => {
    const r = await ressourceVendable(1_500);
    const marque = unique("awa");
    const profil = await db.profile.update({
      where: { userId: r.vendeurId },
      data: { displayName: `Awa Diallo ${marque}` },
      select: { username: true },
    });
    await page.goto("/explore");
    await fermerLeBandeau(page);
    await champ(page).fill(`Diallo ${marque}`);
    const lien = page.locator(`[data-suggestion-createur] >> text=Awa Diallo ${marque}`).first();
    await expect(lien).toBeVisible();
    await lien.click();
    await expect(page).toHaveURL(new RegExp(`/createurs/${profil.username}`));
  });

  test("rien ne correspond : la recherche le dit", async ({ page }) => {
    await page.goto("/explore");
    await fermerLeBandeau(page);
    await champ(page).fill(`zzqq-${unique("rien")}`);
    await expect(page.getByText(/Aucune ressource ne correspond/).first()).toBeVisible();
  });
});
