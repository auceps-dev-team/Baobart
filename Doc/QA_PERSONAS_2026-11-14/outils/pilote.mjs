/**
 * Pilote de navigateur pour le QA par personas (14/11/2026).
 *
 * Un Chromium reste ouvert ; chaque persona a sa session à elle (cookies
 * séparés, écran et fuseau à elle). On lui envoie un geste à la fois, et il
 * rend ce qu'un testeur regarderait : l'adresse, le titre, ce qui est écrit à
 * l'écran, les erreurs de console et les réponses HTTP en échec, une capture.
 *
 *   node qa/pilote.mjs            → démarre (port 3499)
 *   node qa/c.mjs awa < geste.js  → joue un geste dans la session d'Awa
 */

import http from "node:http";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3400";
const PORT = Number(process.env.QA_PILOTE_PORT ?? 3499);
const CAPTURES = process.env.QA_CAPTURES ?? join(process.cwd(), "qa", "captures") /* hors dépôt : qa/ est ignoré par le contrôle de style et les captures pèsent lourd */;
mkdirSync(CAPTURES, { recursive: true });

const MOBILE_ANDROID =
  "Mozilla/5.0 (Linux; Android 12; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

/** L'équipement de chaque persona, tel que le bilan marketing le décrit. */
const PROFILS = {
  // Awa : Android milieu de gamme, Dakar.
  awa: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: MOBILE_ANDROID, locale: "fr-SN", timezoneId: "Africa/Dakar" },
  // Serge : poste d'agence, Abidjan.
  serge: { viewport: { width: 1440, height: 900 }, locale: "fr-CI", timezoneId: "Africa/Abidjan" },
  // Yao : étudiant, téléphone, Accra — navigateur en anglais.
  yao: { viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: MOBILE_ANDROID, locale: "en-GH", timezoneId: "Africa/Accra" },
  // Fatou : Paris, portable.
  fatou: { viewport: { width: 1280, height: 800 }, locale: "fr-FR", timezoneId: "Europe/Paris" },
};
const DEFAUT = { viewport: { width: 1366, height: 800 }, locale: "fr-FR", timezoneId: "Africa/Abidjan" };

const navigateur = await chromium.launch();
const sessions = new Map();
let numero = 0;

async function session(nom) {
  if (sessions.has(nom)) return sessions.get(nom);
  const contexte = await navigateur.newContext({ baseURL: BASE, ...(PROFILS[nom] ?? DEFAUT) });
  contexte.setDefaultTimeout(10_000);
  contexte.setDefaultNavigationTimeout(30_000);
  const evenements = [];
  const brancher = (page) => {
    page.on("console", (m) => {
      if (m.type() === "error") evenements.push(`console: ${m.text().slice(0, 300)}`);
    });
    page.on("pageerror", (e) => evenements.push(`exception: ${String(e).slice(0, 300)}`));
    page.on("dialog", (d) => {
      evenements.push(`dialogue ${d.type()}: ${d.message().slice(0, 200)}`);
      d.accept().catch(() => {});
    });
  };
  contexte.on("page", brancher);
  contexte.on("response", (r) => {
    if (r.status() >= 400) evenements.push(`http ${r.status()} ${r.request().method()} ${r.url().slice(0, 200)}`);
  });
  contexte.on("requestfailed", (r) => {
    const cause = r.failure()?.errorText ?? "";
    if (!cause.includes("ERR_ABORTED")) evenements.push(`réseau: ${cause} ${r.url().slice(0, 200)}`);
  });
  const page = await contexte.newPage();
  const s = { contexte, page, evenements };
  sessions.set(nom, s);
  return s;
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

async function jouer(nom, code, options) {
  const s = await session(nom);
  // La page courante est la dernière ouverte et encore vivante.
  const vivantes = s.contexte.pages().filter((p) => !p.isClosed());
  s.page = vivantes.includes(s.page) ? s.page : vivantes.at(-1) ?? (await s.contexte.newPage());
  const aides = {
    base: BASE,
    captures: CAPTURES,
    /** Verdict d'axe sur la page courante : règles enfreintes, par gravité. */
    axe: async () => {
      const r = await new AxeBuilder({ page: s.page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      return r.violations.map((v) => ({ regle: v.id, gravite: v.impact, noeuds: v.nodes.length, aide: v.help, exemple: v.nodes[0]?.target?.join(" ") }));
    },
    /** Passe la session sur une autre page (nouvel onglet, par exemple). */
    prendre: (p) => { s.page = p; },
  };
  const sortie = { persona: nom };
  try {
    const resultat = await new AsyncFunction("page", "context", "h", code)(s.page, s.contexte, aides);
    sortie.ok = true;
    if (resultat !== undefined) sortie.resultat = resultat;
  } catch (erreur) {
    sortie.ok = false;
    sortie.erreur = String(erreur?.message ?? erreur).slice(0, 1500);
  }
  const page = s.page;
  try {
    await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
    sortie.url = page.url();
    sortie.titre = await page.title();
    numero += 1;
    const fichier = join(CAPTURES, `${String(numero).padStart(3, "0")}-${nom}-${(options.nom ?? "pas").replace(/[^a-z0-9-]/gi, "_")}.png`);
    await page.screenshot({ path: fichier, fullPage: options.entier === "1" });
    sortie.capture = fichier;
    if (options.texte !== "0") {
      const arbre = await page.locator("body").ariaSnapshot({ timeout: 5000 }).catch((e) => `(arbre illisible : ${e.message})`);
      const max = Number(options.max ?? 5000);
      sortie.ecran = arbre.length > max ? `${arbre.slice(0, max)}\n… (${arbre.length - max} caractères de plus)` : arbre;
    }
  } catch (erreur) {
    sortie.observation = String(erreur?.message ?? erreur).slice(0, 500);
  }
  sortie.evenements = s.evenements.splice(0);
  return sortie;
}

http
  .createServer(async (req, res) => {
    const adresse = new URL(req.url, "http://x");
    if (adresse.pathname === "/fin") {
      res.end("fin");
      await navigateur.close();
      process.exit(0);
    }
    let code = "";
    for await (const morceau of req) code += morceau;
    const sortie = await jouer(adresse.searchParams.get("persona") ?? "anonyme", code, Object.fromEntries(adresse.searchParams));
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify(sortie));
  })
  .listen(PORT, "127.0.0.1", () => console.log(`pilote prêt sur ${PORT}, application ${BASE}`));
