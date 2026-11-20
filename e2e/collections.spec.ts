import { createHash, randomBytes } from "node:crypto";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { db, ressourceVendable, unique } from "./fixtures/donnees";

/**
 * Ranger une ressource dans une collection, depuis sa fiche.
 *
 * Trouvé le 20/11/2026 par la règle `react-hooks/immutability` d'ESLint 16
 * (#47) : la touche Échap gardait la PREMIÈRE version de `fermer`, celle du
 * premier rendu, quand la liste des collections n'était pas encore chargée.
 * Fermer par Échap annonçait donc toujours « rangée nulle part » — le bouton
 * repassait à « Collection » alors que la ressource venait d'être rangée, et
 * le restait jusqu'au rechargement. Le clic sur le fond, lui, était juste :
 * c'est le témoin ci-dessous.
 */

// Les mêmes que dans `qa-personas.spec.ts` : une session posée en base, sans
// passer par l'écran de connexion — ce n'est pas lui qu'on teste ici.
async function seConnecter(context: BrowserContext, userId: string, baseURL: string) {
  await context.clearCookies();
  const jeton = randomBytes(32).toString("base64url");
  await db.session.create({
    data: { userId, token: createHash("sha256").update(jeton).digest("hex"), expiresAt: new Date(Date.now() + 3_600_000) },
  });
  await context.addCookies([{ name: "baobart_session", value: jeton, url: baseURL }]);
}

async function fermerLeBandeau(page: Page) {
  const refuser = page.getByRole("dialog", { name: /cookie/i }).getByRole("button", { name: "Refuser" });
  if (await refuser.count()) await refuser.click();
}

/** Un membre, une collection vide à lui, une ressource publiée ; la fiche ouverte, la fenêtre d'épingle aussi. */
async function ouvrirLeChoix(page: Page, context: BrowserContext, baseURL: string, prefixe: string) {
  const marque = unique(prefixe);
  const membre = await db.user.create({
    data: { email: `${marque}@baobart.test`, profile: { create: { username: marque, displayName: `Membre ${marque}` } } },
    select: { id: true },
  });
  const titre = `Planches ${marque}`;
  await db.board.create({ data: { ownerId: membre.id, title: titre } });
  const ressource = await ressourceVendable(1_500);

  await seConnecter(context, membre.id, baseURL);
  await page.goto(`/products/${ressource.slug}`);
  await fermerLeBandeau(page);

  const bouton = page.getByRole("button", { name: /Collection/ });
  await expect(bouton).toHaveAttribute("aria-pressed", "false");
  await bouton.click();

  const choix = page.getByRole("dialog").filter({ has: page.getByText(titre) });
  const collection = choix.getByRole("button", { name: new RegExp(titre) });
  await collection.click();
  // La ressource est rangée côté serveur avant qu'on ferme.
  await expect(collection).toHaveAttribute("aria-pressed", "true");
  return { choix };
}

test.describe("ranger dans une collection depuis la fiche", () => {
  test("fermer par Échap garde « Rangée » sur le bouton", async ({ page, context, baseURL }) => {
    await ouvrirLeChoix(page, context, baseURL!, "epingle-echap");

    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog").filter({ hasText: "Ranger" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Rangée/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("témoin : fermer par un clic sur le fond garde « Rangée »", async ({ page, context, baseURL }) => {
    const { choix } = await ouvrirLeChoix(page, context, baseURL!, "epingle-fond");

    // Le fond est le dialogue lui-même ; la carte arrête la propagation.
    await choix.click({ position: { x: 5, y: 5 } });

    await expect(page.getByRole("button", { name: /Rangée/ })).toHaveAttribute("aria-pressed", "true");
  });
});
