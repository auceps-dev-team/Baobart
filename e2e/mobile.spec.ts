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

/**
 * La hauteur de l'en-tête à 360 px, au plus (D2b). Mesuré le 20/11/2026 : 112 px
 * à 320, 360 et 390 (environ 330 avant D2b). 130 laisse la place d'une police
 * qui charge plus tard, pas celle d'une ligne de menus en plus.
 */
const HAUTEUR_ENTETE = 130;

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

/**
 * D2b, première tranche (#70) : l'en-tête et la barre d'onglets de
 * `Baobart Mobile.dc.html`, écrans 03 et 04.
 */
test.describe("D2b — sur un téléphone de 360 px", () => {
  test.use(TELEPHONE);

  test("l'en-tête tient en deux lignes : logo et cloche, puis la recherche", async ({ page }) => {
    await page.goto("/");
    const entete = page.locator("[data-entete] > .entete-barre");
    const hauteur = (await entete.boundingBox())!.height;
    // Avant D2b : environ 330 px (quatre lignes de menus). Mesuré après : voir HAUTEUR_ENTETE.
    expect(hauteur).toBeLessThanOrEqual(HAUTEUR_ENTETE);
    await expect(page.getByRole("link", { name: "Notifications" })).toBeVisible();
    // Les menus sont rangés, et s'ouvrent par « Menu ».
    const menu = page.getByRole("button", { name: "Menu", exact: true });
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#entete-menus")).toBeHidden();
    await menu.tap();
    await expect(page.locator("#entete-menus")).toBeVisible();
  });

  test("la barre d'onglets : cinq onglets d'au moins 44 px, l'onglet de la page marqué", async ({ page }) => {
    await page.goto("/");
    const barre = page.getByRole("navigation", { name: "Onglets" });
    await expect(barre).toBeVisible();
    const onglets = barre.getByRole("link");
    await expect(onglets).toHaveCount(5);
    for (const boite of await onglets.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
      expect(boite.width).toBeGreaterThanOrEqual(44);
      expect(boite.height).toBeGreaterThanOrEqual(44);
    }
    await expect(barre.getByRole("link", { name: "Accueil" })).toHaveAttribute("aria-current", "page");

    await page.goto("/explore");
    await expect(page.getByRole("navigation", { name: "Onglets" }).getByRole("link", { name: "Explorer" })).toHaveAttribute("aria-current", "page");
  });

  test("pas de barre là où la maquette n'en dessine pas : la fiche, la connexion", async ({ page }) => {
    const r = await ressourceVendable();
    await page.goto(`/products/${r.slug}`);
    await expect(page.getByRole("navigation", { name: "Onglets" })).toHaveCount(0);
    await page.goto("/connexion");
    await expect(page.getByRole("navigation", { name: "Onglets" })).toHaveCount(0);
  });
});

/**
 * Le graphique « par mois » (`components/dashboard/revenus-mois.tsx`) au téléphone.
 *
 * Sous 900 px, une règle globale de `globals.css` ramène à une colonne toute
 * grille déclarée en ligne. Le graphique en était une, dans 190 px de haut :
 * ses six mois s'empilaient et recouvraient la carte suivante (capture du
 * 21/11 sur Statistiques). Le même composant sert aux trois pages.
 *
 * Avec des montants longs, pas des zéros : une vente de 1 234 567 F par mois
 * s'écrit « 1 234,6k » : 51 px, pour une colonne de 31 à 360 px (mesuré le
 * 21/11). Et en CI, à 320 px, « sept. » fait 36 px pour 30 — ses polices sont
 * plus larges que celles de ce poste, où il tenait. D'où, sous 620 px, ni
 * montant ni mois sous les barres, mais le premier et le dernier mois dessous,
 * comme l'écran 10 de la maquette mobile.
 */
async function ventesSurSixMois(userId: string, montant: number) {
  const maintenant = new Date();
  for (let k = 0; k < 6; k++) {
    const quand = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - k, 2, 10));
    const solde = await db.balance.create({ data: { userId, date: quand, currency: "XOF", holdingCurrency: "XOF" } });
    await db.balanceTransaction.create({
      data: {
        userId, balanceId: solde.id, type: "SALE", occurredAt: quand,
        issuedCurrency: "XOF", issuedGross: montant, issuedNet: montant,
        holdingCurrency: "XOF", holdingGross: montant, holdingNet: montant,
      },
    });
  }
}

for (const largeur of [360, 320]) test.describe(`à ${largeur} px, le graphique par mois`, () => {
  test.use({ ...TELEPHONE, viewport: { width: largeur, height: 740 } });

  for (const chemin of ["/dashboard", "/dashboard/apercu", "/dashboard/statistiques"]) {
    test(`${chemin} : six mois côte à côte, dans leur cadre`, async ({ page, context, baseURL }) => {
      const r = await ressourceVendable();
      await ventesSurSixMois(r.vendeurId, 1_234_567);
      await seConnecter(context, r.vendeurId, baseURL!);
      await page.goto(chemin);
      const graphique = page.getByRole("img", { name: /des six derniers mois/ });
      await expect(graphique).toBeVisible();
      const { cadre, mois, textesCoupes } = await graphique.evaluate((el) => ({
        cadre: el.getBoundingClientRect().toJSON() as DOMRect,
        mois: [...el.children].map((c) => c.getBoundingClientRect().toJSON() as DOMRect),
        // Un montant ou un mois plus large que sa colonne déborde sur la voisine, sans rien casser d'autre.
        textesCoupes: [...el.querySelectorAll("span")]
          .filter((s) => s.scrollWidth > s.clientWidth + 1)
          .map((s) => `« ${s.textContent} » : ${s.scrollWidth} px pour ${s.clientWidth}`),
      }));
      expect(mois).toHaveLength(6);
      expect(new Set(mois.map((m) => Math.round(m.top))).size, "les six mois sur une seule rangée").toBe(1);
      for (const m of mois) {
        expect(m.bottom, `un mois finit à ${Math.round(m.bottom)} px, son cadre à ${Math.round(cadre.bottom)} px`).toBeLessThanOrEqual(cadre.bottom + 1);
        expect(m.right).toBeLessThanOrEqual(cadre.right + 1);
      }
      expect(textesCoupes, "chaque texte tient dans sa colonne").toEqual([]);

      // Le premier et le dernier mois, sous le graphique, sur toute sa largeur.
      const bornes = page.locator(".graphique-mois-bornes");
      await expect(bornes).toBeVisible();
      const { textes, deborde } = await bornes.evaluate((el) => ({
        textes: [...el.children].map((c) => c.textContent?.trim() ?? ""),
        deborde: el.scrollWidth > el.clientWidth + 1,
      }));
      expect(textes).toHaveLength(2);
      expect(textes.every((t) => t.length > 0), "deux mois nommés").toBe(true);
      expect(deborde, "les bornes tiennent dans la largeur du graphique").toBe(false);
    });
  }
});

test("au bureau, le graphique par mois garde ses montants et ses mois sur chaque barre", async ({ page, context, baseURL }) => {
  const r = await ressourceVendable();
  await ventesSurSixMois(r.vendeurId, 1_234_567);
  await seConnecter(context, r.vendeurId, baseURL!);
  await page.goto("/dashboard");
  const graphique = page.getByRole("img", { name: /des six derniers mois/ });
  // `Baobart Dashboard.dc.html` : le montant au-dessus de chaque barre. Seul le téléphone les retire.
  // `\s` : `toLocaleString("fr-FR")` sépare les milliers d'une espace fine insécable.
  const montants = graphique.getByText(/^1\s234,6k$/);
  await expect(montants).toHaveCount(6);
  for (const montant of await montants.all()) await expect(montant).toBeVisible();
  const libelles = page.locator(".graphique-mois-libelle");
  await expect(libelles).toHaveCount(6);
  for (const libelle of await libelles.all()) await expect(libelle).toBeVisible();
  await expect(page.locator(".graphique-mois-bornes")).toBeHidden();
});

test("au bureau, ni barre d'onglets, ni cloche, ni « Menu » : l'en-tête est inchangé", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Onglets" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeHidden();
  await expect(page.locator("#entete-menus")).toBeVisible();
});
