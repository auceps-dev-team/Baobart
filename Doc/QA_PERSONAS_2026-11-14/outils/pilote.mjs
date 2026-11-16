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
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA RÉGIE : REGARDER LES PERSONAS EN DIRECT
 *
 *   QA_REGIE=1 node qa/pilote.mjs     puis ouvrir http://127.0.0.1:3499/regie
 *
 * Une seule page montre les quatre personas côte à côte, en direct : les deux
 * téléphones à gauche, les deux ordinateurs à droite. Chaque écran est à sa
 * vraie taille, simplement réduit pour tenir dans la page — les navigateurs
 * des personas, eux, ne changent pas : ce qu'on regarde est ce qui est mesuré.
 * Pour qu'on puisse suivre, ce sont les gestes qui prennent leur temps (frappe
 * caractère par caractère, pauses) : voir `qa/demo-*.js`.
 *
 * Quatre fenêtres de navigateur côte à côte avaient été essayées d'abord.
 * Mesuré le 14/11 : Chromium refuse une fenêtre de moins de 516 px de large,
 * et quatre ne tiennent pas sur un écran de 1366 px.
 */

import http from "node:http";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3400";
const PORT = Number(process.env.QA_PILOTE_PORT ?? 3499);
const CAPTURES = process.env.QA_CAPTURES ?? join(process.cwd(), "qa", "captures");
mkdirSync(CAPTURES, { recursive: true });

const REGIE = process.env.QA_REGIE === "1";
/** Les quatre écrans de la régie, dans l'ordre où ils s'affichent. */
const EN_REGIE = (process.env.QA_REGIE_PERSONAS ?? "awa,yao,serge,fatou").split(",");

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
const QUI = {
  awa: "Awa · vendeuse, Dakar · téléphone 360 × 740",
  yao: "Yao · étudiant, Accra · téléphone 390 × 780",
  serge: "Serge · agence, Abidjan · ordinateur 1440 × 900",
  fatou: "Fatou · directrice artistique, Paris · portable 1280 × 800",
};

// QA_LENTEUR_MS ralentit chaque opération du navigateur — captures de la régie
// comprises. À 0 par défaut : ce sont les gestes qui portent leurs pauses.
const navigateur = await chromium.launch(REGIE ? { slowMo: Number(process.env.QA_LENTEUR_MS ?? 0) } : {});
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
  const s = { contexte, page, evenements, image: null, vuLe: 0, enCours: "" };
  sessions.set(nom, s);
  if (REGIE) await filmer(s);
  return s;
}

/**
 * Filme la page d'une session : une capture toutes les 300 ms, tant que la
 * régie a demandé une image dans les cinq dernières secondes. La régie vient
 * chercher la dernière capture elle-même (`/image`), écran par écran.
 *
 * Deux façons plus « directes » ont été essayées d'abord, mesuré le 14/11 :
 *   - le « screencast » de Chromium : sans fenêtre, il n'envoyait d'images que
 *     pour un écran sur quatre ;
 *   - un flux d'images continu (multipart) : le navigateur n'affiche une image
 *     qu'à l'arrivée de la suivante, donc jamais pour une page immobile.
 */
async function filmer(s) {
  let cdp = null;
  let filmee = null;
  let occupe = false;
  setInterval(async () => {
    if (occupe || Date.now() - s.vuLe > 5_000 || s.page.isClosed()) return;
    occupe = true;
    try {
      // La session peut changer de page (un nouvel onglet) : on suit la page courante.
      if (filmee !== s.page) {
        cdp = await s.contexte.newCDPSession(s.page);
        filmee = s.page;
      }
      const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 60 });
      const image = Buffer.from(data, "base64");
      s.image = image;
    } catch {
      filmee = null;
    } finally {
      occupe = false;
    }
  }, 300);
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
    /** Écrit, sous l'écran du persona dans la régie, ce qu'il est en train de faire. */
    dire: (texte) => { s.enCours = String(texte).slice(0, 140); },
  };
  s.enCours = "";
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

/** La page de la régie : quatre écrans, leur légende, et ce que chacun fait. */
function pageDeRegie() {
  const ecran = (nom) => {
    const p = PROFILS[nom] ?? DEFAUT;
    return `<figure class="${p.isMobile ? "tel" : "ordi"}" style="--l:${p.viewport.width};--h:${p.viewport.height}"><img data-persona="${nom}" alt="Écran de ${nom}"><figcaption><b>${QUI[nom] ?? nom}</b><span id="etat-${nom}">en attente</span></figcaption></figure>`;
  };
  const tels = EN_REGIE.filter((n) => (PROFILS[n] ?? DEFAUT).isMobile);
  const ordis = EN_REGIE.filter((n) => !(PROFILS[n] ?? DEFAUT).isMobile);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="pinterest" content="nopin"><title>Régie QA — Baobart</title><style>
*{box-sizing:border-box}html,body{height:100%;margin:0}
body{background:#14121a;color:#eee;font:13px/1.35 system-ui,sans-serif;display:flex;gap:10px;padding:10px;overflow:hidden}
.tels{display:flex;gap:10px;flex:none}.ordis{display:flex;flex-direction:column;gap:10px;flex:1;min-width:0}
figure{margin:0;display:flex;flex-direction:column;min-height:0;min-width:0}
.tel{height:100%}.ordi{flex:1}
img{display:block;background:#2a2733;border:2px solid #3b3747;border-radius:8px;object-fit:contain;object-position:center top;min-height:0;flex:1}
.tel img{height:calc(100vh - 62px);flex:none;aspect-ratio:var(--l)/var(--h);width:auto}
.ordi img{width:100%}
figcaption{padding:4px 2px 0;display:flex;flex-direction:column;height:38px;overflow:hidden}
figcaption b{color:#ffd84a;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
figcaption span{color:#b9b4c7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
figure.actif img{border-color:#ffd84a}
</style></head><body><div class="tels">${tels.map(ecran).join("")}</div><div class="ordis">${ordis.map(ecran).join("")}</div>
<script>
// Chaque écran va chercher sa dernière image, l'affiche, puis recommence.
for (const img of document.querySelectorAll("img[data-persona]")) {
  let precedente = null;
  const suivante = async () => {
    try {
      const r = await fetch("/image?persona=" + img.dataset.persona + "&t=" + Date.now(), { cache: "no-store" });
      if (r.status === 200) {
        const url = URL.createObjectURL(await r.blob());
        img.src = url;
        if (precedente) URL.revokeObjectURL(precedente);
        precedente = url;
      }
    } catch {}
    setTimeout(suivante, 300);
  };
  suivante();
}
setInterval(async () => {
  try {
    const etats = await (await fetch("/etat")).json();
    for (const [nom, e] of Object.entries(etats)) {
      const el = document.getElementById("etat-" + nom); if (!el) continue;
      el.textContent = (e.enCours ? e.enCours + " — " : "") + e.chemin;
      el.closest("figure").classList.toggle("actif", e.actif);
    }
  } catch {}
}, 700);
</script></body></html>`;
}

let actif = "";

http
  .createServer(async (req, res) => {
    const adresse = new URL(req.url, "http://x");
    if (adresse.pathname === "/fin") {
      res.end("fin");
      await navigateur.close();
      process.exit(0);
    }
    if (adresse.pathname === "/regie") {
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(pageDeRegie());
      return;
    }
    if (adresse.pathname === "/etat") {
      const chemin = (s) => {
        try {
          const u = new URL(s.page.url());
          return u.pathname + u.search;
        } catch {
          return "";
        }
      };
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify(Object.fromEntries([...sessions].map(([nom, s]) => [nom, { enCours: s.enCours, actif: nom === actif, chemin: chemin(s) }]))));
      return;
    }
    if (adresse.pathname === "/image") {
      // La dernière capture d'un écran. La régie la redemande dès qu'elle l'a affichée.
      const s = await session(adresse.searchParams.get("persona") ?? "anonyme");
      s.vuLe = Date.now();
      if (!s.image) {
        res.writeHead(204, { "cache-control": "no-store" });
        res.end();
        return;
      }
      res.writeHead(200, { "content-type": "image/jpeg", "cache-control": "no-store" });
      res.end(s.image);
      return;
    }
    let code = "";
    for await (const morceau of req) code += morceau;
    actif = adresse.searchParams.get("persona") ?? "anonyme";
    const sortie = await jouer(actif, code, Object.fromEntries(adresse.searchParams));
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify(sortie));
  })
  .listen(PORT, "127.0.0.1", async () => {
    console.log(`pilote prêt sur ${PORT}, application ${BASE}`);
    if (REGIE) {
      // Les quatre écrans existent dès le départ, sur l'accueil : la régie a tout de suite quelque chose à montrer.
      for (const nom of EN_REGIE) {
        const s = await session(nom);
        await s.page.goto("/", { waitUntil: "domcontentloaded" }).catch(() => {});
      }
      console.log(`régie : http://127.0.0.1:${PORT}/regie`);
    }
  });
