import { createHash, randomBytes } from "node:crypto";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { db, ressourceVendable } from "./fixtures/donnees";

/**
 * D2a — le mobile utilisable (20/11/2026, PR #69).
 *
 * Les deux défauts de la recette du 14/11 sont gardés dans
 * `e2e/qa-personas.spec.ts` (Q-03, Q-04). Ce fichier garde le reste de D2a :
 * la fiche qui montre le prix avant la discussion, le menu du tableau de bord
 * replié au doigt et déplié au bureau, et les pages du tableau de bord à 320 px.
 *
 * Ce qu'il ne prouve pas : le comportement sur un vrai téléphone (le survol
 * collé, le clavier, l'encoche). L'émulation de Chrome ne les reproduit pas.
 */

const TELEPHONE = { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true };

async function seConnecter(context: BrowserContext, userId: string, baseURL: string) {
  await context.clearCookies();
  const jeton = randomBytes(32).toString("base64url");
  await db.session.create({
    data: { userId, token: createHash("sha256").update(jeton).digest("hex"), expiresAt: new Date(Date.now() + 3_600_000) },
  });
  await context.addCookies([{ name: "baobart_session", value: jeton, url: baseURL }]);
}

/** La largeur est passée, pas lue : en émulation mobile, `innerWidth` suit la page (voir scripts/design/captures.ts). */
function debordement(page: Page, largeur: number) {
  return page.evaluate((vw) => Math.max(0, document.documentElement.scrollWidth - vw), largeur);
}

test.describe("sur un téléphone", () => {
  test.use(TELEPHONE);

  test("la fiche montre le prix avant le partage, les avis et les commentaires", async ({ page }) => {
    const r = await ressourceVendable();
    await page.goto(`/products/${r.slug}`);
    const prix = page.locator("[data-fiche-droite]");
    const discussion = page.locator("[data-fiche-apres]");
    await expect(prix).toBeVisible();
    await expect(discussion).toBeVisible();
    // Avant D2a, le prix venait en dernier : « Télécharger » à 1 737 px (recette du 14/11).
    expect((await prix.boundingBox())!.y).toBeLessThan((await discussion.boundingBox())!.y);
  });

  test("le menu du tableau de bord est replié, et s'ouvre au doigt", async ({ page, context, baseURL }) => {
    const r = await ressourceVendable();
    await seConnecter(context, r.vendeurId, baseURL!);
    await page.goto("/dashboard/produits");
    const bouton = page.getByRole("button", { name: /Menu de l.espace/ });
    const entree = page.locator("[data-sidebar]").getByRole("link", { name: /Produits/ });

    await expect(bouton).toHaveAttribute("aria-expanded", "false");
    await expect(entree).toBeHidden();
    await bouton.tap();
    await expect(bouton).toHaveAttribute("aria-expanded", "true");
    await expect(entree).toBeVisible();
  });
});

test.describe("à 320 px", () => {
  test.use({ ...TELEPHONE, viewport: { width: 320, height: 640 } });

  test("les pages du tableau de bord ne débordent pas", async ({ page, context, baseURL }) => {
    const r = await ressourceVendable();
    // Un code promo : sa ligne débordait de 93 px (mesuré le 20/11).
    await db.offerCode.create({ data: { sellerId: r.vendeurId, code: `D2A${Date.now().toString(36).toUpperCase()}`, type: "PERCENT", amount: 10 } });
    await seConnecter(context, r.vendeurId, baseURL!);
    const pages = ["/dashboard", "/dashboard/produits", "/dashboard/commandes", "/dashboard/commissions", "/dashboard/promos", "/dashboard/statistiques", "/dashboard/apercu", "/dashboard/forfait"];
    const debordes: string[] = [];
    for (const chemin of pages) {
      await page.goto(chemin);
      const d = await debordement(page, 320);
      if (d > 0) debordes.push(`${chemin} : ${d} px`);
    }
    // Avant D2a, mesuré le 20/11 sur la démonstration : 8 pages, de 16 à 208 px.
    expect(debordes).toEqual([]);
  });
});

test("au bureau, le menu du tableau de bord reste déplié, sans bouton", async ({ page, context, baseURL }) => {
  const r = await ressourceVendable();
  await seConnecter(context, r.vendeurId, baseURL!);
  await page.goto("/dashboard/produits");
  await expect(page.getByRole("button", { name: /Menu de l.espace/ })).toBeHidden();
  await expect(page.locator("[data-sidebar]").getByRole("link", { name: /Produits/ })).toBeVisible();
});
