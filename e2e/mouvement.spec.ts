import { expect, test, type Locator } from "@playwright/test";

/**
 * Le geste de pression, tel que le navigateur l'applique.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI AU NAVIGATEUR
 *
 * Les jetons vivent dans `app/globals.css`, compilé par Tailwind : seul le
 * style CALCULÉ dit ce qui s'applique vraiment — une variable mal nommée ou
 * une règle écrasée ne lève aucune erreur, le bouton bouge simplement autrement.
 *
 * Mesuré sur le bouton d'envoi de `/connexion` : une page publique, qui
 * n'a besoin d'aucune donnée, et qui porte `sticker-press`.
 *
 * Valeurs : livraison « Halo » (D1, 13/11/2026), « Baobart Design
 * System.dc.html » — 140 ms, `cubic-bezier(.23,1,.32,1)`, clic à 97 %.
 */

const COURBE = "cubic-bezier(0.23, 1, 0.32, 1)";

async function styles(el: Locator) {
  return el.evaluate((e) => {
    const s = getComputedStyle(e);
    return {
      transform: s.transform,
      durees: s.transitionDuration.split(", "),
      courbes: s.transitionTimingFunction.split(/, (?=cubic|ease|linear|step)/),
      selection: s.userSelect,
      toucher: s.touchAction,
    };
  });
}

/** Le bouton d'envoi du formulaire de connexion. */
const bouton = (page: import("@playwright/test").Page) =>
  page.locator('form button[type="submit"].sticker-press');

test.describe("le geste de pression (sticker-press)", () => {
  test("140 ms, une seule courbe, ni sélection ni délai au toucher", async ({ page }) => {
    await page.goto("/connexion");
    const s = await styles(bouton(page));

    expect(s.durees.length).toBeGreaterThan(0);
    expect(new Set(s.durees)).toEqual(new Set(["0.14s"]));
    expect(new Set(s.courbes)).toEqual(new Set([COURBE]));
    expect(s.selection).toBe("none");
    expect(s.toucher).toBe("manipulation");
  });

  test("se soulève au survol, se réduit à 97 % pendant l'appui", async ({ page }) => {
    await page.goto("/connexion");
    const b = bouton(page);

    await b.hover();
    await expect.poll(async () => (await styles(b)).transform).toBe("matrix(1, 0, 0, 1, -2, -2)");

    await page.mouse.down();
    await expect.poll(async () => (await styles(b)).transform).toBe("matrix(0.97, 0, 0, 0.97, 0, 0)");

    // Relâcher HORS du bouton : un clic enverrait le formulaire vide.
    await page.mouse.move(0, 0);
    await page.mouse.up();
  });

  test("ne s'anime plus quand le système demande moins de mouvement", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/connexion");
    const s = await styles(bouton(page));

    // `app/globals.css` ramène toute durée à 0,01 ms sous `prefers-reduced-motion`.
    for (const d of s.durees) {
      expect(Number.parseFloat(d), d).toBeLessThan(0.001);
    }
  });
});
