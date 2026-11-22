import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { db, unique } from "./fixtures/donnees";
import { seConnecter } from "./fixtures/session";

/**
 * « Abonnés » (lot 5a, `/dashboard/abonnes`) sur la vraie page.
 *
 * Ce que les tests d'intégration ne voient pas : ce qui S'AFFICHE. Qu'une
 * ville remplie sans vitrine ne sorte pas à l'écran, que « Message » n'existe
 * que là où il mène quelque part — et qu'il ouvre bien la fenêtre de contact,
 * sans second clic.
 */

test.use({ viewport: { width: 1440, height: 900 } });

async function membre(marque: string, nom: string, profil: { ville?: string; specialite?: string; messages?: boolean } = {}) {
  const u = await db.user.create({
    data: {
      email: `${marque}-${nom.toLowerCase()}@baobart.test`,
      profile: {
        create: {
          username: `${marque}-${nom.toLowerCase()}`,
          displayName: `${nom} ${marque}`,
          city: profil.ville ?? null,
          speciality: profil.specialite ?? null,
          acceptsMessages: profil.messages ?? true,
        },
      },
    },
    select: { id: true },
  });
  return u.id;
}

async function publier(marque: string, vendeurId: string) {
  await db.product.create({
    data: { sellerId: vendeurId, name: `Pack ${marque}`, slug: `${marque}-${vendeurId.slice(-6)}`, price: 2_000, currency: "XOF", status: "PUBLISHED" },
  });
}

test.describe("Abonnés — la liste de ceux qui suivent le créateur", () => {
  test("montre le nom de chacun, et de sa vitrine seulement ce qu'elle montre déjà ; « Message » ouvre le contact", async ({ page, context, baseURL }) => {
    const m = unique("abo");
    const createur = await membre(m, "Createur");
    await publier(`${m}c`, createur);

    const ouverte = await membre(m, "Ouverte", { ville: "Dakar", specialite: "Illustration" });
    await publier(`${m}o`, ouverte);
    const fermee = await membre(m, "Fermee", { ville: "Accra", specialite: "Motion", messages: false });
    await publier(`${m}f`, fermee);
    // Une acheteuse qui a rempli sa ville sans avoir de vitrine : la ville reste chez elle.
    const acheteuse = await membre(m, "Acheteuse", { ville: "Ouagadougou", specialite: "Lecture" });
    for (const s of [ouverte, fermee, acheteuse]) await db.follow.create({ data: { followerId: s, followingId: createur } });

    await seConnecter(context, createur, baseURL!);
    await page.goto("/dashboard/abonnes");

    await expect(page.getByRole("heading", { level: 1, name: "Abonnés" })).toBeVisible();
    await expect(page.getByText("3 personnes suivent ton travail.")).toBeVisible();
    const liste = page.getByRole("list", { name: "Tes abonnés" });
    await expect(liste.getByRole("listitem")).toHaveCount(3);

    await expect(liste).toContainText("Illustration · Dakar");
    await expect(liste).toContainText("Motion · Accra");
    await expect(liste).toContainText(`Acheteuse ${m}`);
    await expect(page.getByText("Ouagadougou")).toHaveCount(0);
    await expect(page.getByText("Lecture", { exact: true })).toHaveCount(0);

    // Un seul « Message » : la vitrine fermée aux messages et l'acheteuse n'en ont pas.
    const messages = page.getByRole("link", { name: /^Message à / });
    await expect(messages).toHaveCount(1);
    await expect(messages).toHaveAccessibleName(`Message à Ouverte ${m}`);
    await expect(messages).toHaveAttribute("href", `/@${m}-ouverte#contact`);

    const axe = await new AxeBuilder({ page }).include("main").analyze();
    expect(axe.violations.flatMap((v) => v.nodes.map((n) => `${v.id} : ${n.target.join(" ")}`))).toEqual([]);

    await messages.click();
    await expect(page).toHaveURL(new RegExp(`/@${m}-ouverte#contact$`));
    await expect(page.locator(`dialog[open][aria-labelledby="contact-${m}-ouverte"]`)).toBeVisible();
  });

  test("sans abonné : une phrase qui le dit, et la vitrine à partager", async ({ page, context, baseURL }) => {
    const m = unique("abo0");
    const createur = await membre(m, "Seule");
    await publier(m, createur);

    await seConnecter(context, createur, baseURL!);
    await page.goto("/dashboard/abonnes");
    await expect(page.getByText("Personne ne suit encore ton travail.")).toBeVisible();
    await expect(page.getByText("Personne ne te suit encore")).toBeVisible();
    await expect(page.getByRole("link", { name: "Voir ma vitrine" })).toHaveAttribute("href", `/@${m}-seule`);
  });

  test("un acheteur, sans boutique, est ramené à son aperçu", async ({ page, context, baseURL }) => {
    const m = unique("abo-a");
    const acheteur = await membre(m, "Acheteur");
    await seConnecter(context, acheteur, baseURL!);
    await page.goto("/dashboard/abonnes");
    await expect(page).toHaveURL(/\/dashboard\/apercu$/);
  });
});
