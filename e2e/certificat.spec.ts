import { expect, test } from "@playwright/test";

import { ressourceVendable } from "./fixtures/donnees";
import { acheter, nouveauMembre, seConnecter } from "./fixtures/session";

/**
 * Le certificat de licence d'un achat (lot 7, A7) — par le vrai chemin :
 * achat simulé, bibliothèque, bouton « Licence ».
 *
 * Ce que l'intégration (`lib/licences/certificat.integration.test.ts`) ne voit
 * pas : la page elle-même, le refus à un autre compte par l'adresse, et la
 * mise en page d'impression (menu et en-tête cachés, certificat seul).
 */
test.describe("le certificat de licence", () => {
  test("l'acheteur l'ouvre depuis sa bibliothèque, un autre compte reçoit « introuvable »", async ({ page, context, baseURL }) => {
    const ressource = await ressourceVendable(2_500);
    const acheteur = await nouveauMembre("cert-a");
    await seConnecter(context, acheteur.id, baseURL!);
    await acheter(page, ressource.slug);

    await page.goto("/dashboard/bibliotheque");
    await page.getByRole("link", { name: "Licence" }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/bibliotheque\/certificat\//);

    const certificat = page.locator("[data-certificat]");
    await expect(certificat).toBeVisible();
    await expect(certificat).toContainText(/LC-\d{4}-[A-Z0-9]{8}/);
    await expect(certificat).toContainText("VALIDE");
    await expect(certificat).toContainText(ressource.nom);

    // À l'impression : le certificat seul, sans le menu.
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("[data-sidebar]")).toBeHidden();
    await expect(certificat).toBeVisible();
    await page.emulateMedia({ media: "screen" });

    // La même adresse, ouverte par un autre compte : rien ne dit qu'elle existe.
    const adresse = page.url();
    const autre = await nouveauMembre("cert-t");
    await seConnecter(context, autre.id, baseURL!);
    const reponse = await page.goto(adresse);
    expect(reponse?.status()).toBe(404);
    await expect(page.locator("[data-certificat]")).toHaveCount(0);
  });
});
