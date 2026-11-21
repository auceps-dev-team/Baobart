import { expect, test } from "@playwright/test";

import { db, ressourceVendable, unique } from "./fixtures/donnees";
import { fermerLeBandeau, nouveauMembre, seConnecter } from "./fixtures/session";

/**
 * Se repérer — Q-15 et Q-29, recette du 14/11/2026 ; le menu du compte au
 * clavier, relevé le 20/11. Le contraste (Q-30) est éprouvé par axe dans
 * e2e/contraste.spec.ts.
 */
test.describe("se repérer dans la page", () => {
  test("Q-15 — l'heure d'un événement dit son fuseau", async ({ page }) => {
    const organisateur = await nouveauMembre("q15");
    const debut = new Date(Date.UTC(2027, 0, 12, 9, 0));
    const e = await db.event.create({
      data: {
        organizerId: organisateur.id,
        title: `Atelier ${unique("q15")}`,
        kind: "WORKSHOP",
        description: "Un atelier.",
        startsAt: debut,
        endsAt: new Date(debut.getTime() + 2 * 3_600_000),
        state: "PUBLIE",
      },
      select: { id: true },
    });
    await page.goto(`/evenements/${e.id}`);
    await fermerLeBandeau(page);
    await expect(page.getByText(/heure d'Abidjan \(GMT\)/).first()).toBeVisible();
  });

  test("Q-29 — Explorer a un repère « contenu principal » et un titre de niveau 1 ; la fiche aussi", async ({ page }) => {
    const ressource = await ressourceVendable(1_500);
    await page.goto("/explore");
    await fermerLeBandeau(page);
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

    await page.goto(`/products/${ressource.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: ressource.nom })).toBeVisible();
  });

  test("Q-29 — la fiche ouverte en fenêtre donne son titre à l'onglet", async ({ page }) => {
    const ressource = await ressourceVendable(1_500);
    await page.goto("/explore");
    await fermerLeBandeau(page);
    await page.locator(`a[href="/products/${ressource.slug}"]`).first().click();
    await expect(page.getByRole("dialog", { name: "Détail de la ressource" })).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(ressource.nom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  test("Q-29 — une communauté publique donne son nom à l'onglet", async ({ page }) => {
    const auteur = await nouveauMembre("q29c");
    const marque = unique("q29");
    const c = await db.community.create({
      data: { creatorId: auteur.id, name: `Studio ${marque}`, slug: `studio-${marque}`, memberCount: 1, members: { create: [{ userId: auteur.id, role: "ADMIN" }] } },
      select: { slug: true },
    });
    await page.goto(`/communautes/${c.slug}`);
    await expect(page).toHaveTitle(new RegExp(`Studio ${marque}`));
  });

  test("le menu du compte s'ouvre au clavier, et ses liens s'atteignent", async ({ page, context, baseURL }) => {
    const membre = await nouveauMembre("clavier");
    await seConnecter(context, membre.id, baseURL!);
    await page.goto("/explore");
    await fermerLeBandeau(page);
    await page.getByRole("button", { name: /Mon compte/ }).focus();
    await expect(page.locator('a[href="/support"]').first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('a[href="/support"]')).toHaveCount(0);
  });
});
