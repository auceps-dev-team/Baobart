import { appendFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { ressourceVendable } from "./fixtures/donnees";
import { fermerLeBandeau, nouveauMembre, seConnecter } from "./fixtures/session";

/**
 * Le contraste des textes — Q-30, recette du 14/11/2026 : axe relevait 11
 * éléments sur 4 pages à l'ordinateur, 14 au téléphone ; la revue Halo (#66) en
 * a compté 799 sur 41 pages. La preuve est celle d'un outil tiers : axe-core,
 * règle `color-contrast` (WCAG 2 AA, 4,5:1 pour un texte courant).
 *
 * Les pages sont celles de la recette. Un relevé détaillé s'écrit dans le
 * fichier désigné par AXE_RELEVE, s'il est posé : c'est la matière brute.
 */
const PUBLIQUES = ["/", "/explore", "/inscription", "/connexion"];
const CONNECTEES = ["/dashboard/gains", "/dashboard/notifications", "/dashboard/apercu"];

async function contraste(page: import("@playwright/test").Page, chemin: string) {
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

test.describe("le contraste des textes (Q-30)", () => {
  for (const chemin of PUBLIQUES) {
    test(`${chemin} : aucun texte sous 4,5:1`, async ({ page }) => {
      // Au moins une carte : mesuré le 21/11, une base vide cachait le
      // contraste des cartes de la mosaïque (« X dl · Y ventes »).
      await ressourceVendable(1_500);
      await page.goto(chemin);
      await fermerLeBandeau(page);
      expect(await contraste(page, chemin)).toBe(0);
    });
  }

  for (const chemin of CONNECTEES) {
    test(`${chemin} : aucun texte sous 4,5:1`, async ({ page, context, baseURL }) => {
      const membre = await nouveauMembre("q30");
      await seConnecter(context, membre.id, baseURL!);
      await page.goto(chemin);
      await fermerLeBandeau(page);
      expect(await contraste(page, chemin)).toBe(0);
    });
  }
});
