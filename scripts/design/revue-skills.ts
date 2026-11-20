/**
 * La revue de chaque vue avec les skills de la livraison Halo — ce qui s'en
 * mesure dans un navigateur. Sortie : `captures-design/revue-skills.json`
 * (ignoré par git), résumé dans la console.
 *
 *   pnpm build
 *   APP_URL=http://localhost:3300 pnpm exec next start -p 3300
 *   pnpm design:revue                              # toutes les routes (≈ 10 min)
 *   pnpm design:revue -- --seulement=dashboard     # un sous-ensemble
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QU'IL MESURE, ET QUEL SKILL LE DEMANDE
 *
 * Chaque route de `ecrans.ts` est ouverte deux fois.
 *
 *   Bureau, 1440 × 900, mouvement normal :
 *     - axe-core, règles WCAG 2.0 à 2.2 A et AA (`apple-design` §14, « Craft » :
 *       la revue de finition suppose d'abord une page lisible par tous) ;
 *     - les règles `:hover` qui déplacent ou grandissent un élément sans être
 *       rangées sous `@media (hover: hover)` (`mobile-native` §1,
 *       `review-animations` standard 8) : sur un téléphone, l'élément touché
 *       reste « survolé ».
 *
 *   Téléphone, 320 × 640, tactile, mouvement réduit demandé :
 *     - le débordement horizontal (`break-ui`, « Container at 320px ») ;
 *     - les champs sous 16 px quand le pointeur est grossier (`mobile-native` §4 :
 *       iOS zoome sur le champ et ne dézoome pas) ;
 *     - les animations encore en cours au bout d'une seconde et demie, et
 *       parmi elles les boucles infinies (`review-animations` standard 8,
 *       `apple-design` §14 : sous mouvement réduit, rien ne doit tourner sans fin) ;
 *     - la surbrillance grise au toucher sur les liens (`mobile-native` §2).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QU'IL NE MESURE PAS
 *
 * Le « ressenti » : une courbe, un rebond, un retard au toucher. Les skills
 * le disent eux-mêmes — l'émulation de Chrome ne reproduit ni le survol collé,
 * ni le délai de 300 ms, ni l'encoche, ni le clavier (`mobile-native` §11).
 * Ce qui en relève s'écrit dans l'inventaire comme « à vérifier sur un vrai
 * téléphone », pas comme réglé.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { construireUrl, COOKIE_CONSENTEMENT, EMAILS, fermerSessions, NOMMER, ouvrirSessions, resoudreParametres } from "./acces";
import { ECRANS, ROUTES_SANS_MAQUETTE, type Compte } from "./ecrans";
import { PIRE_CAS } from "./pire-cas-donnees";

const args = new Map(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, ...v] = a.slice(2).split("=");
      return [k, v.join("=") || "1"] as const;
    }),
);
const BASE = args.get("base") ?? "http://localhost:3300";
const SORTIE = resolve(args.get("sortie") ?? "captures-design");
const SEULEMENT = args.get("seulement");
/** `break-ui` : les vues avec le jeu de `pire-cas.ts` au lieu de la démonstration. */
const PIRE = args.has("pire-cas");
/** Une capture par vue (320 px pleine page, 1440 px premier écran), pour regarder ce que les mesures ne disent pas. */
const CAPTURES = args.has("captures");

const ETIQUETTES_AXE = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

interface Bureau {
  axe: { id: string; impact: string | null; noeuds: number; exemples: string[] }[];
  survolsNonFiltres: string[];
}

interface Telephone {
  pointeurGrossier: boolean;
  debordement: number;
  fautifs: string[];
  champsSous16: string[];
  animationsEnCours: string[];
  bouclesInfinies: string[];
  liensSurbrillance: number;
  ajustementTexte: string;
  chiffresTabulaires: string;
}

interface Ligne {
  id: string;
  route: string;
  compte: Compte | null;
  url?: string;
  nonMesure?: string;
  statut?: number;
  urlFinale?: string;
  bureau?: Bureau | { erreur: string };
  telephone?: Telephone | { erreur: string };
}

/** Les règles `:hover` qui bougent un élément hors de `@media (hover: hover)`. Lu dans les feuilles servies. */
function survolsNonFiltres(): string[] {
  const bouge = /(^|-)(transform|translate|scale|rotate|box-shadow)$/;
  const trouves = new Set<string>();
  const parcourir = (regles: CSSRuleList, filtre: boolean) => {
    for (const r of Array.from(regles)) {
      if (r instanceof CSSMediaRule) {
        parcourir(r.cssRules, filtre || /hover:\s*hover/.test(r.conditionText));
      } else if (r instanceof CSSStyleRule) {
        if (!filtre && r.selectorText.includes(":hover")) {
          const props = Array.from(r.style).filter((p) => bouge.test(p));
          if (props.length > 0) trouves.add(`${r.selectorText} { ${props.join(", ")} }`);
        }
        // Imbrication CSS (`&:hover` dans un bloc) : Chrome la garde en règles enfants.
        if ("cssRules" in r && (r as CSSStyleRule & { cssRules?: CSSRuleList }).cssRules?.length) {
          parcourir((r as CSSStyleRule & { cssRules: CSSRuleList }).cssRules, filtre);
        }
      } else if ("cssRules" in r && (r as CSSGroupingRule).cssRules) {
        // @supports, @layer : on descend, le filtre reste celui du parent.
        parcourir((r as CSSGroupingRule).cssRules, filtre);
      }
    }
  };
  for (const feuille of Array.from(document.styleSheets)) {
    try {
      parcourir(feuille.cssRules, false);
    } catch {
      // Feuille d'une autre origine : illisible, et pas la nôtre.
    }
  }
  return [...trouves].sort();
}

function mesurerTelephone(vw: number): Telephone {
  const decrire = (el: Element) => {
    const r = el.getBoundingClientRect();
    const texte = (el.textContent ?? el.getAttribute("aria-label") ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
    const classe = typeof el.className === "string" ? el.className.split(" ")[0] : "";
    return `${el.tagName.toLowerCase()}${classe ? "." + classe : ""} « ${texte} » ${Math.round(r.width)}×${Math.round(r.height)}`;
  };
  // Visible ET atteignable : les pièges à robots (`societe`, `ouvertLe`) sont rendus hors de
  // l'écran exprès — même règle que `mesurer` dans captures.ts.
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return (
      r.width > 1 && r.height > 1 && r.right > 0 && r.bottom + window.scrollY > 0 &&
      s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0"
    );
  };
  // La largeur est PASSÉE, pas lue : voir `mesurer` dans captures.ts (14/11).
  const debordement = Math.max(0, document.documentElement.scrollWidth - vw);
  const fautifs: string[] = [];
  if (debordement > 0) {
    for (const el of document.body.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 && r.width > 0 && r.width <= vw * 3 && getComputedStyle(el).position !== "fixed") {
        fautifs.push(decrire(el));
        if (fautifs.length >= 5) break;
      }
    }
  }
  const champsSous16 = [
    ...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea"),
  ]
    .filter(visible)
    .filter((el) => Number.parseFloat(getComputedStyle(el).fontSize) < 16)
    .map((el) => `${el.tagName.toLowerCase()}[${(el as HTMLInputElement).name || (el as HTMLInputElement).type}] ${getComputedStyle(el).fontSize}`);
  const nommer = (a: Animation) => {
    const cible = (a.effect as KeyframeEffect | null)?.target;
    const nom =
      a instanceof CSSAnimation ? `@keyframes ${a.animationName}` : a instanceof CSSTransition ? `transition ${a.transitionProperty}` : "script";
    const t = a.effect?.getComputedTiming();
    return `${nom} (${t?.duration} ms × ${t?.iterations}) sur ${cible ? decrire(cible) : "?"}`;
  };
  const enCours = document.getAnimations().filter((a) => a.playState === "running");
  return {
    pointeurGrossier: matchMedia("(pointer: coarse)").matches,
    debordement,
    fautifs,
    champsSous16,
    animationsEnCours: enCours.map(nommer).slice(0, 10),
    bouclesInfinies: enCours.filter((a) => a.effect?.getComputedTiming().iterations === Infinity).map(nommer),
    liensSurbrillance: [...document.querySelectorAll("a[href]")].filter(
      (a) => !/rgba\(0, 0, 0, 0\)|transparent/.test(getComputedStyle(a).getPropertyValue("-webkit-tap-highlight-color")),
    ).length,
    ajustementTexte: getComputedStyle(document.documentElement).getPropertyValue("-webkit-text-size-adjust") || "(non posé)",
    chiffresTabulaires: getComputedStyle(document.body).fontVariantNumeric,
  };
}

async function ouvrir(contexte: BrowserContext, url: string): Promise<{ page: Page; statut?: number; urlFinale: string }> {
  const page = await contexte.newPage();
  const reponse = await page.goto(url, { waitUntil: "load", timeout: 90_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  return { page, statut: reponse?.status(), urlFinale: page.url() };
}

async function main() {
  const lignes: Ligne[] = [
    ...ECRANS.filter((e) => e.route).map((e) => ({ id: e.id, route: e.route!, compte: e.compte ?? null })),
    ...ROUTES_SANS_MAQUETTE.map((r) => ({ id: `app${r.route}`, route: r.route, compte: r.compte ?? null })),
    // Le pire cas a une fiche par valeur extrême, et un créateur aux valeurs courtes.
    ...(PIRE ? [
      ...PIRE_CAS.produits.filter((p) => p.cle !== "long").map((p) => ({ id: `pire-cas/fiche-${p.cle}`, route: `/products/pire-cas-${p.cle}`, compte: null })),
      { id: "pire-cas/createur-court", route: `/createurs/${PIRE_CAS.createurCourt.username}`, compte: null },
    ] : []),
  ]
    // Une route vue par le même compte ne se mesure qu'une fois.
    .filter((l, i, toutes) => toutes.findIndex((x) => x.route === l.route && x.compte === l.compte) === i)
    .filter((l) => !SEULEMENT || l.id.includes(SEULEMENT) || l.route.includes(SEULEMENT));

  const sante = await fetch(BASE).catch(() => null);
  if (!sante) throw new Error(`Aucun serveur sur ${BASE} : « pnpm build » puis « pnpm exec next start -p 3300 ».`);

  const db = new PrismaClient();
  const navigateur = await chromium.launch();
  let sessions: string[] = [];
  try {
    // La bascule de `break-ui` : le créateur connecté et les fiches ouvertes sont ceux du pire cas.
    const ouvertes = await ouvrirSessions(db, PIRE ? { ...EMAILS, createur: PIRE_CAS.createurLong.email } : EMAILS);
    sessions = ouvertes.sessions;
    const parametres = await resoudreParametres(db, ouvertes.ids);
    if (PIRE) {
      const long = await db.product.findUnique({ where: { slug: "pire-cas-long" }, select: { id: true } });
      if (!long) throw new Error("Jeu du pire cas absent : lancer « pnpm design:pire-cas » d'abord.");
      parametres.produit = "pire-cas-long";
      parametres.produitCreateur = long.id;
      parametres.createur = PIRE_CAS.createurLong.username;
    }
    if (CAPTURES) mkdirSync(join(SORTIE, "captures"), { recursive: true });
    const nomFichier = (id: string) => id.replace(/[^\w-]+/g, "_");
    const contextes = new Map<string, BrowserContext>();
    const contexte = async (compte: Compte | null, mode: "bureau" | "telephone") => {
      const cle = `${compte ?? "visiteur"}@${mode}`;
      let c = contextes.get(cle);
      if (!c) {
        c = await navigateur.newContext(
          mode === "bureau"
            ? { viewport: { width: 1440, height: 900 }, locale: "fr-FR" }
            : { viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, reducedMotion: "reduce", locale: "fr-FR" },
        );
        await c.addInitScript(NOMMER);
        await c.addCookies([{ ...COOKIE_CONSENTEMENT, url: BASE }]);
        if (compte) await c.addCookies([{ name: "baobart_session", value: ouvertes.jetons[compte], url: BASE }]);
        contextes.set(cle, c);
      }
      return c;
    };

    for (const l of lignes) {
      const u = construireUrl(l.route, parametres, BASE);
      if ("raison" in u) {
        l.nonMesure = u.raison;
        continue;
      }
      l.url = u.url;

      try {
        const { page, statut, urlFinale } = await ouvrir(await contexte(l.compte, "bureau"), u.url);
        l.statut = statut;
        l.urlFinale = urlFinale;
        try {
          const axe = await new AxeBuilder({ page }).withTags(ETIQUETTES_AXE).analyze();
          l.bureau = {
            axe: axe.violations.map((v) => ({
              id: v.id,
              impact: v.impact ?? null,
              noeuds: v.nodes.length,
              exemples: v.nodes.slice(0, 3).map((n) => `${n.target.join(" ")} — ${(n.failureSummary ?? "").split("\n").slice(1, 2).join("").trim()}`),
            })),
            survolsNonFiltres: await page.evaluate(survolsNonFiltres),
          };
          if (CAPTURES) await page.screenshot({ path: join(SORTIE, "captures", `${nomFichier(l.id)}@1440.png`) });
        } finally {
          await page.close();
        }
      } catch (err) {
        l.bureau = { erreur: String((err as Error).message).split("\n")[0] ?? "" };
      }

      try {
        const { page } = await ouvrir(await contexte(l.compte, "telephone"), u.url);
        try {
          // Une seconde et demie : les apparitions (≤ 450 ms) et les transitions sont finies.
          await page.waitForTimeout(1500);
          l.telephone = await page.evaluate(mesurerTelephone, 320);
          if (CAPTURES) await page.screenshot({ path: join(SORTIE, "captures", `${nomFichier(l.id)}@320.png`), fullPage: true });
        } finally {
          await page.close();
        }
      } catch (err) {
        l.telephone = { erreur: String((err as Error).message).split("\n")[0] ?? "" };
      }
      process.stdout.write(".");
    }
    for (const c of contextes.values()) await c.close();
  } finally {
    await fermerSessions(db, sessions).catch(() => {});
    await navigateur.close();
    await db.$disconnect();
  }

  mkdirSync(SORTIE, { recursive: true });
  const fichier = join(SORTIE, "revue-skills.json");
  writeFileSync(fichier, JSON.stringify({ date: new Date().toISOString(), base: BASE, lignes }, null, 2));

  // Résumé
  const mesurees = lignes.filter((l) => l.url);
  const bureau = mesurees.map((l) => l.bureau).filter((b): b is Bureau => !!b && !("erreur" in b));
  const tel = mesurees.map((l) => l.telephone).filter((t): t is Telephone => !!t && !("erreur" in t));
  const parRegle = new Map<string, { pages: number; noeuds: number }>();
  for (const b of bureau) for (const v of b.axe) {
    const x = parRegle.get(v.id) ?? { pages: 0, noeuds: 0 };
    parRegle.set(v.id, { pages: x.pages + 1, noeuds: x.noeuds + v.noeuds });
  }
  const survols = new Set(bureau.flatMap((b) => b.survolsNonFiltres));
  console.log(`\n${mesurees.length} routes mesurées, ${lignes.length - mesurees.length} non mesurées, rapport : ${fichier}`);
  console.log(`erreurs : bureau ${mesurees.length - bureau.length}, téléphone ${mesurees.length - tel.length}`);
  console.log("axe, par règle :", Object.fromEntries([...parRegle].sort((a, b) => b[1].pages - a[1].pages)));
  console.log(`survols non filtrés (distincts) : ${survols.size}`);
  console.log(`pointeur grossier reconnu : ${tel.filter((t) => t.pointeurGrossier).length}/${tel.length}`);
  console.log(`débordement à 320 px : ${tel.filter((t) => t.debordement > 0).length} pages`);
  console.log(`champs sous 16 px : ${tel.filter((t) => t.champsSous16.length > 0).length} pages, ${tel.reduce((n, t) => n + t.champsSous16.length, 0)} champs`);
  console.log(`boucles infinies sous mouvement réduit : ${tel.filter((t) => t.bouclesInfinies.length > 0).length} pages`);
  console.log(`liens avec surbrillance au toucher : ${tel.filter((t) => t.liensSurbrillance > 0).length} pages`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
