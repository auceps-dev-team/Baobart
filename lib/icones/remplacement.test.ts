import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ENTREES_RAIL, MENUS } from "@/components/shell/nav-data";
import { navigationPour } from "@/lib/dashboard/nav";
import { ICONES } from "@/lib/icones/donnees";

/**
 * Les icônes Halo ont remplacé les glyphes Unicode (14/11/2026, PR #56).
 *
 * Un cliquet : ce test ne vérifie pas seulement le remplacement d'aujourd'hui,
 * il empêche un glyphe-icône (◈, ▦, ♥, ⌸…) de revenir en douce dans un menu, une
 * carte ou un médaillon. Ce qui reste est une LISTE, avec sa raison ; y ajouter
 * un caractère est un geste visible dans un diff, pas un oubli.
 */

describe("les menus portent une icône Halo, plus un glyphe", () => {
  const entreesTableauDeBord = (["ACHETEUR", "ATELIER", "BOUTIQUE"] as const).flatMap((etape) =>
    (["MEMBER", "SUPER_ADMIN"] as const).flatMap((role) =>
      navigationPour(etape, role, { organisateur: true }).flatMap((g) => g.entrees),
    ),
  );

  it.each([
    ["tableau de bord", entreesTableauDeBord],
    ["menu du site", MENUS.flatMap((g) => g.items)],
    ["rail des familles", ENTREES_RAIL],
  ] as const)("%s : chaque entrée nomme une des 49 icônes", (_, entrees) => {
    expect(entrees.length).toBeGreaterThan(0);
    for (const e of entrees) {
      expect(Object.keys(ICONES), `${e.label}`).toContain(e.icone);
      expect(e, `${e.label}`).not.toHaveProperty("glyph");
    }
  });
});

/**
 * Ce qui reste, et pourquoi.
 *
 * Partout : de la typographie, pas des icônes — les flèches d'un lien
 * (« ← Tous les articles », « Suivantes → », « Partager ↗ »), la coche d'un
 * libellé (« Lien copié ✓ »), les triangles d'un dépliant (▸ ▾ ▼), la puce d'un
 * choix (●) ; et « ✕ », fermer ou échouer, qui n'a pas d'équivalent dans les 49.
 */
const TYPOGRAPHIE = new Set(["←", "→", "↗", "✓", "✕", "▸", "▾", "▼", "●"]);

/** Fichier par fichier : des glyphes qui relèvent d'un autre système que les icônes. */
const GARDES: Record<string, string[]> = {
  // Les mérites et statuts ont leur propre planche (Baobart Badges.dc.html).
  "lib/badges/merites.ts": ["★", "◈", "◆"],
  "lib/badges/statuts.ts": ["✓"],
  // Du texte d'objet de courriel et de notification : pas de SVG dans un objet.
  "lib/email/modeles.ts": ["★"],
  "lib/avis/service.ts": ["★"],
  // Le téléphone parmi les connexions sociales : des marques, pas des icônes
  // (les logos de marque de la livraison sont dans Baobart Design/img/brands).
  "lib/auth/providers.ts": ["☎"],
};

const GLYPHES = /[←-⇿⌀-⏿■-◿☀-➿⬀-⯿]/g;

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return /node_modules|\.next|[\\/]labo$/.test(chemin) ? [] : fichiers(chemin);
    return /\.tsx?$/.test(nom) && !/\.test\.tsx?$/.test(nom) ? [chemin.replaceAll("\\", "/")] : [];
  });
}

describe("aucun glyphe-icône hors de la liste", () => {
  it("app/, components/, lib/ : chaque symbole restant est de la typographie ou une exception nommée", () => {
    const intrus: string[] = [];
    for (const f of ["app", "components", "lib"].flatMap(fichiers)) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((ligne, i) => {
          if (/^\s*(\*|\/\/|\/\*)/.test(ligne)) return; // un commentaire peut citer un glyphe
          for (const c of ligne.match(GLYPHES) ?? []) {
            if (!TYPOGRAPHIE.has(c) && !(GARDES[f] ?? []).includes(c)) intrus.push(`${f}:${i + 1} « ${c} »`);
          }
        });
    }
    expect(intrus).toEqual([]);
  });

  it("aucune lettre seule dans une pastille : « ! », « ? », « i » sont des icônes (alert, info)", () => {
    // Trouvé à la capture du 14/11 : l'inventaire Unicode ne voyait pas les huit pastilles
    // en ASCII. Une ligne JSX qui ne contient que l'un de ces caractères EST une icône.
    const intrus = ["app", "components"]
      .flatMap(fichiers)
      .filter((f) => f.endsWith(".tsx"))
      .flatMap((f) =>
        readFileSync(f, "utf8")
          .split("\n")
          .flatMap((ligne, i) => (/^\s*[!?i]\s*\r?$/.test(ligne) ? [`${f}:${i + 1}`] : [])),
      );
    expect(intrus).toEqual([]);
  });
});
