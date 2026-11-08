import { createHash, randomBytes } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext } from "@playwright/test";

import { db, unique } from "./fixtures/donnees";

/**
 * Les badges, vus au navigateur, contre un vrai build (lot 2, 08/11/2026).
 *
 * Ce parcours remplace les scripts de vérification jetables du lot 1 : ce qui
 * a été vérifié une fois à la main l'est désormais à chaque passage de la CI.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'ACCESSIBILITÉ, MESURÉE PAR AXE
 *
 * axe-core juge le contraste, les noms accessibles et les rôles — dont la
 * jauge de progression. L'analyse se limite à ce que ce lot a construit
 * (`[data-badges-page]`, `[data-badges]`, la carte de la vignette) : la barre
 * latérale et l'en-tête ont leur propre histoire, et un défaut ancien ailleurs
 * ne doit pas masquer, ni excuser, un défaut d'ici.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE SESSION POSÉE EN BASE, PAS UN MOT DE PASSE
 *
 * Le parcours d'inscription a ses propres tests (`achat.spec.ts`). Ici, une
 * session est écrite en base comme `lib/auth/session.ts` la lit : un jeton
 * aléatoire, son empreinte SHA-256 en base, le cookie `baobart_session`.
 */

async function seConnecter(context: BrowserContext, userId: string, baseURL: string) {
  const jeton = randomBytes(32).toString("base64url");
  await db.session.create({
    data: { userId, token: createHash("sha256").update(jeton).digest("hex"), expiresAt: new Date(Date.now() + 3_600_000) },
  });
  await context.addCookies([{ name: "baobart_session", value: jeton, url: baseURL }]);
}

/** Un créateur vérifié, Créateur du mois, avec une ressource publiée et deux acheteurs. */
async function createurDistingue() {
  const marque = unique("badge");
  const createur = await db.user.create({
    data: {
      email: `${marque}@baobart.test`,
      kycStatus: "VERIFIED",
      profile: { create: { username: marque, displayName: `Awa ${marque}`, isVerified: true } },
    },
    select: { id: true },
  });
  const nom = `Pagne ${marque}`;
  const produit = await db.product.create({
    data: { sellerId: createur.id, name: nom, slug: marque, price: 2_000, currency: "XOF", status: "PUBLISHED" },
    select: { id: true },
  });
  for (const i of [1, 2]) {
    const acheteur = await db.user.create({ data: { email: `${marque}-a${i}@baobart.test` }, select: { id: true } });
    await db.order.create({
      data: { buyerId: acheteur.id, total: 2_000, currency: "XOF", items: { create: { productId: produit.id, quantity: 1, price: 2_000, state: "SUCCESSFUL" } } },
    });
  }
  const poser = async (code: "VERIFIED_CREATOR" | "TOP_CREATOR", validUntil: Date | null) => {
    const badge = await db.badge.upsert({ where: { code }, update: {}, create: { code, name: code, description: "" }, select: { id: true } });
    await db.userBadge.create({ data: { userId: createur.id, badgeId: badge.id, validUntil } });
  };
  await poser("VERIFIED_CREATOR", null);
  await poser("TOP_CREATOR", new Date(Date.now() + 20 * 86_400_000));
  return { id: createur.id, username: marque, nom, affiche: `Awa ${marque}` };
}

async function sansViolation(page: import("@playwright/test").Page, zone: string) {
  const resultat = await new AxeBuilder({ page }).include(zone).analyze();
  // Le détail dans le message : « 1 violation » sans nom ne se corrige pas.
  // Pour le contraste, le rapport mesuré et les deux couleurs : on corrige
  // sur la mesure, pas sur une impression.
  const detail = (n: (typeof resultat.violations)[number]["nodes"][number]) => {
    const d = n.any[0]?.data as { contrastRatio?: number; fgColor?: string; bgColor?: string; fontSize?: string } | undefined;
    const texte = n.html.replace(/<[^>]+>/g, "").slice(0, 40);
    return d?.contrastRatio ? `« ${texte} » ${d.contrastRatio}:1 (${d.fgColor} sur ${d.bgColor}, ${d.fontSize})` : n.target.join(" ");
  };
  expect(resultat.violations.flatMap((v) => v.nodes.map((n) => `${v.id} : ${detail(n)}`))).toEqual([]);
}

test.describe("les badges", () => {
  test("« Mes badges » montre les deux familles, la distance, et passe axe", async ({ page, context, baseURL }) => {
    const c = await createurDistingue();
    await seConnecter(context, c.id, baseURL!);

    await page.goto("/dashboard/badges");
    await expect(page.getByRole("heading", { name: "Garanti par Baobart" })).toBeVisible();
    await expect(page.locator("[data-badges-page]").getByText("Créateur vérifié", { exact: true }).first()).toBeVisible();
    await expect(page.locator("[data-badges-page]").getByText(/jusqu'au/).first()).toBeVisible();
    // Deux acheteurs : « Dix ventes » est le plus proche, à 20 %.
    await expect(page.getByRole("progressbar", { name: /Dix ventes : 20 %/ })).toBeVisible();

    await sansViolation(page, "[data-badges-page]");
  });

  test("la vitrine montre les deux rangées séparées, et passe axe", async ({ page }) => {
    const c = await createurDistingue();

    await page.goto(`/createurs/${c.username}`);
    const rangees = page.locator("[data-badges]");
    await expect(rangees.getByText("Garanti par Baobart")).toBeVisible();
    await expect(rangees.getByText("Constaté par l'activité")).toBeVisible();
    await expect(rangees.getByRole("img", { name: /^Créateur du mois, jusqu'au/ })).toBeVisible();

    await sansViolation(page, "[data-badges]");
  });

  test("la vignette porte un seul écusson, collé au nom", async ({ page }) => {
    const c = await createurDistingue();

    await page.goto("/explore");
    // La ligne « par ✓ Awa … » : le plus petit bloc qui porte le nom affiché.
    const ligne = page.locator("div", { hasText: c.affiche }).last();
    await expect(ligne).toBeVisible();
    await expect(ligne.getByRole("img", { name: "Créateur vérifié" })).toHaveCount(1);
    await sansViolation(page, `[data-ecusson-de="${c.username}"]`);
  });
});
