import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  POUR_TESTS,
  etatDesFournisseurs,
  listerFournisseurs,
} from "@/lib/auth/providers";

const { FOURNISSEURS } = POUR_TESTS;

/** Là où le bouton d'un fournisseur actif envoie la personne. */
const DOSSIER = join("app", "api", "auth");

function routeDe(id: string): string {
  return join(DOSSIER, id, "route.ts");
}

const AVANT = { ...process.env };

beforeEach(() => {
  for (const f of FOURNISSEURS) {
    for (const v of f.variables) delete process.env[v];
  }
});

afterEach(() => {
  process.env = { ...AVANT };
});

describe("un fournisseur configuré", () => {
  it("n'est pas actif tant qu'aucune route ne le reçoit", () => {
    // Le cas qui menait à une 404 jusqu'au 08/10/2026 : les variables de
    // Google posées, et un bouton cliquable vers `/api/auth/google`.
    process.env.AUTH_GOOGLE_ID = "id-de-test";
    process.env.AUTH_GOOGLE_SECRET = "secret-de-test";

    const etat = etatDesFournisseurs().find((f) => f.id === "google");
    expect(etat).toMatchObject({ configure: true, branche: false });

    const bouton = listerFournisseurs().find((f) => f.id === "google");
    expect(bouton?.actif).toBe(false);
  });

  it("n'est pas actif non plus sans ses variables", () => {
    expect(listerFournisseurs().every((f) => !f.actif)).toBe(true);
    expect(etatDesFournisseurs().every((f) => !f.configure)).toBe(true);
  });
});

describe("« branché » et le dossier app/api/auth", () => {
  // ──────────────────────────────────────────────────────────────────────────
  // POURQUOI LES DEUX SENS
  //
  // Branché sans route : le bouton s'allume et mène à une 404 — le défaut
  // d'origine. Route sans « branché » : le flux existe, et le bouton reste
  // « Bientôt disponible » pour toujours. Aucun des deux ne se voit dans un
  // diff, le fichier de route et ce registre vivant dans des dossiers
  // différents.
  it.each(FOURNISSEURS.map((f) => [f.id, f.branche] as const))(
    "%s : déclaré branché si et seulement si sa route existe",
    (id, branche) => {
      expect(branche).toBe(existsSync(routeDe(id)));
    },
  );

  it("aucune route n'existe pour un fournisseur inconnu du registre", () => {
    const connus = new Set(FOURNISSEURS.map((f) => f.id));
    const routes = existsSync(DOSSIER)
      ? readdirSync(DOSSIER, { withFileTypes: true })
          .filter((d) => d.isDirectory() && existsSync(routeDe(d.name)))
          .map((d) => d.name)
      : [];

    expect(routes.filter((r) => !connus.has(r))).toEqual([]);
  });
});
