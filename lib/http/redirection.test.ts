import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it, vi } from "vitest";

// La route du téléchargement lit la session avant tout : sans compte, elle
// redirige. Hors d'une vraie requête Next, `cookies()` lèverait.
vi.mock("@/lib/auth/session", () => ({ sessionCourante: async () => null }));

import { GET as telecharger } from "@/app/api/telechargement/[fichierId]/route";

import { locationSure, rediriger } from "./redirection";

describe("une redirection", () => {
  it("garde relatif un chemin de chez nous, et absolue une adresse https", () => {
    expect(locationSure("/connexion")).toBe("/connexion");
    expect(locationSure("/products/pack?x=1#a")).toBe("/products/pack?x=1#a");
    expect(locationSure("https://annonceur.ci/offre")).toBe("https://annonceur.ci/offre");
  });

  it("ne laisse pas un faux chemin sortir du site", () => {
    // « //ailleurs » et « /\ailleurs » : le navigateur les lit comme des adresses.
    expect(locationSure("//ailleurs.example/x")).toBe("/");
    expect(locationSure("/\\ailleurs.example")).toBe("/");
    expect(locationSure("javascript:alert(1)")).toBe("/");
    expect(locationSure("pas une adresse")).toBe("/");
  });

  it("porte la Location telle quelle, sans hôte", () => {
    const r = rediriger("/connexion", 303);
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe("/connexion");
  });
});

describe("le téléchargement sans session", () => {
  it("renvoie à la connexion par une Location relative", async () => {
    // Mesuré le 08/10 sous `next start` : c'était http://localhost:3300/connexion
    // pour une requête adressée à baobart.ci. Une requête construite ici avec
    // une URL https ne le montrait pas — d'où l'assertion sur la forme relative.
    const r = await telecharger(new Request("https://baobart.ci/api/telechargement/x"), { params: Promise.resolve({ fichierId: "x" }) });
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toBe("/connexion");
  });
});

function sources(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return sources(chemin);
    return /\.tsx?$/.test(nom) ? [chemin] : [];
  });
}

describe("aucune adresse n'est bâtie sur `requete.url`", () => {
  // `new URL(chemin, requete.url)` porte l'hôte où le serveur ÉCOUTE (voir
  // l'en-tête de `redirection.ts`). C'est la forme de la documentation de
  // Next : la prochaine route l'écrira naturellement. On cherche donc la
  // construction elle-même, à deux arguments, et non le seul
  // `redirect(new URL(…))` — la forme en deux temps (`const u = new URL(…,
  // requete.url); return NextResponse.redirect(u)`) passait la première
  // version de ce test (relecture du 08/10/2026).
  //
  // `new URL(requete.url)`, à UN argument, reste permis : c'est la lecture
  // des paramètres de la requête, sans adresse à fabriquer.
  const MOTIF = /new URL\([^;]*?,\s*(?:requete|request|req)\.url\s*\)/;

  /** Le code sans ses commentaires : un commentaire peut citer le motif pour l'expliquer. */
  function sansCommentaires(texte: string): string {
    return texte
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((ligne) => !/^\s*\/\//.test(ligne))
      .join("\n");
  }

  it("dans aucun fichier de app/", () => {
    const racine = join(process.cwd(), "app");
    const fautifs = sources(racine).filter((fichier) =>
      MOTIF.test(sansCommentaires(readFileSync(fichier, "utf8"))),
    );
    expect(fautifs.map((f) => relative(process.cwd(), f))).toEqual([]);
  });

  it.each([
    ['NextResponse.redirect(new URL("/connexion", requete.url))', true],
    ['const u = new URL("/connexion", request.url);', true],
    ["new URL(chemin(), req.url)", true],
    ['new URL(requete.url).searchParams.get("q")', false],
    ['new URL("/x", urlDuSite())', false],
  ])("le motif reconnaît « %s » : %s", (code, attendu) => {
    expect(MOTIF.test(code)).toBe(attendu);
  });
});
