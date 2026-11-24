import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { db, unique } from "./fixtures/donnees";
import { seConnecter } from "./fixtures/session";

/**
 * « Suivre les détails » (lot 5b, `/dashboard/suivre`) sur la vraie page.
 *
 * Ce que les tests d'intégration ne voient pas : que « NOUVEAU » devient
 * « VU » à la visite suivante — et pas pendant celle-ci —, que « Suivi ✓ »
 * défait vraiment le suivi, et que la carte « Abonnés » mène à la liste.
 */

test.use({ viewport: { width: 1440, height: 900 } });

async function membre(marque: string, nom: string, profil: { ville?: string; specialite?: string } = {}) {
  const u = await db.user.create({
    data: {
      email: `${marque}-${nom.toLowerCase()}@baobart.test`,
      profile: {
        create: {
          username: `${marque}-${nom.toLowerCase()}`,
          displayName: `${nom} ${marque}`,
          city: profil.ville ?? null,
          speciality: profil.specialite ?? null,
        },
      },
    },
    select: { id: true },
  });
  return u.id;
}

async function publier(vendeurId: string, nom: string, firstPublishedAt?: Date) {
  await db.product.create({
    data: {
      sellerId: vendeurId,
      name: nom,
      slug: `${nom.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${vendeurId.slice(-6)}`,
      price: 4_000,
      currency: "XOF",
      family: "PACK",
      status: "PUBLISHED",
      firstPublishedAt,
    },
  });
}

test.describe("Suivre les détails — le fil des créateurs suivis", () => {
  test("le fil, les compteurs et les personnes ; NOUVEAU devient VU à la visite suivante ; « Suivi ✓ » défait le suivi", async ({ page, context, baseURL }) => {
    const m = unique("suiv");
    const moi = await membre(m, "Moi");
    await publier(moi, `Ma ressource ${m}`);

    const kofi = await membre(m, "Kofi", { ville: "Accra", specialite: "Motion" });
    const nadia = await membre(m, "Nadia", { ville: "Abidjan", specialite: "DA" });
    await publier(kofi, `Ancienne ${m}`, new Date(Date.now() - 3 * 86_400_000));
    await publier(kofi, `Récente ${m}`, new Date(Date.now() - 2 * 3_600_000));
    await publier(nadia, `Stickers ${m}`, new Date(Date.now() - 86_400_000));
    const abonnee = await membre(m, "Mariam", { ville: "Dakar", specialite: "Illustration" });
    await publier(abonnee, `De Mariam ${m}`);
    for (const c of [kofi, nadia]) await db.follow.create({ data: { followerId: moi, followingId: c } });
    await db.follow.create({ data: { followerId: abonnee, followingId: moi } });

    await seConnecter(context, moi, baseURL!);
    await page.goto("/dashboard/suivre");

    await expect(page.getByRole("heading", { level: 1, name: "Suivre les détails" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Abonnés : 1, \+1 ce mois — voir la liste$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Abonnements : 2, créateurs suivis — voir la liste$/ })).toBeVisible();

    // Le fil : les plus récentes d'abord, tout « NOUVEAU » à la première visite.
    const lignes = page.getByText(/ a publié « /);
    await expect(lignes).toHaveCount(3);
    await expect(lignes.first()).toHaveText(`Kofi ${m} a publié « Récente ${m} »`);
    await expect(page.getByText("NOUVEAU", { exact: true })).toHaveCount(3);
    await expect(page.getByText(`De Mariam ${m}`)).toHaveCount(0); // on ne suit pas Mariam : elle nous suit

    // Les personnes : l'abonnée, puis les deux créateurs suivis.
    const personnes = page.getByRole("list", { name: "Tes derniers abonnés et les créateurs que tu suis" });
    await expect(personnes.getByRole("listitem")).toHaveCount(3);
    await expect(personnes).toContainText("Illustration · Dakar · te suit");
    await expect(personnes).toContainText("Motion · Accra · tu suis");
    await expect(personnes.getByRole("link", { name: `Message à Mariam ${m}` })).toBeVisible();

    const axe = await new AxeBuilder({ page }).include("main").analyze();
    expect(axe.violations.flatMap((v) => v.nodes.map((n) => `${v.id} : ${n.target.join(" ")}`))).toEqual([]);

    // La visite est marquée APRÈS l'affichage : la page ouverte garde ses NOUVEAU,
    // la suivante dit VU.
    await expect.poll(async () => (await db.user.findUniqueOrThrow({ where: { id: moi } })).followFeedSeenAt).not.toBeNull();
    await expect(page.getByText("NOUVEAU", { exact: true })).toHaveCount(3);
    await page.reload();
    await expect(page.getByText("VU", { exact: true })).toHaveCount(3);

    // « Suivi ✓ » défait le suivi de Nadia, et la carte le dit.
    const suiviNadia = personnes.getByRole("button", { name: `Suivi Nadia ${m}` });
    await expect(suiviNadia).toHaveAttribute("aria-pressed", "true");
    await suiviNadia.click();
    await expect(personnes.getByRole("button", { name: `Suivre Nadia ${m}` })).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => db.follow.count({ where: { followerId: moi, followingId: nadia } })).toBe(0);

    // La carte « Abonnés » mène à la liste, sous-page de « Suivre les détails ».
    await page.getByRole("link", { name: /^Abonnés : / }).click();
    await expect(page).toHaveURL(/\/dashboard\/abonnes$/);
    await expect(page.locator('[aria-current="page"]', { hasText: "Suivre les détails" })).toBeVisible();
  });

  test("sans abonnement : le fil dit quoi faire ; le menu créateur a son entrée", async ({ page, context, baseURL }) => {
    const m = unique("suiv0");
    const seule = await membre(m, "Seule");
    await publier(seule, `Seule ${m}`);

    await seConnecter(context, seule, baseURL!);
    await page.goto("/dashboard/suivre");
    await expect(page.getByText("Tu ne suis encore personne")).toBeVisible();
    await expect(page.getByRole("list", { name: "Tes derniers abonnés et les créateurs que tu suis" })).toHaveCount(0);
    await expect(page.locator('[aria-current="page"]', { hasText: "Suivre les détails" })).toBeVisible();
  });
});
