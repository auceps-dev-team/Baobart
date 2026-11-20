import { createHash, randomBytes } from "node:crypto";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { db, unique } from "./fixtures/donnees";

/**
 * Une liste paginée du tableau de bord ne descend jamais plus bas que le menu.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LA RÈGLE
 *
 * Demandée le 14/11/2026 par aucepsdev : « assure-toi que [la liste] ne dépasse
 * jamais la barre latérale », jugée sur un écran de bureau (1440 × 900). La fin
 * d'une liste paginée, c'est sa barre « ← Précédentes · page 1 sur N · Suivantes
 * → » : son bas doit rester au-dessus du bas du menu.
 *
 * Le « bas du menu » est sa hauteur NATURELLE (ses entrées, ses espacements) et
 * jamais moins que l'écran : la barre latérale s'étire avec la page et sa carte
 * de compte est poussée en bas (`marginTop: auto`). Lire la position de cette
 * carte dirait toujours « ça tient » — le piège que ce test évite.
 *
 * Chaque liste est remplie au-delà d'une page : une liste courte tient toujours,
 * et le test réussirait sans rien éprouver.
 */

test.use({ viewport: { width: 1440, height: 900 } });

async function seConnecter(context: BrowserContext, userId: string, baseURL: string) {
  const jeton = randomBytes(32).toString("base64url");
  await db.session.create({
    data: { userId, token: createHash("sha256").update(jeton).digest("hex"), expiresAt: new Date(Date.now() + 3_600_000) },
  });
  await context.addCookies([
    { name: "baobart_session", value: jeton, url: baseURL },
    { name: "bb_consentement", value: "v1.pub-non", url: baseURL },
  ]);
}

/** Un acheteur qui a acheté et aimé `n` ressources, et reçu `n` notifications. */
async function acheteurCharge(n: number) {
  const marque = unique("pag");
  const vendeur = await db.user.create({
    data: { email: `${marque}-v@baobart.test`, profile: { create: { username: `${marque}v`, displayName: `Vendeuse ${marque}` } } },
    select: { id: true },
  });
  const acheteur = await db.user.create({
    data: { email: `${marque}-a@baobart.test`, profile: { create: { username: `${marque}a`, displayName: `Acheteur ${marque}` } } },
    select: { id: true },
  });
  for (let i = 1; i <= n; i++) {
    const p = await db.product.create({
      data: { sellerId: vendeur.id, name: `Ressource ${marque} ${i}`, slug: `${marque}-${i}`, price: 1_000 * i, currency: "XOF", status: "PUBLISHED" },
      select: { id: true },
    });
    await db.order.create({
      data: { buyerId: acheteur.id, total: 1_000 * i, currency: "XOF", items: { create: { productId: p.id, quantity: 1, price: 1_000 * i, state: "SUCCESSFUL" } } },
    });
    await db.like.create({ data: { userId: acheteur.id, productId: p.id } });
  }
  await db.notification.createMany({
    data: Array.from({ length: n }, (_, i) => ({
      userId: acheteur.id,
      type: "INFO",
      cle: `${marque}-notif-${i}`,
      titre: `Notification ${marque} ${i + 1}`,
      corps: "Posée par e2e/pagination.spec.ts.",
    })),
  });
  return { id: acheteur.id, vendeur: vendeur.id };
}

/** Le bas naturel du menu, et le bas de la barre de pagination, en px depuis le haut de la page. */
async function mesurer(page: Page) {
  return page.evaluate(() => {
    const menu = document.querySelector<HTMLElement>("[data-sidebar]")!;
    const s = getComputedStyle(menu);
    const enfants = [...menu.children] as HTMLElement[];
    const naturelle =
      enfants.reduce((h, e) => h + e.offsetHeight, 0) +
      (Number.parseFloat(s.rowGap) || 0) * Math.max(0, enfants.length - 1) +
      Number.parseFloat(s.paddingTop) +
      Number.parseFloat(s.paddingBottom);
    const basMenu = Math.max(innerHeight, menu.getBoundingClientRect().top + scrollY + naturelle);
    const barre = document.querySelector<HTMLElement>('nav[aria-label="Pages"]');
    return {
      basMenu,
      basListe: barre ? barre.getBoundingClientRect().bottom + scrollY : null,
      hauteurPage: document.documentElement.scrollHeight,
    };
  });
}

const LISTES = [
  { chemin: "/dashboard/achats" },
  { chemin: "/dashboard/bibliotheque" },
  { chemin: "/dashboard/suivis" },
  { chemin: "/dashboard/notifications" },
] as const;

test.describe("les listes paginées tiennent sous le menu", () => {
  for (const { chemin } of LISTES) {
    test(`${chemin} : la barre de pagination finit au-dessus du bas du menu`, async ({ page, context, baseURL }) => {
      const acheteur = await acheteurCharge(14);
      await seConnecter(context, acheteur.id, baseURL!);

      await page.goto(chemin);
      const barre = page.getByRole("navigation", { name: "Pages" });
      await expect(barre).toBeVisible();
      await expect(barre).toContainText("page 1 sur");

      const { basMenu, basListe, hauteurPage } = await mesurer(page);
      expect(basListe, "la barre de pagination est rendue").not.toBeNull();
      expect(basListe!, `bas de la liste ${Math.round(basListe!)} px, bas du menu ${Math.round(basMenu)} px`).toBeLessThanOrEqual(basMenu);
      // Et la page entière, marges comprises (choix du 14/11 : « la page s'arrête avec le menu »).
      // Sur ces quatre écrans, rien ne suit la liste que la marge de son cadre.
      expect(hauteurPage, `page ${hauteurPage} px, bas du menu ${Math.round(basMenu)} px`).toBeLessThanOrEqual(Math.ceil(basMenu));
    });
  }

  test("la page vit dans l'adresse ; une page hors bornes est ramenée sur la dernière", async ({ page, context, baseURL }) => {
    const acheteur = await acheteurCharge(14);
    await seConnecter(context, acheteur.id, baseURL!);

    await page.goto("/dashboard/notifications");
    const premiere = await page.getByText(/^Notification /).first().textContent();
    await page.getByRole("link", { name: "Suivantes →" }).click();
    await expect(page).toHaveURL(/\/dashboard\/notifications\?page=2$/);
    await expect(page.getByRole("navigation", { name: "Pages" })).toContainText("page 2 sur");
    expect(await page.getByText(/^Notification /).first().textContent()).not.toBe(premiere);

    await page.goto("/dashboard/notifications?page=99");
    const barre = page.getByRole("navigation", { name: "Pages" });
    const texte = (await barre.textContent()) ?? "";
    const [, courante, total] = texte.match(/page (\d+) sur (\d+)/) ?? [];
    expect(courante).toBe(total);
  });

  test("Ventes : la légende repliée s'ouvre d'un geste, et la liste tient sous le menu", async ({ page, context, baseURL }) => {
    // Le vendeur de `acheteurCharge` a vendu ses quatorze ressources : quatorze ventes.
    const { vendeur } = await acheteurCharge(14);
    await seConnecter(context, vendeur, baseURL!);

    await page.goto("/dashboard/ventes");
    const legende = page.locator('details[data-legende="repliee"]');
    await expect(legende).toBeVisible();
    await expect(legende).not.toHaveAttribute("open"); // fermée au chargement : c'est ce qui fait monter la liste
    await legende.locator("summary").click();
    await expect(legende).toHaveAttribute("open", "");

    await page.reload(); // de nouveau fermée, pour mesurer la page telle qu'elle s'ouvre
    await expect(page.getByRole("navigation", { name: "Pages" })).toContainText("page 1 sur");
    const { basMenu, basListe } = await mesurer(page);
    // La liste seulement : la carte « Ce qu'un remboursement te coûte » la suit, ce n'est pas la liste.
    expect(basListe!, `bas de la liste ${Math.round(basListe!)} px, bas du menu ${Math.round(basMenu)} px`).toBeLessThanOrEqual(basMenu);
  });
});
