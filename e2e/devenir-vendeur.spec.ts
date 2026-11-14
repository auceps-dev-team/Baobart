import { createHash, randomBytes } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { db, unique } from "./fixtures/donnees";

/**
 * « Devenir vendeur » et l'encart ATELIER du tableau de bord, vus au navigateur,
 * contre un vrai build (lot 3, mission 4, 13/11/2026).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES TROIS ÉTATS VÉRIFIÉS AU NAVIGATEUR ET PAR AXE
 *
 * 1. **Acheteur au départ** (`ACHETEUR`, `lib/auth/roles.ts:60-65` appelé par
 *    `lib/auth/session.ts:196-200` quand `produits === 0`,
 *    `produitsPublies === 0`, `ecrituresAuGrandLivre === 0`) :
 *    `/dashboard/devenir-vendeur` affiche 0 étape sur 3, le bouton « Compléter »
 *    de l'étape 1 pointe vers `/dashboard/boutique`
 *    (`lib/dashboard/devenir-vendeur.ts:116-117`), et `/dashboard/boutique`
 *    s'ouvre au lieu de rediriger (option A, `app/dashboard/boutique/page.tsx:29-33`).
 *
 * 2. **Compte de versement de moins de 24 h** : profil complet (photo, bio,
 *    spécialité, portfolio `https://…`, `lib/reseaux/vitrine.ts:31-33`) et
 *    `PayoutAccount` enregistré il y a 2 h (`VERIFICATION_MS` = 24 h,
 *    `lib/payments/eligibilite.ts:88`). L'étape 1 est « Faite ✓ », l'étape 2
 *    porte la pastille « Faite · délai 24 h » et affiche « Faite, utilisable le … »
 *    (`lib/dashboard/devenir-vendeur.ts:159-165`).
 *
 * 3. **Créateur en ATELIER** (`produits > 0` au statut `DRAFT`,
 *    `produitsPublies === 0`, `ecrituresAuGrandLivre === 0`,
 *    `lib/auth/roles.ts:60-65` via `lib/auth/session.ts:183-200`) :
 *    `/dashboard` ne redirige plus vers `/dashboard/apercu`
 *    (`app/dashboard/page.tsx:51`) et affiche l'encart `[data-encart-atelier]`
 *    (`app/dashboard/page.tsx:113-161`).
 *
 * Session posée en base (`seConnecter`) et analyse d'accessibilité (`sansViolation`)
 * reprises à l'identique de `e2e/badges.spec.ts` et `e2e/avis.spec.ts`.
 */

async function seConnecter(context: BrowserContext, userId: string, baseURL: string) {
  await context.clearCookies();
  const jeton = randomBytes(32).toString("base64url");
  await db.session.create({
    data: { userId, token: createHash("sha256").update(jeton).digest("hex"), expiresAt: new Date(Date.now() + 3_600_000) },
  });
  await context.addCookies([{ name: "baobart_session", value: jeton, url: baseURL }]);
}

async function sansViolation(page: Page, zone: string) {
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

test.describe("devenir vendeur", () => {
  test("acheteur au départ : 0 étape sur 3, axe passe, et l'étape 1 ouvre /dashboard/boutique sans rediriger", async ({ page, context, baseURL }) => {
    const marque = unique("dv");
    const acheteur = await db.user.create({
      data: {
        email: `${marque}@baobart.test`,
        profile: {
          create: {
            username: marque,
            displayName: `Awa ${marque}`,
          },
        },
      },
      select: { id: true },
    });
    await seConnecter(context, acheteur.id, baseURL!);

    await page.goto("/dashboard/devenir-vendeur");
    const zone = page.locator("[data-devenir-vendeur-page]");
    await expect(zone.getByText("Ta progression : 0 étape sur 3")).toBeVisible();
    await expect(zone.getByText("À compléter : photo, bio, spécialité, lien ou portfolio")).toBeVisible();
    await expect(zone.getByText("Aucun moyen configuré")).toBeVisible();
    await expect(zone.getByText("0 / 3", { exact: true })).toBeVisible();

    const boutonEtape1 = zone.getByRole("link", { name: "Compléter" });
    await expect(boutonEtape1).toHaveAttribute("href", "/dashboard/boutique");

    await sansViolation(page, "[data-devenir-vendeur-page]");

    await boutonEtape1.click();
    await expect(page).toHaveURL(/\/dashboard\/boutique$/);
    await expect(page.getByRole("heading", { name: "Profil public" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Voir mon profil public" })).toHaveCount(0);
  });

  test("compte de versement de moins de 24 h : profil complet, l'étape 2 affiche « utilisable le … », et axe passe", async ({ page, context, baseURL }) => {
    const marque = unique("dv");
    const ilYA2Heures = new Date(Date.now() - 2 * 3_600_000);
    const utilisateur = await db.user.create({
      data: {
        email: `${marque}@baobart.test`,
        profile: {
          create: {
            username: marque,
            displayName: `Awa ${marque}`,
            avatarUrl: "https://cdn.baobart.test/avatars/awa.webp",
            bio: "Illustratrice et directrice artistique à Dakar.",
            speciality: "Illustration éditoriale",
            portfolioUrl: "https://awa.design",
          },
        },
        payoutAccounts: {
          create: {
            method: "MOBILE_MONEY",
            provider: "wave",
            accountRef: "+2250700000001",
            holderName: `Awa ${marque}`,
            createdAt: ilYA2Heures,
          },
        },
      },
      select: { id: true },
    });
    await seConnecter(context, utilisateur.id, baseURL!);

    await page.goto("/dashboard/devenir-vendeur");
    const zone = page.locator("[data-devenir-vendeur-page]");
    await expect(zone.getByText("Ta progression : 2 étapes sur 3")).toBeVisible();
    await expect(zone.getByText("Profil complet", { exact: true })).toBeVisible();
    await expect(zone.getByText("Faite ✓", { exact: true })).toBeVisible();
    await expect(zone.getByText("Faite · délai 24 h", { exact: true })).toBeVisible();
    await expect(zone.getByText(/^Faite, utilisable le \d{2}\/\d{2}\/\d{4} à \d{2}:\d{2}$/)).toBeVisible();

    await sansViolation(page, "[data-devenir-vendeur-page]");
  });

  test("créateur en ATELIER : /dashboard montre l'encart [data-encart-atelier], et axe passe sur l'encart", async ({ page, context, baseURL }) => {
    const marque = unique("dv");
    const createur = await db.user.create({
      data: {
        email: `${marque}@baobart.test`,
        profile: {
          create: {
            username: marque,
            displayName: `Awa ${marque}`,
          },
        },
        products: {
          create: {
            name: `Brouillon ${marque}`,
            slug: `brouillon-${marque}`,
            price: 2_500,
            currency: "XOF",
            status: "DRAFT",
          },
        },
      },
      select: { id: true },
    });
    await seConnecter(context, createur.id, baseURL!);

    await page.goto("/dashboard");
    const encart = page.locator("[data-encart-atelier]");
    await expect(encart).toBeVisible();
    await expect(encart.getByText("Ta progression : 0 étape sur 3")).toBeVisible();
    await expect(
      encart.getByText("Complète ton profil, ton moyen de versement et publie tes premières ressources pour ouvrir ta boutique."),
    ).toBeVisible();
    const lienEtapes = encart.getByRole("link", { name: "Voir les étapes →" });
    await expect(lienEtapes).toHaveAttribute("href", "/dashboard/devenir-vendeur");

    await sansViolation(page, "[data-encart-atelier]");

    await lienEtapes.click();
    await expect(page).toHaveURL(/\/dashboard\/devenir-vendeur$/);
    await expect(page.locator("[data-devenir-vendeur-page]")).toBeVisible();
  });
});
