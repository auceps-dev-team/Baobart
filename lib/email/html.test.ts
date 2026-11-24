import { describe, expect, it } from "vitest";

import { echapper, originesSures, versHtml } from "./html";

/**
 * Le convertisseur texte → HTML des courriels (Q-28), pris seul. Ce que les
 * modèles en font — la charge piégée sur chacun, la parité avec le texte — est
 * éprouvé dans `modeles.test.ts`.
 */

const SITE = "https://baobart.test";
const corps = (html: string) => html.slice(html.indexOf('<div style="background:#FFFFFF'));

describe("echapper", () => {
  it("rend inoffensifs les cinq caractères qui comptent, entre balises comme dans un attribut", () => {
    expect(echapper(`<a href="x" title='y'>&</a>`)).toBe("&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
  });
});

describe("originesSures", () => {
  it("garde les origines http(s), écarte le reste", () => {
    expect([...originesSures([`${SITE}/a`, "https://media.baobart.test/x", "javascript:alert(1)", "data:text/html,x", "pas une adresse"])]).toEqual([
      SITE,
      "https://media.baobart.test",
    ]);
  });
});

describe("versHtml", () => {
  it("un lien sûr devient cliquable, sans la ponctuation qui le suit", () => {
    const html = corps(versHtml(`Ta vitrine (${SITE}/@awa). Ou ${SITE}/explore, au choix.`, { sujet: "s", liens: [SITE] }));
    expect(html).toContain(`(<a href="${SITE}/@awa"`);
    expect(html).toContain(`</a>). Ou <a href="${SITE}/explore"`);
    expect(html).toContain("</a>, au choix.");
  });

  it("le `&` d'une adresse est échappé dans l'attribut comme dans le texte du lien", () => {
    const html = corps(versHtml(`${SITE}/x?a=1&b=2`, { sujet: "s", liens: [SITE] }));
    expect(html).toContain(`<a href="${SITE}/x?a=1&amp;b=2"`);
    expect(html).toContain(`>${SITE}/x?a=1&amp;b=2</a>`);
  });

  it("une adresse d'une autre origine, ou en http(s) sans champ « lien », reste du texte", () => {
    expect(corps(versHtml(`${SITE}/a et https://ailleurs.test/b`, { sujet: "s", liens: [SITE] }))).not.toContain('href="https://ailleurs');
    expect(corps(versHtml(`${SITE}/a`, { sujet: "s", liens: [] }))).not.toContain("<a ");
  });

  it("paragraphes, lignes, valeurs mises en avant, filets", () => {
    const html = corps(versHtml("Bonjour,\n\nLigne un\nLigne deux\n\n  4 500 F\n  Pack\n\n———\n\n—\nPied", { sujet: "s", liens: [] }));
    expect(html).toContain('<p style="margin:0 0 14px;">Bonjour,</p>');
    expect(html).toContain("Ligne un<br>Ligne deux</p>");
    expect(html).toMatch(/font-weight:700;">4 500 F<br>Pack<\/p>/); // l'encadré, retrait ôté
    expect(html.match(/<hr /g)).toHaveLength(2); // « ——— » seul, et « — » en tête du pied
    expect(html).toContain("Pied</p>");
  });

  it("une page en français, titrée par le sujet échappé, sans rien d'extérieur", () => {
    const html = versHtml("x", { sujet: "Ton achat : <Pack>", liens: [] });
    expect(html.startsWith("<!doctype html>\n<html lang=\"fr\">")).toBe(true);
    expect(html).toContain("<title>Ton achat : &lt;Pack&gt;</title>");
    for (const interdit of ["<img", "<script", "<link", "src=", "url("]) expect(html).not.toContain(interdit);
  });
});
