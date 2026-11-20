import { createHash, randomBytes } from "node:crypto";

import { expect, type BrowserContext, type Page } from "@playwright/test";

import { db, unique } from "./donnees";

/**
 * Les gestes communs des tests au navigateur qui ne testent PAS la connexion :
 * une session posée en base, un membre neuf, le bandeau de cookies refermé,
 * l'achat simulé. Les mêmes que dans `qa-personas.spec.ts`, qui garde sa copie
 * (fichier partagé avec le collaborateur, on n'y touche pas pour ça).
 */

export async function seConnecter(context: BrowserContext, userId: string, baseURL: string) {
  await context.clearCookies();
  const jeton = randomBytes(32).toString("base64url");
  await db.session.create({
    data: { userId, token: createHash("sha256").update(jeton).digest("hex"), expiresAt: new Date(Date.now() + 3_600_000) },
  });
  await context.addCookies([{ name: "baobart_session", value: jeton, url: baseURL }]);
}

export async function nouveauMembre(prefixe: string): Promise<{ id: string; marque: string }> {
  const marque = unique(prefixe);
  const membre = await db.user.create({
    data: { email: `${marque}@baobart.test`, profile: { create: { username: marque, displayName: `Membre ${marque}` } } },
    select: { id: true },
  });
  return { id: membre.id, marque };
}

/** Le bandeau de cookies couvre le bas de l'écran tant qu'on n'a pas répondu. */
export async function fermerLeBandeau(page: Page) {
  const refuser = page.getByRole("dialog", { name: /cookie/i }).getByRole("button", { name: "Refuser" });
  if (await refuser.count()) await refuser.click();
}

/** L'achat simulé, tel que `achat.spec.ts` le joue. */
export async function acheter(page: Page, slug: string) {
  await page.goto(`/acheter/${slug}`);
  await fermerLeBandeau(page);
  await page.getByRole("button", { name: "Côte d'Ivoire" }).click();
  await page.getByText("Orange Money").first().click();
  await page.getByRole("button", { name: /^payer/i }).click();
  await expect(page).toHaveURL(/achat=ok/, { timeout: 30_000 });
}
