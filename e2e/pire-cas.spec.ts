import { expect, test } from "@playwright/test";

import { PIRE_CAS } from "../scripts/design/pire-cas-donnees";
import { db, unique } from "./fixtures/donnees";

/**
 * Le pire cas réaliste (skill Halo `break-ui`), à 320 px : rien ne déborde.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI CES VALEURS
 *
 * Celles de `scripts/design/pire-cas-donnees.ts`, que la revue du 20/11/2026 a
 * posées en développement et regardées vue par vue
 * (Doc/REVUE_SKILLS_HALO_2026-11.md, « break-ui ») : un nom affiché à la limite
 * du profil, un identifiant de 40 caractères sans tiret — rien où couper —, un
 * titre de 165 caractères, un nom de fichier insécable, de l'arabe, des emoji,
 * un million de « j'aime ».
 *
 * Le skill demande de garder ce jeu après correction : c'est le test de
 * non-régression pour la prochaine personne qui touche ces écrans.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LA LARGEUR, PASSÉE ET NON LUE
 *
 * En émulation mobile, une page plus large que l'écran fait dézoomer Chrome, et
 * `innerWidth` devient la largeur de la page : comparer la page à elle-même ne
 * trouve jamais rien (mesuré le 14/11, voir scripts/design/captures.ts).
 */

const LARGEUR = 320;
test.use({ viewport: { width: LARGEUR, height: 640 }, isMobile: true, hasTouch: true });

let createur: { username: string };
let fiches: { cle: string; slug: string; nom: string }[] = [];

test.beforeAll(async () => {
  // L'identifiant reste à 40 caractères sans tiret, et unique d'un passage à l'autre.
  const suffixe = unique("").replace(/[^a-z0-9]/g, "");
  const username = (PIRE_CAS.createurLong.username.slice(0, 40 - suffixe.length) + suffixe).slice(0, 40);
  const vendeur = await db.user.create({
    data: {
      email: `${unique("pire-cas")}@pire-cas.test`,
      profile: {
        create: {
          username,
          // La limite du profil : 80 caractères, celle que l'inscription applique aussi depuis le 20/11.
          displayName: PIRE_CAS.createurLong.displayName.slice(0, 80),
          city: PIRE_CAS.createurLong.city,
          followerCount: 1_284,
          workCount: 1,
        },
      },
    },
    select: { id: true },
  });
  createur = { username };
  fiches = [];
  for (const p of PIRE_CAS.produits.filter((x) => ["long", "insecable", "arabe", "emoji"].includes(x.cle))) {
    const { cle, ...champs } = p;
    const slug = unique(`pire-cas-${cle}`);
    await db.product.create({ data: { ...champs, sellerId: vendeur.id, slug, currency: "XOF", status: "PUBLISHED" } });
    fiches.push({ cle, slug, nom: champs.name });
  }
});

async function debordement(page: import("@playwright/test").Page) {
  return page.evaluate((vw) => {
    const de = Math.max(0, document.documentElement.scrollWidth - vw);
    const fautifs: string[] = [];
    if (de > 0) {
      for (const el of document.body.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1 && r.width > 0 && getComputedStyle(el).position !== "fixed") {
          fautifs.push(`${el.tagName.toLowerCase()} « ${(el.textContent ?? "").trim().slice(0, 40)} » ${Math.round(r.width)} px`);
          if (fautifs.length >= 3) break;
        }
      }
    }
    return { de, fautifs };
  }, LARGEUR);
}

test("la fiche de chaque ressource extrême tient dans 320 px", async ({ page }) => {
  expect(fiches).toHaveLength(4);
  for (const f of fiches) {
    await page.goto(`/products/${f.slug}`);
    // Le titre, et non un `h1` : la fiche n'en a pas (relevé le 20/11 ; c'est Q-29, suivi ailleurs).
    await expect(page.getByText(f.nom.slice(0, 12)).first()).toBeVisible();
    expect(await debordement(page), `fiche « ${f.cle} »`).toEqual({ de: 0, fautifs: [] });
  }
});

test("sur la fiche, le nom le plus long ne passe pas sous « Suivre »", async ({ page }) => {
  await page.goto(`/products/${fiches.find((f) => f.cle === "long")!.slug}`);
  // Les rectangles du TEXTE, pas ceux des boîtes : c'est le texte qui débordait de la sienne
  // et passait sous le bouton (vu le 20/11) — les boîtes, elles, ne se touchaient pas.
  const chevauche = await page.evaluate(() => {
    const lien = document.querySelector('a[title^="Voir le profil de"]');
    const bouton = [...document.querySelectorAll("button")].find((b) => /Suivre/.test(b.textContent ?? ""));
    if (!lien || !bouton) return "introuvable";
    const plage = document.createRange();
    plage.selectNodeContents(lien);
    const b = bouton.getBoundingClientRect();
    return [...plage.getClientRects()].some((t) => t.right > b.left + 1 && t.left < b.right - 1 && t.bottom > b.top + 1 && t.top < b.bottom - 1);
  });
  expect(chevauche).toBe(false);
});

test("la page du créateur au nom le plus long tient dans 320 px", async ({ page }) => {
  await page.goto(`/createurs/${createur.username}`);
  await expect(page.getByText(PIRE_CAS.createurLong.displayName.slice(0, 20)).first()).toBeVisible();
  expect(await debordement(page)).toEqual({ de: 0, fautifs: [] });
});
