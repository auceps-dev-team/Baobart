import { createHash, randomBytes } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { db, unique } from "./fixtures/donnees";

/**
 * Les avis notés, au navigateur, contre un vrai build (lot 4, 09/11/2026).
 *
 * Le parcours que les tests d'intégration ne voient pas : un acheteur note sur
 * la fiche, le créateur retrouve l'avis « À RÉPONDRE » et répond, et la réponse
 * apparaît sous l'avis. axe juge les deux écrans.
 *
 * Session posée en base, comme `badges.spec.ts` : le parcours d'inscription a
 * ses propres tests.
 */

async function seConnecter(context: BrowserContext, userId: string, baseURL: string) {
  await context.clearCookies();
  const jeton = randomBytes(32).toString("base64url");
  await db.session.create({
    data: { userId, token: createHash("sha256").update(jeton).digest("hex"), expiresAt: new Date(Date.now() + 3_600_000) },
  });
  await context.addCookies([{ name: "baobart_session", value: jeton, url: baseURL }]);
}

async function sansViolation(page: Page, zone: string) {
  const resultat = await new AxeBuilder({ page }).include(zone).analyze();
  const detail = (n: (typeof resultat.violations)[number]["nodes"][number]) => {
    const d = n.any[0]?.data as { contrastRatio?: number; fgColor?: string; bgColor?: string; fontSize?: string } | undefined;
    const texte = n.html.replace(/<[^>]+>/g, "").slice(0, 40);
    return d?.contrastRatio ? `« ${texte} » ${d.contrastRatio}:1 (${d.fgColor} sur ${d.bgColor}, ${d.fontSize})` : n.target.join(" ");
  };
  expect(resultat.violations.flatMap((v) => v.nodes.map((n) => `${v.id} : ${detail(n)}`))).toEqual([]);
}

/** Un créateur avec une ressource publiée, et un acheteur qui l'a obtenue. */
async function venteFaite() {
  const marque = unique("avis");
  const vendeur = await db.user.create({
    data: { email: `${marque}-v@baobart.test`, profile: { create: { username: `${marque}v`, displayName: `Créatrice ${marque}` } } },
    select: { id: true },
  });
  const produit = await db.product.create({
    data: { sellerId: vendeur.id, name: `Pack ${marque}`, slug: marque, price: 3_000, currency: "XOF", status: "PUBLISHED" },
    select: { id: true, slug: true },
  });
  const acheteur = await db.user.create({
    data: { email: `${marque}-a@baobart.test`, profile: { create: { username: `${marque}a`, displayName: `Mariam ${marque}` } } },
    select: { id: true },
  });
  await db.order.create({
    data: { buyerId: acheteur.id, total: 3_000, currency: "XOF", items: { create: { productId: produit.id, quantity: 1, price: 3_000, state: "SUCCESSFUL" } } },
  });
  return { vendeur, produit, acheteur };
}

test.describe("les avis notés", () => {
  test("un acheteur note la ressource sur sa fiche, et l'avis s'affiche ; axe passe", async ({ page, context, baseURL }) => {
    const { produit, acheteur } = await venteFaite();
    await seConnecter(context, acheteur.id, baseURL!);

    await page.goto(`/products/${produit.slug}`);
    const section = page.locator("[data-section-avis]");
    await expect(section.getByText("Noter cette ressource")).toBeVisible();

    await section.getByRole("radio", { name: "4 étoiles" }).check();
    await section.getByLabel("Ton commentaire (facultatif)").fill("Les fichiers sources sont impeccables.");
    await section.getByRole("button", { name: "Publier mon avis" }).click();

    await expect(section.getByRole("status")).toHaveText("Merci, ton avis est publié.");
    await expect(section.getByRole("heading", { name: "Avis (1)" })).toBeVisible();
    // Dans la carte publiée : le même texte reste aussi dans le champ, que son
    // auteur peut encore modifier.
    await expect(section.locator("article").getByText("Les fichiers sources sont impeccables.")).toBeVisible();
    await expect(section.getByRole("img", { name: "4 sur 5" }).first()).toBeVisible();

    await sansViolation(page, "[data-section-avis]");
  });

  test("le créateur retrouve l'avis à répondre, répond, et la réponse suit l'avis ; axe passe", async ({ page, context, baseURL }) => {
    const { vendeur, produit, acheteur } = await venteFaite();
    await db.productReview.create({ data: { authorId: acheteur.id, productId: produit.id, rating: 3, body: "J'aurais aimé une version SVG." } });
    await db.product.update({ where: { id: produit.id }, data: { ratingStars: [0, 0, 1, 0, 0], ratingCount: 1, ratingAvg: 3 } });
    await seConnecter(context, vendeur.id, baseURL!);

    await page.goto("/dashboard/avis?filtre=sans-reponse");
    const zone = page.locator("[data-avis-recus]");
    await expect(zone.getByText("À RÉPONDRE")).toBeVisible();
    await sansViolation(page, "[data-avis-recus]");

    // « Répondre » (la maquette) déplie ; « Publier ma réponse » envoie : deux
    // gestes, deux libellés — pour l’œil comme pour un lecteur d’écran.
    await zone.locator("summary", { hasText: "Répondre" }).click();
    await zone.getByLabel("Ta réponse").fill("Merci ! La version SVG est en ligne.");
    await zone.getByRole("button", { name: "Publier ma réponse" }).click();
    // La file se vide : l'avis répondu en sort, avec le message de son
    // formulaire. Reste la ligne d'état de la file, qui change de texte.
    await expect(zone.getByText("À RÉPONDRE")).toHaveCount(0);
    await expect(zone.getByRole("status")).toHaveText("Tu as répondu à tout.");

    await page.goto(`/products/${produit.slug}#avis`);
    await expect(page.locator("[data-section-avis]").getByText("Merci ! La version SVG est en ligne.")).toBeVisible();
  });

  test("un visiteur sans compte voit la note mais pas le formulaire", async ({ page }) => {
    const { produit, acheteur } = await venteFaite();
    await db.productReview.create({ data: { authorId: acheteur.id, productId: produit.id, rating: 5, body: "Parfait." } });
    await db.product.update({ where: { id: produit.id }, data: { ratingStars: [0, 0, 0, 0, 1], ratingCount: 1, ratingAvg: 5 } });

    await page.goto(`/products/${produit.slug}`);
    const section = page.locator("[data-section-avis]");
    await expect(section.getByText("sur 1 avis")).toBeVisible();
    await expect(section.getByRole("button", { name: "Publier mon avis" })).toHaveCount(0);
    await expect(section.getByText("Seul qui a obtenu la ressource peut la noter.")).toBeVisible();
  });
});
