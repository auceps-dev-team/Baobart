import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  delete process.env.TEXTBEE_API_KEY;
  delete process.env.SMSGATE_USERNAME;
  delete process.env.SMSGATE_PASSWORD;
  delete process.env.SMSGATE_URL;
});

afterEach(() => {
  vi.unstubAllEnvs();
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

describe("le téléphone", () => {
  function bouton() {
    return listerFournisseurs().find((f) => f.id === "telephone");
  }

  it("s'allume avec un opérateur SMS utilisable", () => {
    process.env.SMS_DRIVER = "textbee";
    process.env.TEXTBEE_API_KEY = "cle-textbee-de-test-assez-longue";
    expect(bouton()?.actif).toBe(true);
  });

  it("s'allume avec le serveur local d'un téléphone (SMS Gateway)", () => {
    process.env.SMS_DRIVER = "smsgate";
    process.env.SMSGATE_URL = "http://192.168.1.20:8080";
    process.env.SMSGATE_USERNAME = "sms";
    process.env.SMSGATE_PASSWORD = "Ab3dE6gH";
    expect(bouton()?.actif).toBe(true);

    // Le même serveur, mais joint en clair hors du réseau local : refusé.
    process.env.SMSGATE_URL = "http://sms.exemple.com:8080";
    expect(bouton()?.actif).toBe(false);
  });

  it("reste éteint avec le pilote console en production", () => {
    // Le pilote console écrit le SMS dans le journal : en production, le code
    // de connexion y serait lisible par quiconque lit les journaux.
    process.env.SMS_DRIVER = "console";
    vi.stubEnv("NODE_ENV", "production");
    expect(bouton()?.actif).toBe(false);

    vi.stubEnv("NODE_ENV", "development");
    expect(bouton()?.actif).toBe(true);
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
