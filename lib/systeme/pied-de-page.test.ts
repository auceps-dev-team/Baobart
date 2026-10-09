import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Chaque page publique porte le pied de page.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI UN TEST POUR ÇA
 *
 * Relevé le 04/10 : sur trente-deux pages publiques, deux seulement le
 * rendaient — l'accueil et la fiche ressource. Les autres avaient été écrites
 * une à une, et chacune avait oublié la même chose. Le pied de page de la
 * maquette (« Baobart Accueil.dc.html », bloc FOOTER) est hors de tout écran :
 * il paraît sur toutes les pages de ce document.
 *
 * Il est posé page par page plutôt que dans le layout racine : une fiche
 * ouverte en fenêtre par-dessus Explorer change l'adresse sans démonter la
 * page du dessous, et un pied de page de layout s'afficherait alors deux fois.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUI N'EN A PAS, ET POURQUOI
 *
 * Le tableau de bord (sa maquette n'en a pas), les fenêtres (`@modal`), les
 * pages de connexion (« Baobart Auth.dc.html » n'en a pas) et le tunnel
 * d'achat (« Baobart Parcours Achat.dc.html » non plus : rien ne doit
 * détourner de payer).
 *
 * Les labos (`app/labo/`) non plus : ce ne sont pas des pages publiques. Ils
 * répondent 404 en production (`notFound()` sous NODE_ENV=production), ne
 * sont liés de nulle part et sont exclus de l'indexation. Ajouté le 09/10 :
 * ce test échouait depuis la création du premier labo (v1.80.2), qui n'avait
 * pas été suivie d'un passage de la suite.
 */

const RACINE = join(process.cwd(), "app");

const SANS_PIED = [
  /^dashboard\//,
  /^@modal\//,
  /^(connexion|inscription|mot-de-passe-oublie|reinitialiser)\b/,
  /^(acheter|achat|abonnement)\//,
  /^labo\//,
];

function pages(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return pages(chemin);
    return nom === "page.tsx" ? [relative(RACINE, chemin).replaceAll("\\", "/")] : [];
  });
}

describe("le pied de page", () => {
  it("paraît sur toutes les pages publiques", () => {
    const publiques = pages(RACINE).filter((p) => !SANS_PIED.some((r) => r.test(p)));
    expect(publiques.length).toBeGreaterThan(20);

    // `PageDocument` (components/doc/page-document.tsx) pose le pied de page
    // lui-même : les pages d'information passent par lui.
    expect(readFileSync(join(RACINE, "..", "components", "doc", "page-document.tsx"), "utf8")).toMatch(/<Footer \/>/);
    const sans = publiques.filter((p) => !/<Footer|<PageDocument/.test(readFileSync(join(RACINE, p), "utf8")));
    expect(sans, "pages publiques sans <Footer />").toEqual([]);
  });
});
