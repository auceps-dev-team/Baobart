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

/**
 * Revue avec les skills Halo (20/11/2026) : ce qui ne se vérifie qu'au navigateur.
 * Les règles lisibles dans le texte sont gardées par lib/systeme/mouvement.test.ts ;
 * l'inventaire est dans Doc/REVUE_SKILLS_HALO_2026-11.md.
 */
test.describe("sur un écran tactile (skill `mobile-native`)", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("le survol ne soulève pas le bouton : un téléphone n'a pas de survol", async ({ page }) => {
    await page.goto("/connexion");
    // L'émulation doit bien retirer le survol, sans quoi ce test ne vérifierait rien.
    expect(await page.evaluate(() => matchMedia("(hover: hover)").matches)).toBe(false);
    const b = bouton(page);
    await b.hover();
    await page.waitForTimeout(300); // la transition dure 140 ms
    // Avant la revue : `matrix(1, 0, 0, 1, -2, -2)`, et il le restait jusqu'au toucher suivant.
    expect((await styles(b)).transform).toBe("none");
  });

  test("un champ fait au moins 16 px sous le doigt : iOS ne zoome pas dessus", async ({ page }) => {
    await page.goto("/connexion");
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
    const tailles = await page
      .locator('input[name="email"], input[name="motDePasse"]')
      .evaluateAll((els) => els.map((e) => Number.parseFloat(getComputedStyle(e).fontSize)));
    // Avant la revue : 14 px, les deux (mesuré le 20/11).
    expect(tailles).toHaveLength(2);
    for (const t of tailles) expect(t).toBeGreaterThanOrEqual(16);
  });
});

test("les chiffres sont tabulaires partout : un compteur qui change ne fait pas bouger sa ligne", async ({ page }) => {
  await page.goto("/connexion");
  expect(await page.evaluate(() => getComputedStyle(document.body).fontVariantNumeric)).toBe("tabular-nums");
});

test("sous mouvement réduit, aucune boucle de la feuille de style ne tourne", async ({ page }) => {
  /** Chaque classe seule dont la règle boucle sans fin, posée sur un élément neuf : tourne-t-elle ? */
  const boucles = () =>
    page.evaluate(() => {
      const classes = new Set<string>();
      const parcourir = (regles: CSSRuleList) => {
        for (const r of Array.from(regles)) {
          if (r instanceof CSSStyleRule && /\binfinite\b/.test(r.style.cssText)) {
            for (const s of r.selectorText.split(",")) {
              const m = /^\s*\.([\w-]+)\s*$/.exec(s);
              if (m) classes.add(m[1]!);
            }
          }
          if ("cssRules" in r && (r as CSSGroupingRule).cssRules) parcourir((r as CSSGroupingRule).cssRules);
        }
      };
      for (const f of Array.from(document.styleSheets)) {
        try {
          parcourir(f.cssRules);
        } catch {
          // feuille d'une autre origine
        }
      }
      const tournent: string[] = [];
      for (const c of classes) {
        const d = document.createElement("div");
        d.className = c;
        document.body.append(d);
        const infinie = d.getAnimations().some((a) => a.playState === "running" && a.effect?.getComputedTiming().iterations === Infinity);
        if (infinie) tournent.push(c);
        d.remove();
      }
      return { classes: [...classes].sort(), tournent: tournent.sort() };
    });

  await page.goto("/connexion");
  // Témoin : sans préférence, les boucles tournent bel et bien — le test n'est pas aveugle.
  const libre = await boucles();
  expect(libre.classes.length).toBeGreaterThanOrEqual(5);
  expect(libre.tournent).toContain("flotte");

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduit = await boucles();
  // La règle générale raccourcit les durées, pas les tours : chaque boucle doit être arrêtée.
  expect(reduit.tournent).toEqual([]);
});
