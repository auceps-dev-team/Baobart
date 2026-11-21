import { expect, test } from "@playwright/test";

import { db, ressourceVendable } from "./fixtures/donnees";
import { acheter, fermerLeBandeau, nouveauMembre, seConnecter } from "./fixtures/session";

/**
 * L'argent à l'écran — recette du 14/11/2026. La logique est prouvée par les
 * tests d'intégration (gainsDe, creditsAuxCreateurs, trancher, l'historique) ;
 * ici, ce que la personne LIT.
 */
test.describe("l'argent dit la même chose partout", () => {
  test("Q-31 — une vente encore retenue n'est pas annoncée « à verser »", async ({ page, context, baseURL }) => {
    const ressource = await ressourceVendable(5_000);
    const acheteur = await nouveauMembre("q31a");
    await seConnecter(context, acheteur.id, baseURL!);
    await acheter(page, ressource.slug);

    await seConnecter(context, ressource.vendeurId, baseURL!);
    await page.goto("/dashboard");
    await fermerLeBandeau(page);
    // Mesuré le 14/11 : « Solde à verser 4 425 F · part prochain versement »,
    // quand Gains disait « disponible 0 F · en attente de validation 4 425 F ».
    await expect(page.getByText(/en attente de validation/i).first()).toBeVisible();
    await expect(page.getByText("part prochain versement")).toHaveCount(0);
  });

  test("piste 1 — un achat remboursé en entier n'est plus « disponible » dans l'historique", async ({ page, context, baseURL }) => {
    const ressource = await ressourceVendable(3_000);
    const acheteur = await nouveauMembre("hist");
    await seConnecter(context, acheteur.id, baseURL!);
    await acheter(page, ressource.slug);

    // Un retrait passé, puis le remboursement intégral. Posés en base : c'est
    // l'ÉCRAN qu'on éprouve ici (la règle, `accesFerme`, a son test d'intégration).
    const ligne = await db.orderItem.findFirstOrThrow({ where: { productId: ressource.produitId }, select: { id: true, price: true } });
    const fichier = await db.productFile.findFirstOrThrow({ where: { productId: ressource.produitId }, select: { id: true } });
    await db.consumptionEvent.create({
      data: { userId: acheteur.id, productId: ressource.produitId, productFileId: fichier.id, eventType: "DOWNLOAD", platform: "AUTRE" },
    });
    await db.orderItem.update({ where: { id: ligne.id }, data: { refundedAmount: ligne.price } });

    await page.goto("/dashboard/telechargements");
    await fermerLeBandeau(page);
    await expect(page.getByText("ACCÈS CLOS").first()).toBeVisible();
    await expect(page.locator(`a[href^="/api/telechargement/${fichier.id}"]`)).toHaveCount(0);
  });
});
