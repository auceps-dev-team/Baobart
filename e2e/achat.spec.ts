import { expect, test } from "@playwright/test";

import { db, nouveauCompte, ressourceVendable } from "./fixtures/donnees";

/**
 * Le parcours qui fait vivre Baobart : arriver, s'inscrire, acheter, retirer.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QUE CE FICHIER ÉPROUVE, ET QUE RIEN D'AUTRE NE VOIT
 *
 * Les tests d'intégration savent qu'`acheter()` crédite le bon solde. Ils ne
 * savent pas si le bouton existe, si le formulaire d'inscription envoie les
 * champs que l'action attend, ni si la ressource achetée apparaît vraiment dans
 * l'espace de l'acheteur.
 *
 * Chacune de ces trois choses a déjà été cassée sans qu'aucun test ne bronche.
 */

test.describe("de l'inscription au téléchargement", () => {
  test("un visiteur s'inscrit, achète, et retrouve sa ressource", async ({
    page,
  }) => {
    const ressource = await ressourceVendable();
    const compte = nouveauCompte();

    // ── S'inscrire ───────────────────────────────────────────────────────────
    await page.goto("/inscription");

    await page.getByLabel("Prénom").fill(compte.prenom);
    await page.getByLabel("Nom", { exact: true }).fill(compte.nom);
    await page.getByLabel(/pseudo|nom d.utilisateur|username/i).fill(compte.username);
    await page.getByLabel("Email").fill(compte.email);
    await page.getByLabel("Mot de passe").fill(compte.motDePasse);

    // La case de conditions est validée côté action : la sauter ferait échouer
    // l'inscription avec un message, pas une erreur — donc il faut la cocher.
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /créer mon compte/i }).click();

    // Une inscription réussie ouvre une session et emmène au tableau de bord.
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

    // Le compte existe vraiment, et le mot de passe n'y est pas en clair.
    const cree = await db.user.findUniqueOrThrow({
      where: { email: compte.email },
      select: { passwordHash: true },
    });
    expect(cree.passwordHash).not.toBe(compte.motDePasse);
    expect(cree.passwordHash?.length ?? 0).toBeGreaterThan(20);

    // ── Acheter ──────────────────────────────────────────────────────────────
    await page.goto(`/products/${ressource.slug}`);
    await expect(page.getByText(ressource.nom).first()).toBeVisible();

    const acheter = page.getByRole("link", { name: /acheter/i });
    await expect(
      acheter,
      "le bouton d'achat doit apparaître : la simulation est ouverte, la ressource a un fichier, et l'acheteur n'en est pas le vendeur",
    ).toBeVisible();

    // ── Choisir comment payer — étape 1 sur 2 ────────────────────────────────
    //
    // Le rail doit être choisi AVANT que la commande s'ouvre : c'est lui qui
    // décide de l'invite reçue sur le téléphone.
    await acheter.click();
    await expect(page).toHaveURL(/\/acheter\//, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: /comment veux-tu payer/i }),
    ).toBeVisible();

    // Le pays commande la liste : au Ghana, ni Orange Money ni Wave.
    await page.getByRole("button", { name: "Ghana" }).click();
    await expect(page.getByText("Orange Money")).toHaveCount(0);
    await expect(page.getByText("MTN MoMo").first()).toBeVisible();

    // On revient sur un pays où Orange Money existe, et on le choisit.
    await page.getByRole("button", { name: "Côte d'Ivoire" }).click();
    await page.getByText("Orange Money").first().click();

    await page.getByRole("button", { name: /payer/i }).click();
    await expect(page).toHaveURL(/achat=ok/, { timeout: 30_000 });

    // ── Vérifier que l'argent a bougé ────────────────────────────────────────
    const ligne = await db.orderItem.findFirstOrThrow({
      where: { productId: ressource.produitId },
      select: { state: true, price: true },
    });
    expect(ligne.state).toBe("SUCCESSFUL");
    // Le prix est figé à la vente, pas relu sur le produit.
    expect(ligne.price).toBe(ressource.prix);

    // Le vendeur est crédité — c'est tout l'intérêt de la vente.
    const soldes = await db.balance.count({
      where: { userId: ressource.vendeurId },
    });
    expect(soldes).toBeGreaterThan(0);

    // ── Retrouver son achat ──────────────────────────────────────────────────
    //
    // Dans les ACHATS, pas dans les téléchargements. Les deux écrans ne disent
    // pas la même chose : l'un liste ce qu'on possède, l'autre ce qu'on a déjà
    // retiré. Le reçu d'achat pointait sur le second — l'acheteur y trouvait
    // une page vide qui semblait dire qu'il n'avait rien acheté.
    await page.goto("/dashboard/achats");

    // La commande est là, payée. On l'attend par son montant et son état :
    // l'écran affiche « Commande <référence> », pas le nom de la ressource.
    //
    // ⚠️ C'EST UNE LIMITE CONNUE, PAS UN CHOIX DE TEST. Aucun écran de l'espace
    // acheteur ne nomme la ressource qu'il vient d'acheter : les achats
    // montrent une référence de commande, et les téléchargements sont vides
    // tant que rien n'a été retiré. Le jour où une maquette le corrige, ce test
    // doit devenir une vérification par le nom.
    await expect(page.getByText(/PAYÉE/i).first()).toBeVisible();
    await expect(page.getByText(/5\s*000/).first()).toBeVisible();

    // Et rien n'est encore dans les téléchargements : rien n'a été retiré.
    // C'est la distinction que le reçu confondait.
    await page.goto("/dashboard/telechargements");
    await expect(page.getByText(ressource.nom)).toHaveCount(0);
  });

  test("on ne peut pas acheter sa propre ressource", async ({ page }) => {
    // Sinon un créateur ferait tourner ses propres ventes pour gonfler ses
    // chiffres, en ne perdant que la commission.
    const compte = nouveauCompte();

    await page.goto("/inscription");
    await page.getByLabel("Prénom").fill(compte.prenom);
    await page.getByLabel("Nom", { exact: true }).fill(compte.nom);
    await page.getByLabel(/pseudo|nom d.utilisateur|username/i).fill(compte.username);
    await page.getByLabel("Email").fill(compte.email);
    await page.getByLabel("Mot de passe").fill(compte.motDePasse);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /créer mon compte/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

    const vendeur = await db.user.findUniqueOrThrow({
      where: { email: compte.email },
      select: { id: true },
    });

    // On lui attribue une ressource publiée.
    const marque = `sienne${Date.now().toString(36)}`;
    const produit = await db.product.create({
      data: {
        sellerId: vendeur.id,
        name: `Ressource ${marque}`,
        slug: `ressource-${marque}`,
        price: 3_000,
        currency: "XOF",
        status: "PUBLISHED",
      },
      select: { id: true, slug: true },
    });
    const media = await db.mediaAsset.create({
      data: {
        ownerId: vendeur.id,
        purpose: "product",
        s3Key: `produits/${produit.id}/f.zip`,
        checksum: "e2e",
        contentType: "application/zip",
        sizeBytes: 1024,
        status: "READY",
      },
      select: { id: true },
    });
    await db.productFile.create({
      data: {
        productId: produit.id,
        mediaId: media.id,
        filename: "f.zip",
        sizeBytes: 1024,
        role: "SOURCE",
        position: 0,
      },
    });

    await page.goto(`/products/${produit.slug}`);

    // Le bouton n'apparaît pas. C'est la garde côté lecture ; l'action serveur
    // refuse aussi, mais un bouton qui promet un écran de refus est déjà un
    // défaut.
    await expect(page.getByRole("link", { name: /acheter/i })).toHaveCount(0);

    // Et l'écran de choix, atteint par l'URL, renvoie sur la fiche : arriver
    // là à la main ne doit pas contourner ce que la fiche a refusé d'afficher.
    await page.goto(`/acheter/${produit.slug}`);
    await expect(page).toHaveURL(new RegExp(`/products/${produit.slug}`));
  });
});
