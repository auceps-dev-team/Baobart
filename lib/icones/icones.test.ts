import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Icone } from "@/components/icones/icone";
import { ICONES } from "@/lib/icones/donnees";
import {
  CHEMIN_DONNEES,
  CHEMIN_PLANCHE,
  CHEMIN_SOURCE,
  genererModule,
} from "@/lib/icones/generation";
import { ecrireForme, lireFormes, lireSourceIcones } from "@/lib/icones/source";

/**
 * Les icônes servies sont celles de la maquette — toutes, à l'identique.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TROIS PREUVES, DE PLUS EN PLUS INDÉPENDANTES DU CODE QU'ELLES VÉRIFIENT
 *
 *   1. le fichier généré est à jour : on refait la génération et on compare ;
 *   2. la lecture ne perd rien : chaque forme, remise en texte, redonne la
 *      chaîne de la source caractère pour caractère ;
 *   3. le rendu React contient, pour chacune des 49 icônes, exactement les
 *      tracés de la source — lus dans le SVG produit, pas dans les données.
 *
 * La troisième ne passe par aucune structure intermédiaire : si la lecture,
 * la génération ou le composant perdait un attribut, elle le verrait.
 */

const lire = (chemin: string) => readFileSync(chemin, "utf8").replace(/\r\n/g, "\n");
const source = lire(CHEMIN_SOURCE);
const icones = lireSourceIcones(source);

/** React écrit `<path …></path>` ; la source écrit `<path …/>`. */
const versSyntaxeSource = (svg: string) => svg.replace(/<(path|circle|rect|ellipse)([^>]*)><\/\1>/g, "<$1$2/>");

/** Le contenu des deux groupes `<g>` du SVG rendu : l'aplat, puis le trait. */
function groupes(svg: string): [string, string] {
  const g = [...svg.matchAll(/<g [^>]*>([\s\S]*?)<\/g>/g)].map((m) => versSyntaxeSource(m[1]!));
  expect(g).toHaveLength(2);
  return [g[0]!, g[1]!];
}

describe("la source de la maquette", () => {
  it("compte 49 icônes en 7 groupes", () => {
    // La planche annonce « 48 icônes » ; sa liste et la source en ont 49.
    expect(icones).toHaveLength(49);
    const parGroupe = Object.fromEntries(
      [...new Set(icones.map((i) => i.groupe))].map((g) => [g, icones.filter((i) => i.groupe === g).length]),
    );
    expect(parGroupe).toEqual({
      Navigation: 8,
      Actions: 8,
      "Fichiers & médias": 7,
      "Paiement & commandes": 8,
      "Statuts & notifications": 7,
      "Profil & paramètres": 6,
      Analytique: 5,
    });
  });

  it("se relit sans rien perdre : chaque forme redonne la chaîne d'origine", () => {
    for (const i of icones) {
      expect(i.formes.map(ecrireForme).join(""), `${i.nom} (f)`).toBe(i.brut.f);
      expect(i.lignes.map(ecrireForme).join(""), `${i.nom} (l)`).toBe(i.brut.l);
    }
  });

  it("refuse une forme inconnue plutôt que de l'omettre", () => {
    // Deux gardes, testées chacune par son message : la seconde citerait aussi
    // « polygon » (elle recopie la chaîne), et masquerait la perte de la
    // première — relevé le 13/11 par une casse volontaire.
    expect(() => lireFormes('<path d="M0 0"/><polygon points="1 2"/>', "essai")).toThrow(
      "essai : forme <polygon> inconnue",
    );
    expect(() => lireFormes('<path d="M0 0"/> texte', "essai")).toThrow(/pas été reconnue/);
  });
});

describe("le fichier généré", () => {
  it("correspond à la maquette — sinon : pnpm icones:generer", () => {
    expect(lire(CHEMIN_DONNEES)).toBe(genererModule(source, lire(CHEMIN_PLANCHE)));
  });

  it("porte les 49 icônes, dans l'ordre de la source", () => {
    expect(Object.keys(ICONES)).toEqual(icones.map((i) => i.nom));
  });
});

describe("le composant", () => {
  it("rend, pour chaque icône, exactement les tracés de la source", () => {
    for (const i of icones) {
      const svg = renderToStaticMarkup(createElement(Icone, { nom: i.nom as keyof typeof ICONES }));
      const [aplat, trait] = groupes(svg);
      // L'aplat : les formes seules. Le trait : les formes, puis les lignes.
      expect(aplat, `${i.nom} — aplat`).toBe(i.brut.f);
      expect(trait, `${i.nom} — trait`).toBe(i.brut.f + i.brut.l);
    }
  });

  it("reprend les valeurs par défaut de `<bb-icon>` : 24 px, jaune, encre, décalage 1,6", () => {
    const svg = renderToStaticMarkup(createElement(Icone, { nom: "home" }));
    expect(svg).toContain('width="24" height="24"');
    expect(svg).toContain('transform="translate(1.6 1.6)" fill="#FFD84A" stroke="#FFD84A"');
    expect(svg).toContain('fill="none" stroke="#121212"');
  });

  it("est décorative sans titre, nommée avec", () => {
    const decorative = renderToStaticMarkup(createElement(Icone, { nom: "bell" }));
    expect(decorative).toContain('aria-hidden="true"');
    expect(decorative).not.toContain("role=");

    const nommee = renderToStaticMarkup(createElement(Icone, { nom: "bell", titre: "Notifications" }));
    expect(nommee).toContain('role="img"');
    expect(nommee).toContain('aria-label="Notifications"');
    expect(nommee).not.toContain("aria-hidden");
  });
});

describe("aucun balisage interprété", () => {
  it("ni `innerHTML` ni `dangerouslySetInnerHTML` dans le code des icônes", () => {
    // Les commentaires parlent de `innerHTML` (celui de la maquette) : on
    // cherche donc les USAGES — une propriété après un point, ou la prop React.
    const interdits = /\.(inner|outer)HTML\b|dangerouslySetInnerHTML|insertAdjacentHTML/;
    const fichiers = [
      ...readdirSync("components/icones").map((f) => join("components/icones", f)),
      ...readdirSync("lib/icones").map((f) => join("lib/icones", f)),
    ].filter((f) => !f.endsWith(".test.ts"));

    expect(fichiers.length).toBeGreaterThanOrEqual(4);
    for (const f of fichiers) {
      expect(lire(f), f).not.toMatch(interdits);
    }
  });
});
