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

function routes(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return routes(chemin);
    return nom === "route.ts" ? [chemin] : [];
  });
}

describe("aucune route ne redirige vers `requete.url`", () => {
  it("ni `new URL(…, requete.url)` dans un `redirect`", () => {
    // Le garde-fou contre le retour du défaut : c'est la forme de la
    // documentation de Next, et la prochaine route l'écrira naturellement.
    // Contre-épreuve faite le 08/10 : les deux routes d'avant 1fe88b9 y
    // tombent toutes les deux.
    const racine = join(process.cwd(), "app");
    const fautives = routes(racine).filter((fichier) =>
      /redirect\(\s*new URL\([^)]*\b(?:requete|request|req)\.url/.test(
        readFileSync(fichier, "utf8"),
      ),
    );
    expect(fautives.map((f) => relative(process.cwd(), f))).toEqual([]);
  });
});
