/**
 * Capture chaque écran de maquette et la route qui lui répond, à 360, 768 et
 * 1440 px, et mesure ce qui se mesure. Sortie dans `captures-design/`
 * (ignoré par git) : `index.html` à ouvrir, `rapport.json` à relire.
 *
 *   pnpm build
 *   APP_URL=http://localhost:3300 pnpm exec next start -p 3300
 *   pnpm design:captures                           # tout (≈ 15 min)
 *   pnpm design:captures -- --seulement=dashboard/c_   # un sous-ensemble
 *   pnpm design:captures -- --sans-app             # les maquettes seules
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QU'IL FAIT
 *
 *   1. Les maquettes : servies depuis `Baobart Design/` par interception de
 *      requêtes, l'état de départ posé par `poserEtat` (voir `maquettes.ts`).
 *      Elles chargent React, Babel et leurs polices sur Internet : le réseau
 *      est nécessaire.
 *   2. L'application : un build de production (pas de `next dev` : son badge
 *      et sa compilation à la demande faussent capture et mesure), les
 *      comptes de `pnpm comptes:test` connectés par une session écrite en
 *      base — le procédé de `e2e/badges.spec.ts`, sans aucun mot de passe.
 *      Les sessions sont supprimées à la fin, même sur erreur.
 *   3. Les mesures, sur chaque page de l'application :
 *        - débordement horizontal (la page défile de côté) ;
 *        - cibles tactiles sous 44 px (règle de D2) et sous 24 px (WCAG 2.5.8),
 *          liens en ligne dans un texte exclus — exception de WCAG ;
 *        - champs de saisie sous 16 px (iOS zoome dessus).
 *   4. Les planches côte à côte, maquette | application, par largeur.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QU'IL NE FAIT PAS
 *
 * Il ne juge pas les écarts : il les rend visibles. La relecture écran par
 * écran se fait sur `index.html`, et s'écrit dans `Doc/DESIGN_ECARTS_2026-11.md`.
 *
 * Il ne capture jamais une page à tort : une route dont le paramètre ne se
 * résout pas dans la base (aucune commande, aucun événement…) est notée « non
 * capturée », avec la raison, plutôt que capturée sur une 404.
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";

import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

import { ECRANS, ROUTES_SANS_MAQUETTE, type Compte, type EcranMaquette } from "./ecrans";
import { poserEtat } from "./maquettes";

// ── Réglages ────────────────────────────────────────────────────────────────

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k!, v.join("=") || "oui"] as const;
  }),
);
const BASE = args.get("base") ?? "http://localhost:3300";
const SORTIE = resolve(args.get("sortie") ?? "captures-design");
const SEULEMENT = args.get("seulement");
const AVEC_APP = !args.has("sans-app");
const AVEC_MAQUETTES = !args.has("sans-maquettes");

const LARGEURS = [360, 768, 1440] as const;
type Largeur = (typeof LARGEURS)[number];
const HAUTEUR: Record<Largeur, number> = { 360: 780, 768: 1024, 1440: 900 };
/** Au-delà, une capture pleine page est coupée sur la planche (pas sur le fichier). */
const HAUTEUR_MAX_PLANCHE = 5000;

const DOSSIER_MAQUETTES = resolve("Baobart Design");
const ORIGINE_MAQUETTES = "http://maquettes.baobart.invalid";
const FICHIER_MAQUETTE: Record<EcranMaquette["maquette"], string> = {
  Accueil: "Baobart Accueil.dc.html",
  Auth: "Baobart Auth.dc.html",
  "Parcours Achat": "Baobart Parcours Achat.dc.html",
  Dashboard: "Baobart Dashboard.dc.html",
  Mobile: "Baobart Mobile.dc.html",
  Badges: "Baobart Badges.dc.html",
};
const EMAILS: Record<Compte, string> = {
  client: "client@baobart.test",
  createur: "createur@baobart.test",
  admin: "admin@baobart.test",
  agence: "agence@baobart.test",
};
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".jsx": "text/plain; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".woff2": "font/woff2",
};

/**
 * `tsx` compile en gardant les noms de fonctions, et enveloppe certaines dans
 * `__name(…)`. Une fonction envoyée à `page.evaluate` emporte l'appel, pas la
 * définition : « ReferenceError: __name is not defined » (mesuré le 14/11).
 */
const NOMMER = { content: "window.__name = (f) => f;" };

/** Animations et transitions figées, curseur caché : deux captures du même écran sont identiques. */
const FIGER =
  "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;" +
  "transition:none!important;caret-color:transparent!important}";

// ── Types du rapport ────────────────────────────────────────────────────────

interface Mesures {
  debordement: number;
  fautifs: string[];
  cibles: number;
  sous44: number;
  sous24: number;
  exemplesSous44: string[];
  champs: number;
  champsSous16: number;
  exemplesChamps: string[];
  titre: string;
  h1: string | null;
}

interface CaptureApp {
  largeur: Largeur;
  fichier?: string;
  statut?: number;
  urlFinale?: string;
  redirige?: boolean;
  mesures?: Mesures;
  erreur?: string;
}

interface Ligne {
  id: string;
  maquette: EcranMaquette["maquette"] | null;
  libelle: string;
  route: string | null;
  url: string | null;
  compte: Compte | null;
  note?: string;
  nonCapture?: string;
  maquettes: { largeur: Largeur; fichier?: string; empreinte?: string; erreur?: string }[];
  app: CaptureApp[];
  planches: { largeur: Largeur; fichier: string }[];
  doublons?: string[];
}

// ── Maquettes ───────────────────────────────────────────────────────────────

async function servirMaquettes(page: Page, html: string, etat?: Record<string, string | number>) {
  const cible = join(DOSSIER_MAQUETTES, html);
  await page.route(`${ORIGINE_MAQUETTES}/**`, async (route) => {
    const chemin = resolve(DOSSIER_MAQUETTES, "." + decodeURIComponent(new URL(route.request().url()).pathname));
    if (!chemin.startsWith(DOSSIER_MAQUETTES + sep) || !existsSync(chemin)) {
      await route.fulfill({ status: 404, body: "" });
      return;
    }
    const brut = readFileSync(chemin);
    const corps = chemin === cible && etat ? poserEtat(brut.toString("utf8"), etat) : brut;
    await route.fulfill({ status: 200, body: corps, contentType: TYPES[extname(chemin).toLowerCase()] ?? "application/octet-stream" });
  });
  return `${ORIGINE_MAQUETTES}/${encodeURIComponent(html)}`;
}

/** Attend que la maquette ait fini de se dessiner : réseau calme, polices prêtes, plus rien ne bouge. */
async function attendreRendu(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  let avant = -1;
  for (let i = 0; i < 20; i++) {
    const n = await page.evaluate(() => document.body.innerHTML.length);
    if (n === avant && n > 2000) return;
    avant = n;
    await page.waitForTimeout(250);
  }
}

/**
 * Agrandit la fenêtre jusqu'à ce que le plus long bloc défilant tienne en entier.
 *
 * Le tableau de bord est une coque haute d'un écran dont seule la colonne
 * centrale défile : une capture « pleine page » s'y arrête au premier écran
 * (mesuré le 14/11 : 1440 × 900 pile pour la maquette Dashboard). Grandir la
 * fenêtre fait grandir la coque avec elle, et tout le contenu apparaît.
 */
async function deplier(page: Page, largeur: Largeur) {
  const hauteur = await page.evaluate(() => {
    let max = document.documentElement.scrollHeight;
    for (const el of document.querySelectorAll("*")) {
      const s = getComputedStyle(el);
      if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 4) {
        const r = el.getBoundingClientRect();
        // Ce qui est sous le bloc (pied de coque) reste sous lui une fois déplié.
        const dessous = Math.max(0, window.innerHeight - r.bottom);
        max = Math.max(max, r.top + window.scrollY + el.scrollHeight + dessous);
      }
    }
    return Math.ceil(max);
  });
  if (hauteur > HAUTEUR[largeur]) {
    await page.setViewportSize({ width: largeur, height: Math.min(hauteur, 20_000) });
    await page.waitForTimeout(300);
  }
}

async function capturerMaquette(contexte: BrowserContext, e: EcranMaquette, largeur: Largeur, fichier: string) {
  const page = await contexte.newPage();
  try {
    const url = await servirMaquettes(page, FICHIER_MAQUETTE[e.maquette], e.etat);
    await page.goto(url, { waitUntil: "load", timeout: 60_000 });
    await attendreRendu(page);
    await page.addStyleTag({ content: FIGER });
    if (e.etiquette) {
      // Mobile : l'écran étiqueté, cadre compris — toutes les étiquettes sont sur la même page.
      const cadre = page.locator(`[data-screen-label="${e.etiquette}"]`);
      await cadre.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await cadre.screenshot({ path: fichier });
    } else {
      await deplier(page, largeur);
      await page.screenshot({ path: fichier, fullPage: true });
    }
  } finally {
    await page.close();
  }
}

// ── Application ─────────────────────────────────────────────────────────────

/** Résout les segments `{…}` d'une route dans la base de développement. */
async function resoudreParametres(db: PrismaClient, ids: Record<Compte, string>) {
  const premier = async (sql: string, ...valeurs: unknown[]): Promise<string | null> => {
    try {
      const lignes = await db.$queryRawUnsafe<{ v: string }[]>(sql, ...valeurs);
      return lignes[0]?.v ?? null;
    } catch (err) {
      return `!${(err as Error).message.split("\n").pop()}`;
    }
  };
  const p: Record<string, string | null> = {
    produit: await premier(`select slug as v from "Product" where status = 'PUBLISHED' order by "createdAt" limit 1`),
    produitCreateur: await premier(`select id as v from "Product" where "sellerId" = $1 order by "createdAt" limit 1`, ids.createur),
    createur: await premier(`select username as v from "Profile" where "userId" = $1`, ids.createur),
    service: await premier(`select id as v from "ServiceOffer" limit 1`),
    job: await premier(`select id as v from "JobPosting" limit 1`),
    jobAgence: await premier(`select id as v from "JobPosting" where "recruiterId" = $1 limit 1`, ids.agence),
    commande: await premier(`select id as v from "Order" limit 1`),
    abonnement: await premier(`select id as v from "Subscription" where "userId" = $1 limit 1`, ids.agence),
    paiementAbonnement: await premier(`select id as v from "SubscriptionPayment" limit 1`),
    evenement: await premier(`select id as v from "Event" limit 1`),
    evenementPublic: await premier(`select id as v from "Event" limit 1`),
    publicite: await premier(`select id as v from "Ad" limit 1`),
    blog: await premier(`select slug as v from "BlogPost" limit 1`),
    articleAdmin: await premier(`select id as v from "BlogPost" limit 1`),
    communaute: await premier(`select slug as v from "Community" limit 1`),
    collection: null,
    jetonValide: null,
    jetonPerime: null,
  };
  return p;
}

function construireUrl(route: string, p: Record<string, string | null>): { url: string } | { raison: string } {
  let manque: string | null = null;
  const chemin = route.replace(/\{(\w+)\}/g, (_, nom: string) => {
    const v = p[nom];
    if (v == null) manque ??= `aucune donnée de démonstration pour {${nom}}`;
    else if (v.startsWith("!")) manque ??= `requête {${nom}} en échec : ${v.slice(1)}`;
    return v ?? "";
  });
  return manque ? { raison: manque } : { url: BASE + chemin };
}

async function ouvrirSessions(db: PrismaClient) {
  const sessions: string[] = [];
  const jetons = {} as Record<Compte, string>;
  const ids = {} as Record<Compte, string>;
  for (const [compte, email] of Object.entries(EMAILS) as [Compte, string][]) {
    const u = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (!u) throw new Error(`Compte ${email} absent : lancer « pnpm comptes:test » d'abord.`);
    const jeton = randomBytes(32).toString("base64url");
    const s = await db.session.create({
      data: { userId: u.id, token: createHash("sha256").update(jeton).digest("hex"), expiresAt: new Date(Date.now() + 3 * 3_600_000) },
      select: { id: true },
    });
    sessions.push(s.id);
    jetons[compte] = jeton;
    ids[compte] = u.id;
  }
  return { sessions, jetons, ids };
}

/** Fait défiler la page pour déclencher les images paresseuses, puis remonte. */
async function defiler(page: Page) {
  await page.evaluate(async () => {
    const pas = window.innerHeight;
    for (let y = 0; y < document.documentElement.scrollHeight; y += pas) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

function mesurer(): Mesures {
  const vw = window.innerWidth;
  const decrire = (el: Element) => {
    const r = el.getBoundingClientRect();
    const texte = (el.textContent ?? el.getAttribute("aria-label") ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
    const classe = typeof el.className === "string" ? el.className.split(" ")[0] : "";
    return `${el.tagName.toLowerCase()}${classe ? "." + classe : ""} « ${texte} » ${Math.round(r.width)}×${Math.round(r.height)}`;
  };
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
  };
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
  const cibles = [
    ...document.querySelectorAll("a[href], button, [role=button], input:not([type=hidden]), select, textarea, summary"),
  ].filter(visible);
  // Exception WCAG 2.5.8 : un lien dans une phrase n'est pas une cible isolée.
  const enLigne = (el: Element) => getComputedStyle(el).display === "inline" && !!el.parentElement?.closest("p, li, td, dd, label");
  const sous44 = cibles.filter((el) => {
    const r = el.getBoundingClientRect();
    return !enLigne(el) && (r.width < 44 || r.height < 44);
  });
  const sous24 = sous44.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width < 24 || r.height < 24;
  });
  const champs = [
    ...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea"),
  ].filter(visible);
  const champsSous16 = champs.filter((el) => Number.parseFloat(getComputedStyle(el).fontSize) < 16);
  return {
    debordement,
    fautifs,
    cibles: cibles.length,
    sous44: sous44.length,
    sous24: sous24.length,
    exemplesSous44: sous44.slice(0, 5).map(decrire),
    champs: champs.length,
    champsSous16: champsSous16.length,
    exemplesChamps: champsSous16.slice(0, 3).map(decrire),
    titre: document.title,
    h1: document.querySelector("h1")?.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ?? null,
  };
}

async function capturerApp(
  contexte: BrowserContext,
  url: string,
  largeur: Largeur,
  fichier: string,
): Promise<Omit<CaptureApp, "largeur">> {
  const page = await contexte.newPage();
  try {
    const reponse = await page.goto(url, { waitUntil: "load", timeout: 90_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.addStyleTag({ content: FIGER });
    await defiler(page);
    await page.evaluate(() => document.fonts.ready);
    // Mesurée à la taille d'écran réelle, AVANT le dépliage.
    const mesures = await page.evaluate(mesurer);
    await deplier(page, largeur);
    await page.screenshot({ path: fichier, fullPage: true });
    const finale = page.url();
    return { fichier, statut: reponse?.status() ?? 0, urlFinale: finale, redirige: new URL(finale).pathname !== new URL(url).pathname, mesures };
  } finally {
    await page.close();
  }
}

// ── Planches ────────────────────────────────────────────────────────────────

/** Maquette | application, côte à côte, à la même largeur d'affichage. */
async function planche(gauche: string | undefined, droite: string | undefined, largeur: Largeur, sortie: string) {
  const colonne = largeur === 1440 ? 720 : largeur === 768 ? 512 : 360;
  const preparer = async (f: string | undefined) => {
    if (!f || !existsSync(f)) {
      return sharp({ create: { width: colonne, height: 200, channels: 3, background: "#DCDCDC" } }).png().toBuffer();
    }
    const img = sharp(f).resize({ width: colonne });
    const { data, info } = await img.png().toBuffer({ resolveWithObject: true });
    return info.height > HAUTEUR_MAX_PLANCHE
      ? sharp(data).extract({ left: 0, top: 0, width: info.width, height: HAUTEUR_MAX_PLANCHE }).png().toBuffer()
      : data;
  };
  const [g, d] = await Promise.all([preparer(gauche), preparer(droite)]);
  const [mg, md] = await Promise.all([sharp(g).metadata(), sharp(d).metadata()]);
  const espace = 24;
  await sharp({
    create: { width: colonne * 2 + espace, height: Math.max(mg.height!, md.height!), channels: 3, background: "#121212" },
  })
    .composite([
      { input: g, left: 0, top: 0 },
      { input: d, left: colonne + espace, top: 0 },
    ])
    .jpeg({ quality: 72 })
    .toFile(sortie);
}

// ── Rapport ─────────────────────────────────────────────────────────────────

const echapper = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function ecrireIndex(lignes: Ligne[], date: string) {
  const rel = (f?: string) => (f ? f.slice(SORTIE.length + 1).replaceAll("\\", "/") : "");
  const mesure = (a: CaptureApp) => {
    if (a.erreur) return `<span class="ko">erreur : ${echapper(a.erreur)}</span>`;
    const m = a.mesures!;
    const parts = [
      `HTTP ${a.statut}${a.redirige ? ` → ${echapper(new URL(a.urlFinale!).pathname)}` : ""}`,
      m.debordement > 0 ? `<span class="ko">déborde de ${m.debordement} px</span>` : "ne déborde pas",
      `${m.sous44}/${m.cibles} cibles &lt; 44 px (${m.sous24} &lt; 24)`,
      m.champs ? `${m.champsSous16}/${m.champs} champs &lt; 16 px` : "aucun champ",
    ];
    return parts.join(" · ");
  };
  const corps = lignes
    .map((l) => {
      const tetes = `<h3 id="${echapper(l.id)}">${echapper(l.maquette ?? "Sans maquette")} · ${echapper(l.libelle)}</h3>
<p class="meta">${echapper(l.id)} — ${l.route ? `<code>${echapper(l.route)}</code>` : "<b>absente de l'application</b>"}${l.compte ? ` — connecté : ${l.compte}` : ""}${l.note ? `<br>${echapper(l.note)}` : ""}${l.nonCapture ? `<br><span class="ko">non capturée : ${echapper(l.nonCapture)}</span>` : ""}${l.doublons?.length ? `<br><span class="ko">capture de maquette identique à : ${l.doublons.map(echapper).join(", ")}</span>` : ""}</p>`;
      const parLargeur = LARGEURS.map((w) => {
        const p = l.planches.find((x) => x.largeur === w);
        const a = l.app.find((x) => x.largeur === w);
        if (!p && !a) return "";
        return `<figure><figcaption>${w} px${a ? ` — ${mesure(a)}` : ""}</figcaption>${p ? `<a href="${rel(p.fichier)}"><img loading="lazy" src="${rel(p.fichier)}" alt=""></a>` : ""}</figure>`;
      }).join("");
      return `<section>${tetes}${parLargeur}</section>`;
    })
    .join("\n");
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Écarts maquettes ↔ écrans — ${date}</title>
<style>body{font:14px/1.45 system-ui,sans-serif;margin:24px;background:#f6f3fb;color:#121212}h3{margin:32px 0 4px}.meta{color:#444;margin:0 0 8px}
figure{margin:8px 0 16px}figcaption{font-size:12px;margin-bottom:4px}img{max-width:100%;border:1px solid #121212}.ko{color:#b3261e;font-weight:600}code{background:#fff;padding:1px 4px}</style></head>
<body><h1>Écarts maquettes ↔ écrans</h1><p>Capturé le ${date}. À gauche la maquette, à droite l'application. ${lignes.length} lignes.</p>${corps}</body></html>`;
  writeFileSync(join(SORTIE, "index.html"), html);
}

// ── Déroulé ─────────────────────────────────────────────────────────────────

async function main() {
  const date = new Date().toISOString().slice(0, 16).replace("T", " ");
  for (const d of ["maquettes", "app", "planches"]) mkdirSync(join(SORTIE, d), { recursive: true });
  const nomFichier = (id: string) => id.replace(/[^\w-]+/g, "_");

  const toutes: Ligne[] = [
    ...ECRANS.map<Ligne>((e) => ({
      id: e.id,
      maquette: e.maquette,
      libelle: e.libelle,
      route: e.route,
      url: null,
      compte: e.compte ?? null,
      note: e.note,
      maquettes: [],
      app: [],
      planches: [],
    })),
    ...ROUTES_SANS_MAQUETTE.map<Ligne>((r) => ({
      id: `app${r.route}`,
      maquette: null,
      libelle: r.route,
      route: r.route,
      url: null,
      compte: r.compte ?? null,
      note: r.note,
      maquettes: [],
      app: [],
      planches: [],
    })),
  ];
  const lignes = toutes.filter((l) => !SEULEMENT || l.id.includes(SEULEMENT));

  const navigateur = await chromium.launch();
  const db = new PrismaClient();
  let sessions: string[] = [];
  try {
    // 1. Maquettes
    if (AVEC_MAQUETTES) {
      // Un contexte par largeur : React, ReactDOM et Babel (≈ 3 Mo) restent en cache d'un écran à l'autre.
      const contextes = new Map<Largeur, BrowserContext>();
      const contexteMaquette = async (w: Largeur) => {
        let c = contextes.get(w);
        if (!c) {
          c = await navigateur.newContext({ viewport: { width: w, height: HAUTEUR[w] }, reducedMotion: "reduce" });
          await c.addInitScript(NOMMER);
          contextes.set(w, c);
        }
        return c;
      };
      for (const l of lignes) {
        const e = ECRANS.find((x) => x.id === l.id);
        if (!e) continue;
        // Mobile : un cadre fixe de 380 px, une seule capture. Les autres : les trois largeurs.
        const largeurs: readonly Largeur[] = e.maquette === "Mobile" ? [360] : LARGEURS;
        for (const w of largeurs) {
          const fichier = join(SORTIE, "maquettes", `${nomFichier(e.id)}@${w}.png`);
          try {
            await capturerMaquette(await contexteMaquette(w), e, w, fichier);
            const empreinte = createHash("sha256").update(readFileSync(fichier)).digest("hex").slice(0, 16);
            l.maquettes.push({ largeur: w, fichier, empreinte });
          } catch (err) {
            l.maquettes.push({ largeur: w, erreur: (err as Error).message.split("\n")[0] });
          }
          process.stdout.write(".");
        }
      }
      for (const c of contextes.values()) await c.close();
      console.log(`\nmaquettes : ${lignes.reduce((n, l) => n + l.maquettes.filter((m) => m.fichier).length, 0)} captures`);
    }

    // 2. Application
    if (AVEC_APP) {
      const sante = await fetch(BASE).catch(() => null);
      if (!sante) throw new Error(`Aucun serveur sur ${BASE} : « pnpm build » puis « pnpm exec next start -p 3300 ».`);
      const ouvertes = await ouvrirSessions(db);
      sessions = ouvertes.sessions;
      const parametres = await resoudreParametres(db, ouvertes.ids);
      const contextes = new Map<string, BrowserContext>();
      const contexte = async (compte: Compte | null, w: Largeur) => {
        const cle = `${compte ?? "visiteur"}@${w}`;
        let c = contextes.get(cle);
        if (!c) {
          c = await navigateur.newContext({
            viewport: { width: w, height: HAUTEUR[w] },
            // 360 et 768 : un écran tactile, pour que `pointer: coarse` s'applique comme sur un téléphone.
            isMobile: w !== 1440,
            hasTouch: w !== 1440,
            reducedMotion: "reduce",
            locale: "fr-FR",
          });
          await c.addInitScript(NOMMER);
          // Un visiteur qui a déjà répondu (« refuser », le choix neutre) : sans lui, la
          // bannière des cookies couvre le bas de chaque capture. Voir lib/consentement/regles.ts.
          await c.addCookies([{ name: "bb_consentement", value: "v1.pub-non", url: BASE }]);
          if (compte) await c.addCookies([{ name: "baobart_session", value: ouvertes.jetons[compte], url: BASE }]);
          contextes.set(cle, c);
        }
        return c;
      };
      for (const l of lignes) {
        if (!l.route) continue;
        const u = construireUrl(l.route, parametres);
        if ("raison" in u) {
          l.nonCapture = u.raison;
          continue;
        }
        l.url = u.url;
        for (const w of LARGEURS) {
          const fichier = join(SORTIE, "app", `${nomFichier(l.id)}@${w}.png`);
          try {
            l.app.push({ largeur: w, ...(await capturerApp(await contexte(l.compte, w), u.url, w, fichier)) });
          } catch (err) {
            l.app.push({ largeur: w, erreur: (err as Error).message.split("\n")[0] });
          }
          process.stdout.write(".");
        }
      }
      for (const c of contextes.values()) await c.close();
      console.log(`\napplication : ${lignes.reduce((n, l) => n + l.app.filter((a) => a.fichier).length, 0)} captures`);
    }

    // 3. Planches
    for (const l of lignes) {
      for (const w of LARGEURS) {
        const m = l.maquettes.find((x) => x.largeur === w)?.fichier;
        const a = l.app.find((x) => x.largeur === w)?.fichier;
        if (!m && !a) continue;
        const fichier = join(SORTIE, "planches", `${nomFichier(l.id)}@${w}.jpg`);
        await planche(m, a, w, fichier);
        l.planches.push({ largeur: w, fichier });
      }
    }

    // Un passage partiel (--seulement) se fond dans le rapport existant au lieu de l'écraser ;
    // les lignes qui ne sont plus dans la table (écran renommé, route déplacée) en sortent.
    let finales = lignes;
    const cheminRapport = join(SORTIE, "rapport.json");
    if (SEULEMENT && existsSync(cheminRapport)) {
      const ancien = JSON.parse(readFileSync(cheminRapport, "utf8")) as { lignes: Ligne[] };
      const ordre = new Map(toutes.map((l, i) => [l.id, i]));
      const refaites = new Set(lignes.map((l) => l.id));
      finales = [...ancien.lignes.filter((l) => ordre.has(l.id) && !refaites.has(l.id)), ...lignes].sort(
        (a, b) => ordre.get(a.id)! - ordre.get(b.id)!,
      );
    }

    // Garde contre le repli silencieux : deux écrans différents, une même image de maquette.
    for (const l of finales) {
      l.doublons = undefined;
      for (const m of l.maquettes) {
        if (!m.empreinte) continue;
        const memes = finales.filter(
          (o) => o.id !== l.id && o.maquettes.some((x) => x.largeur === m.largeur && x.empreinte === m.empreinte),
        );
        if (memes.length) l.doublons = [...new Set([...(l.doublons ?? []), ...memes.map((o) => `${o.id}@${m.largeur}`)])];
      }
    }

    writeFileSync(cheminRapport, JSON.stringify({ date, base: BASE, lignes: finales }, null, 2));
    ecrireIndex(finales, date);
    console.log(`→ ${join(SORTIE, "index.html")}`);
  } finally {
    if (sessions.length) await db.session.deleteMany({ where: { id: { in: sessions } } });
    await db.$disconnect();
    await navigateur.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
