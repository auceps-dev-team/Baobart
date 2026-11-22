import { appendFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { db, ressourceVendable, unique } from "./fixtures/donnees";
import { fermerLeBandeau, nouveauMembre, seConnecter } from "./fixtures/session";

/**
 * Le contraste des textes — Q-30, recette du 14/11/2026 : axe relevait 11
 * éléments sur 4 pages à l'ordinateur, 14 au téléphone ; la revue Halo (#66) en
 * a compté 799 sur 41 pages. La preuve est celle d'un outil tiers : axe-core,
 * règle `color-contrast` (WCAG 2 AA, 4,5:1 pour un texte courant).
 *
 * Élargi le 22/11/2026 (décision du responsable : « vérifie le contraste et si
 * besoin fixe ») : le relevé complet (`contraste-toutes-les-pages.spec.ts`, 108
 * routes, base remplie) comptait 1 048 textes sous 4,5:1, dont 810 venus d'UN
 * style — l'étiquette du panneau d'opérations, à `opacity: 0.55`. Ce fichier-ci
 * tourne dans la CI, sur ses propres données : il garde les pages qui portaient
 * les défauts, pour qu'ils ne reviennent pas.
 *
 * Un relevé détaillé s'écrit dans le fichier désigné par AXE_RELEVE, s'il est
 * posé : c'est la matière brute.
 */
const PUBLIQUES = ["/", "/explore", "/inscription", "/connexion", "/a-propos", "/fonctionnalites", "/createurs"];
const CONNECTEES = ["/dashboard/gains", "/dashboard/notifications", "/dashboard/apercu"];
const CREATEUR = ["/dashboard/forfait", "/dashboard/profil", "/dashboard/promos", "/dashboard/ventes", "/dashboard/produits"];
const ADMINISTRATION = ["/dashboard/statuts", "/dashboard/systeme/membres"];

async function contraste(page: Page, chemin: string) {
  const r = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
  const noeuds = r.violations.flatMap((v) => v.nodes);
  if (process.env.AXE_RELEVE) {
    for (const n of noeuds) {
      const d = (n.any[0]?.data ?? {}) as { contrastRatio?: number; fgColor?: string; bgColor?: string };
      appendFileSync(process.env.AXE_RELEVE, `${chemin}\t${d.contrastRatio}\t${d.fgColor}\t${d.bgColor}\t${n.target.join(" ")}\t${n.html.slice(0, 140).replace(/\s+/g, " ")}\n`);
    }
  }
  return noeuds.length;
}

/**
 * Comme un lecteur : jusqu'en bas, avant de mesurer. Les sections qui
 * apparaissent au défilement sont transparentes tant qu'elles n'ont pas été
 * vues — un état que personne ne lit, et qu'axe comptait (1,06:1, 22/11).
 */
async function defilerJusquEnBas(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 25));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page.waitForTimeout(250);
}

/** Une vente réussie, pour que la liste « Ventes » montre ses étiquettes. */
async function uneVente(vendeurId: string) {
  const produit = await db.product.findFirstOrThrow({ where: { sellerId: vendeurId }, select: { id: true } });
  const acheteur = await nouveauMembre("q30a");
  await db.order.create({
    data: {
      buyerId: acheteur.id,
      currency: "XOF",
      total: 5_000,
      status: "COMPLETED",
      items: { create: { productId: produit.id, price: 5_000, quantity: 1, state: "SUCCESSFUL" } },
    },
  });
}

test.describe("le contraste des textes (Q-30)", () => {
  for (const chemin of PUBLIQUES) {
    test(`${chemin} : aucun texte sous 4,5:1`, async ({ page }) => {
      // Au moins une carte : mesuré le 21/11, une base vide cachait le
      // contraste des cartes de la mosaïque (« X dl · Y ventes »).
      await ressourceVendable(1_500);
      await page.goto(chemin);
      await fermerLeBandeau(page);
      await defilerJusquEnBas(page);
      expect(await contraste(page, chemin)).toBe(0);
    });
  }

  test("/a-propos, avant tout défilement : le texte qui « s'allume » reste lisible", async ({ page }) => {
    // Le plancher de `defil-allume` : 0,18 donnait 1,55:1 aux mots pas encore
    // allumés — 37 textes sur cette page au relevé du 22/11. À 0,5 : 5,36:1.
    await page.goto("/a-propos");
    await fermerLeBandeau(page);
    expect(await contraste(page, "/a-propos (sans défilement)")).toBe(0);
  });

  for (const chemin of CONNECTEES) {
    test(`${chemin} : aucun texte sous 4,5:1`, async ({ page, context, baseURL }) => {
      const membre = await nouveauMembre("q30");
      await seConnecter(context, membre.id, baseURL!);
      await page.goto(chemin);
      await fermerLeBandeau(page);
      await defilerJusquEnBas(page);
      expect(await contraste(page, chemin)).toBe(0);
    });
  }

  for (const chemin of CREATEUR) {
    test(`${chemin} (créateur) : aucun texte sous 4,5:1`, async ({ page, context, baseURL }) => {
      const r = await ressourceVendable(2_000);
      await uneVente(r.vendeurId);
      await seConnecter(context, r.vendeurId, baseURL!);
      await page.goto(chemin);
      await fermerLeBandeau(page);
      await defilerJusquEnBas(page);
      expect(await contraste(page, chemin)).toBe(0);
    });
  }

  for (const chemin of ADMINISTRATION) {
    test(`${chemin} (administration) : aucun texte sous 4,5:1`, async ({ page, context, baseURL }) => {
      // Des comptes à lister : l'étiquette du panneau d'opérations (810 des
      // 1 048 textes du relevé) ne s'affiche que sur une ligne.
      await nouveauMembre(unique("q30m"));
      await nouveauMembre(unique("q30m"));
      const admin = await nouveauMembre("q30-admin");
      await db.user.update({ where: { id: admin.id }, data: { platformRole: "SUPER_ADMIN" } });
      await seConnecter(context, admin.id, baseURL!);
      await page.goto(chemin);
      await fermerLeBandeau(page);
      await defilerJusquEnBas(page);
      expect(await contraste(page, chemin)).toBe(0);
    });
  }
});
