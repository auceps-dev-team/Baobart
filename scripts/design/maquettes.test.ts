import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ECRANS, ROUTES_SANS_MAQUETTE } from "./ecrans";
import {
  docsAccueil,
  ecransAccueil,
  ecransMobile,
  lireProps,
  menuDashboard,
  poserEtat,
  sousEcransDashboard,
} from "./maquettes";

/**
 * La table des écrans confrontée à ses deux sources : le source des maquettes
 * et l'arborescence `app/`. Dans les deux sens — rien d'inventé, rien d'oublié.
 *
 * Une table d'inventaire fausse ne casse rien : elle laisse croire qu'un écran
 * est couvert, ou capture le mauvais (le Dashboard retombe en silence sur la
 * première entrée du menu). C'est ici qu'on l'attrape.
 */

const lire = (nom: string) => readFileSync(join("Baobart Design", `Baobart ${nom}.dc.html`), "utf8");
const DASHBOARD = lire("Dashboard");
const ACCUEIL = lire("Accueil");

describe("poserEtat", () => {
  const SOURCE = [
    "class X {",
    '  state = { screen: "home", openMenu: null, open: null, tick: 3 };',
    "  go() { this.setState({ screen: \"home\" }); }",
    "}",
  ].join("\n");

  it("remplace la valeur d'une clé déclarée, et seulement dans la déclaration", () => {
    const html = poserEtat(SOURCE, { screen: "jobs" });
    expect(html).toContain('state = { screen: "jobs", openMenu: null');
    expect(html).toContain('this.setState({ screen: "home" })');
  });

  it("ne confond pas `open` avec `openMenu`", () => {
    const html = poserEtat(SOURCE, { open: 1 });
    expect(html).toContain("openMenu: null, open: 1, tick: 3");
  });

  it("ajoute en tête une clé absente de la déclaration", () => {
    expect(poserEtat(SOURCE, { role: "admin" })).toContain('state = { role: "admin", screen: "home"');
  });

  it("traverse une déclaration sur plusieurs lignes", () => {
    const multi = 'class Y {\n  state = { screen: null, rail: "wave",\n    tick: 3 };\n}';
    expect(poserEtat(multi, { screen: "renew", tick: 0 })).toBe(
      'class Y {\n  state = { screen: "renew", rail: "wave",\n    tick: 0 };\n}',
    );
  });

  it("refuse une maquette sans déclaration, ou avec deux", () => {
    expect(() => poserEtat("<div></div>", { a: 1 })).toThrow("aucune déclaration");
    expect(() => poserEtat(`${SOURCE}\n${SOURCE}`, { a: 1 })).toThrow("2 déclarations");
  });

  it("pose l'état dans les vraies maquettes, sans toucher au reste", () => {
    const html = poserEtat(ACCUEIL, { screen: "jobs", open: 1 });
    expect(html).toMatch(/state = \{ screen: "jobs", openMenu: null/);
    expect(html).toMatch(/hover: null, open: 1, likes/);
    expect(html.length - ACCUEIL.length).toBe('"jobs"'.length - '"home"'.length + "1".length - "null".length);
  });
});

describe("la table des écrans, contre le source des maquettes", () => {
  const ids = ECRANS.map((e) => e.id);

  it("n'a aucun identifiant en double", () => {
    expect(ids.length).toBe(new Set(ids).size);
  });

  it("Dashboard : chaque entrée de menu et chaque sous-écran, ni plus ni moins, au bon rôle", () => {
    const attendu = new Map<string, string>();
    for (const [role, entrees] of Object.entries(menuDashboard(DASHBOARD))) {
      for (const e of entrees) attendu.set(e.cle, role);
    }
    for (const s of sousEcransDashboard(DASHBOARD)) attendu.set(s.cle, attendu.get(s.parent)!);

    const table = new Map(
      ECRANS.filter((e) => e.maquette === "Dashboard").map((e) => [String(e.etat!.key), String(e.etat!.role)]),
    );
    expect(Object.fromEntries(table)).toEqual(Object.fromEntries(attendu));
    // Compté le 14/11 : 11 + 20 + 28 entrées de menu, 9 sous-écrans (SUB_PARENT).
    expect(attendu.size).toBe(59 + 9);
  });

  it("Dashboard : chaque sous-écran pointe vers une entrée de menu existante", () => {
    const menu = new Set(Object.values(menuDashboard(DASHBOARD)).flat().map((e) => e.cle));
    expect(sousEcransDashboard(DASHBOARD).filter((s) => !menu.has(s.parent))).toEqual([]);
  });

  it("Accueil : chaque valeur de `screen` et chaque page de documentation", () => {
    const table = ECRANS.filter((e) => e.maquette === "Accueil");
    const ecrans = [...new Set(table.map((e) => String(e.etat!.screen)))].sort();
    expect(ecrans).toEqual(ecransAccueil(ACCUEIL));
    const docs = table.filter((e) => e.etat!.screen === "doc").map((e) => String(e.etat!.docKey)).sort();
    expect(docs).toEqual(docsAccueil(ACCUEIL));
  });

  it("Auth et Parcours d'achat : chaque option de la propriété d'écran", () => {
    const auth = ECRANS.filter((e) => e.maquette === "Auth").map((e) => e.etat!.mode);
    expect(auth).toEqual(lireProps(lire("Auth")).mode!.options);
    const parcours = ECRANS.filter((e) => e.maquette === "Parcours Achat").map((e) => e.etat!.screen);
    expect(parcours).toEqual(lireProps(lire("Parcours Achat")).ecran!.options);
  });

  it("Mobile : chaque écran étiqueté, dans l'ordre", () => {
    const table = ECRANS.filter((e) => e.maquette === "Mobile").map((e) => e.etiquette);
    expect(table).toEqual(ecransMobile(lire("Mobile")));
  });
});

/** Les routes de `app/`, telles que le navigateur les voit. */
function routesApp(dossier = "app", segments: string[] = []): string[] {
  const routes: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) {
      // `@slot` et `(groupe)` n'apparaissent pas dans l'adresse ; `(.)x` intercepte `x`.
      if (nom.startsWith("@") || /^\([^.)]*\)$/.test(nom)) routes.push(...routesApp(chemin, segments));
      else routes.push(...routesApp(chemin, [...segments, nom.replace(/^\(\.+\)/, "")]));
    } else if (nom === "page.tsx") {
      routes.push(`/${segments.join("/")}`);
    }
  }
  return [...new Set(routes)];
}

/** `{produit}` (table) et `[slug]` (app) deviennent le même joker. */
const forme = (route: string) => route.replace(/\{[^}]+\}|\[[^\]]+\]/g, "[]");

describe("la table des écrans, contre l'arborescence app/", () => {
  const app = routesApp();
  const formesApp = new Set(app.map(forme));
  const correspond = (route: string) =>
    formesApp.has(forme(route)) ||
    // Un segment littéral de la table peut tomber sur un segment dynamique de app/.
    app.some((r) => {
      const a = r.split("/");
      const t = route.split("/");
      return a.length === t.length && a.every((s, i) => s.startsWith("[") || s === t[i]);
    });

  it("chaque route citée existe (sauf la 404 voulue)", () => {
    const citees = [
      ...ECRANS.filter((e) => e.route && e.id !== "parcours/404").map((e) => e.route!),
      ...ROUTES_SANS_MAQUETTE.map((r) => r.route),
    ];
    expect(citees.filter((r) => !correspond(r))).toEqual([]);
  });

  it("chaque route de app/ est associée à un écran, ou déclarée sans maquette — jamais les deux", () => {
    const associees = new Set(ECRANS.filter((e) => e.route).map((e) => forme(e.route!)));
    const declarees = new Set(ROUTES_SANS_MAQUETTE.map((r) => forme(r.route)));
    expect(app.filter((r) => !associees.has(forme(r)) && !declarees.has(forme(r)))).toEqual([]);
    expect([...declarees].filter((r) => associees.has(r))).toEqual([]);
  });
});
