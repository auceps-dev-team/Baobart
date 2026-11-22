import { expect, test } from "@playwright/test";

import { db, unique } from "./fixtures/donnees";
import { fermerLeBandeau, seConnecter } from "./fixtures/session";

/**
 * « Ventes » — des filtres qui filtrent (décidé le 21/11/2026).
 *
 * Mesuré ce jour-là : le champ « Rechercher une vente ou un acheteur… » n'avait
 * ni nom ni formulaire — Entrée ne faisait rien —, et une vente par page
 * (#60) rendait inutile tout filtre qui ne regarde que la page affichée. La
 * recherche passe désormais par l'adresse (`?q=`), comme sur « Statuts », et
 * chaque lien (états, pages) la garde.
 */

async function vendeurAvecVentes(marque: string) {
  const vendeur = await db.user.create({
    data: {
      email: `vendeur-${marque}@baobart.test`,
      profile: { create: { username: `v-${marque}`, displayName: `Vendeur ${marque}` } },
    },
    select: { id: true },
  });

  async function vendre(nomProduit: string, nomAcheteur: string) {
    const s = unique("vf");
    const p = await db.product.create({
      data: { sellerId: vendeur.id, slug: `vf-${s}`, name: nomProduit, price: 5_000, currency: "XOF", status: "PUBLISHED" },
      select: { id: true },
    });
    const a = await db.user.create({
      data: { email: `acheteur-${s}@baobart.test`, profile: { create: { username: `a-${s}`, displayName: nomAcheteur } } },
      select: { id: true },
    });
    await db.order.create({
      data: {
        buyerId: a.id,
        currency: "XOF",
        total: 5_000,
        status: "COMPLETED",
        items: { create: { productId: p.id, price: 5_000, quantity: 1, state: "SUCCESSFUL" } },
      },
    });
  }

  await vendre(`Pack Kente ${marque}`, "Awa Diallo");
  await vendre(`Pack Kente bis ${marque}`, "Awa Diallo");
  await vendre(`Police Adinkra ${marque}`, "Serge Koné");
  return vendeur.id;
}

test.describe("Ventes — la recherche et les filtres", () => {
  test("Entrée cherche, l'état et la page gardent la recherche, rien ne se trouve quand rien ne correspond", async ({ page, context, baseURL }) => {
    const marque = unique("vf");
    const vendeur = await vendeurAvecVentes(marque);
    await seConnecter(context, vendeur, baseURL!);
    await page.goto("/dashboard/ventes");
    await fermerLeBandeau(page);

    // Trois ventes, une par page.
    await expect(page.getByText(/3 ventes sur 3/)).toBeVisible();

    const champ = page.getByRole("searchbox", { name: "Rechercher une vente ou un acheteur…" });
    await champ.fill("kente");
    await champ.press("Enter");
    await expect(page).toHaveURL(/[?&]q=kente/);
    await expect(page.getByText(/2 ventes pour « kente » sur 2/)).toBeVisible();
    await expect(page.locator("[data-ligne]")).toHaveCount(1);
    await expect(page.locator("[data-ligne]")).toContainText("Pack Kente");

    // La page suivante garde la recherche.
    await page.getByRole("link", { name: "Suivantes →" }).click();
    await expect(page).toHaveURL(/q=kente/);
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator("[data-ligne]")).toContainText("Pack Kente");

    // Un état choisi garde la recherche : « ENCAISSÉE » parmi les ventes trouvées.
    await page.getByRole("link", { name: "ENCAISSÉE", exact: true }).click();
    await expect(page).toHaveURL(/etat=ENCAISSEE/);
    await expect(page).toHaveURL(/q=kente/);
    await expect(page.getByText(/2 ventes pour « kente » sur 2/)).toBeVisible();

    // Par l'acheteur, et sans tenir compte de la casse.
    await page.goto("/dashboard/ventes?q=SERGE");
    await expect(page.getByText(/1 vente pour « SERGE » sur 1/)).toBeVisible();
    await expect(page.locator("[data-ligne]")).toContainText("Police Adinkra");

    await page.goto("/dashboard/ventes?q=introuvable");
    await expect(page.getByText("Rien à afficher pour ce filtre.")).toBeVisible();
  });
});
