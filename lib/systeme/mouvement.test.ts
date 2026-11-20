import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import { ecartsCss, ecartsStylesEnLigne } from "./mouvement";

const RACINE = join(__dirname, "..", "..");

/**
 * Les originaux du labo (`components/labo/`) restent tels qu'ils ont été
 * essayés : décidé le 09/10 (en-tête « INTERACTIONS » d'app/globals.css),
 * ils servent de témoin, avec leurs mesures. Ce qui en a été promu vit dans
 * `components/anime/` et `app/globals.css`, et c'est cela qui est vérifié.
 */
function fichiers(dossier: string, extension: RegExp): string[] {
  return readdirSync(join(RACINE, dossier), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && extension.test(e.name))
    .map((e) => relative(RACINE, join(e.parentPath, e.name)).split(sep).join("/"))
    .filter((f) => !f.startsWith("components/labo/"));
}

describe("l'analyseur voit ce qu'il doit voir", () => {
  // Sans ces cas, une garde aveugle passerait au vert sans rien vérifier.
  it("trouve un survol qui déplace un élément sans filtre", () => {
    expect(ecartsCss(".a:hover { transform: translateY(-2px); }")).toHaveLength(1);
    expect(ecartsCss("a:hover > .b { box-shadow: 0 0 0 red }")).toHaveLength(1);
  });

  it("trouve un survol imbriqué dans un utilitaire", () => {
    expect(ecartsCss("@utility x { transition: transform 1s; &:hover { transform: none; } &:active { transform: scale(.9); } }")).toEqual([
      expect.objectContaining({ regle: "survol-non-filtre" }),
    ]);
  });

  it("laisse passer un survol rangé sous `hover: hover`, et un survol qui ne change que la couleur", () => {
    expect(ecartsCss("@media (hover: hover) and (pointer: fine) { .a:hover { transform: none } }")).toEqual([]);
    expect(ecartsCss("@utility x { @media (hover: hover) { &:hover { transform: none } } }")).toEqual([]);
    expect(ecartsCss(".a:hover { background: #fff; color: red }")).toEqual([]);
  });

  it("trouve `ease-in`, mais pas `ease-in-out`", () => {
    expect(ecartsCss(".a { animation: x 300ms ease-in both; }")).toEqual([expect.objectContaining({ regle: "ease-in" })]);
    expect(ecartsCss(".a { transition: transform 1s ease-in-out; }")).toEqual([]);
    expect(ecartsStylesEnLigne(`style={{ transition: "opacity .2s ease-in" }}`)).toHaveLength(1);
    expect(ecartsStylesEnLigne(`style={{ animation: "popin .16s ease-out" }}`)).toEqual([]);
  });

  it("trouve `transition: all`", () => {
    expect(ecartsCss(".a { transition: all 200ms; }")).toEqual([expect.objectContaining({ regle: "transition-all" })]);
    expect(ecartsStylesEnLigne("transition: 'all .3s'")).toHaveLength(1);
    // Un nom de propriété qui contient « all » n'en est pas un.
    expect(ecartsCss(".a { transition: opacity 1s; animation: tall 1s; }")).toEqual([]);
  });

  it("trouve une boucle sans fin écrite en ligne, que le mouvement réduit ne peut pas arrêter", () => {
    // La ligne d'origine de la carte flottante du héros, avant la revue du 20/11.
    expect(ecartsStylesEnLigne(`animation: i === 0 ? "floaty 7s ease-in-out infinite" : undefined,`)).toEqual([
      expect.objectContaining({ regle: "boucle-en-ligne" }),
    ]);
    expect(ecartsStylesEnLigne(`className="animate-spin"`)).toHaveLength(1);
    expect(ecartsStylesEnLigne(`className="animate-[floaty_6s_ease-in-out_infinite]"`)).toHaveLength(1);
    // Arrêtée sur la même ligne, ou jouée une seule fois : rien à dire.
    expect(ecartsStylesEnLigne(`className="animate-[floaty_6s_infinite] motion-reduce:animate-none"`)).toEqual([]);
    expect(ecartsStylesEnLigne(`style={{ animation: "popin .2s ease-out" }}`)).toEqual([]);
  });

  it("donne la ligne et le chemin du bloc", () => {
    const [e] = ecartsCss("/* un\n commentaire */\n.a:hover {\n  transform: none;\n}", "x.css");
    expect(e?.ou).toBe("x.css:4 .a:hover { transform }");
  });
});

describe("le mouvement de l'application suit les skills Halo", () => {
  it("app/globals.css : aucun survol non filtré, aucun `ease-in`, aucun `transition: all`", () => {
    const css = readFileSync(join(RACINE, "app", "globals.css"), "utf8");
    expect(ecartsCss(css, "app/globals.css").map((e) => `${e.regle} — ${e.ou}`)).toEqual([]);
  });

  it("les styles en ligne des composants : aucun `ease-in`, aucun `transition: all`, aucune boucle en ligne", () => {
    const sources = [...fichiers("app", /\.tsx$/), ...fichiers("components", /\.tsx$/)];
    // Le parcours trouve bien les composants : un dossier mal nommé rendrait la garde muette.
    expect(sources.length).toBeGreaterThan(100);
    const ecarts = sources.flatMap((f) => ecartsStylesEnLigne(readFileSync(join(RACINE, f), "utf8"), f));
    expect(ecarts.map((e) => `${e.regle} — ${e.ou}`)).toEqual([]);
  });

  it("les autres feuilles de style des composants : mêmes règles", () => {
    const feuilles = fichiers("components", /\.css$/);
    const ecarts = feuilles.flatMap((f) => ecartsCss(readFileSync(join(RACINE, f), "utf8"), f));
    expect(ecarts.map((e) => `${e.regle} — ${e.ou}`)).toEqual([]);
  });
});
