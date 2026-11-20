import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { ressourceVendable } from "./fixtures/donnees";
import { fermerLeBandeau, nouveauMembre, seConnecter } from "./fixtures/session";

/**
 * La page traduite par le navigateur (Q-43, Q-44 — recette du 14/11/2026,
 * piste 5, `Doc/QA_PERSONAS_2026-11-14-suite.md`).
 *
 * La traduction de Chrome REMPLACE chaque nœud de texte par des balises
 * <font>. Quand React veut ensuite retirer ou déplacer un nœud de texte qu'il
 * croit tenir, ce nœud n'est plus dans la page : « Failed to execute
 * 'removeChild' on 'Node' », et l'écran tombe. Le traducteur simulé de la
 * recette (`outils/traducteur.js`) reproduit ce remplacement sans rien
 * envoyer hors du poste.
 */
const TRADUCTEUR = path.resolve("Doc/QA_PERSONAS_2026-11-14/outils/traducteur.js");

async function traduire(page: Page) {
  await page.addScriptTag({ path: TRADUCTEUR });
  await expect.poll(() => page.evaluate(() => (window as { __traducteur?: { premiers: number } }).__traducteur?.premiers ?? 0)).toBeGreaterThan(0);
}

function surveillerLesErreurs(page: Page): string[] {
  const erreurs: string[] = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  return erreurs;
}

const ECRAN_CASSE = /quelque chose a cass|application error/i;

test.describe("la page traduite par le navigateur", () => {
  test("Q-44 — un visiteur traduit la fiche et touche « J'aime » : la page tient", async ({ page }) => {
    const ressource = await ressourceVendable(1_500);
    const erreurs = surveillerLesErreurs(page);
    await page.goto(`/products/${ressource.slug}`);
    await fermerLeBandeau(page);
    await traduire(page);

    await page.getByRole("button", { name: "J'aime" }).click();
    // Le serveur refuse (pas connecté) : le bouton revient en arrière et dit pourquoi.
    await expect(page.getByRole("alert").first()).toBeVisible();

    await expect(page.getByText(ECRAN_CASSE)).toHaveCount(0);
    expect(erreurs).toEqual([]);
  });

  test("Q-44 — un membre traduit la fiche, aime, n'aime plus, suit, ne suit plus : la page tient", async ({ page, context, baseURL }) => {
    const ressource = await ressourceVendable(1_500);
    const membre = await nouveauMembre("trad");
    await seConnecter(context, membre.id, baseURL!);
    const erreurs = surveillerLesErreurs(page);
    await page.goto(`/products/${ressource.slug}`);
    await fermerLeBandeau(page);
    await traduire(page);

    const jaime = page.getByRole("button", { name: /j'aime/i }).first();
    await jaime.click();
    await expect(jaime).toHaveAttribute("aria-pressed", "true");
    await jaime.click();
    await expect(jaime).toHaveAttribute("aria-pressed", "false");

    const suivre = page.locator("button.sticker-press[aria-pressed]").filter({ has: page.locator(".bascule") }).first();
    await suivre.click();
    await expect(suivre).toHaveAttribute("aria-pressed", "true");
    await suivre.click();
    await expect(suivre).toHaveAttribute("aria-pressed", "false");

    await expect(page.getByText(ECRAN_CASSE)).toHaveCount(0);
    expect(erreurs).toEqual([]);
  });

  test("Q-43 — la mosaïque traduite : le compteur suit le filtre", async ({ page }) => {
    await ressourceVendable(1_500); // au moins une ressource : le compteur ne part pas de 0
    // La réponse du filtre est fixée : c'est l'affichage qu'on éprouve, pas l'API.
    await page.route("**/api/feed?filtre=Audio*", (route) => route.fulfill({ json: { items: [], nextCursor: null } }));
    const erreurs = surveillerLesErreurs(page);
    await page.goto("/explore");
    await fermerLeBandeau(page);
    const compteur = page.locator("[data-compteur-mosaique]");
    await expect(compteur).not.toContainText(/^0 /);
    await traduire(page);

    await page.getByRole("button", { name: /^⟦?Audio⟧?$/ }).click(); // « ⟦Audio⟧ » une fois traduit
    await expect(compteur).toContainText("0 ressource affichée");

    await expect(page.getByText(ECRAN_CASSE)).toHaveCount(0);
    expect(erreurs).toEqual([]);
  });
});
