import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import {
  REGISTRE,
  consentementDepuisEntete,
  dureeDesLimites,
  ecrireConsentement,
  lireConsentement,
} from "@/lib/consentement/regles";

describe("le choix du visiteur", () => {
  it("se relit tel qu'il a été écrit", () => {
    expect(lireConsentement(ecrireConsentement({ mesurePub: true }))).toEqual({ mesurePub: true });
    expect(lireConsentement(ecrireConsentement({ mesurePub: false }))).toEqual({ mesurePub: false });
  });

  it("vaut « pas encore choisi » quand il manque, est illisible ou date d'une autre version", () => {
    expect(lireConsentement(undefined)).toBeNull();
    expect(lireConsentement("oui")).toBeNull();
    // Changer le texte de la bannière redemande l'accord à tous.
    expect(lireConsentement("v0.pub-oui")).toBeNull();
    // Le premier format, abandonné : il ressortait encodé du serveur.
    expect(lireConsentement("v1.pub=1")).toBeNull();
    expect(lireConsentement("%E0%A4%A")).toBeNull();
  });

  it("se lit dans un en-tête Cookie, parmi les autres", () => {
    expect(consentementDepuisEntete(`baobart_session=abc; bb_consentement=${ecrireConsentement({ mesurePub: true })}; x=1`)).toEqual({ mesurePub: true });
    expect(consentementDepuisEntete("baobart_session=abc")).toBeNull();
    expect(consentementDepuisEntete(null)).toBeNull();
  });
});

describe("le registre des cookies", () => {
  const RACINE = process.cwd();
  const POSE_UN_COOKIE = /\.cookies\.set\(|\bmagasin\.set\(|cookies\(\)\)\.set\(|document\.cookie\s*=/;

  function fichiers(dossier: string): string[] {
    return readdirSync(dossier).flatMap((nom) => {
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) return nom === "node_modules" ? [] : fichiers(chemin);
      return /\.(ts|tsx)$/.test(nom) && !/\.test\.tsx?$/.test(nom) ? [chemin] : [];
    });
  }

  it("déclare chaque fichier qui pose un cookie", () => {
    // Une politique qui oublie un cookie dit quelque chose de faux à tous
    // ceux qui la lisent — et rien, sans ce test, ne le signalerait.
    const declares = new Set(REGISTRE.flatMap((c) => c.sources));
    const poseurs = ["app", "lib", "components"]
      .flatMap((d) => fichiers(join(RACINE, d)))
      .filter((f) => POSE_UN_COOKIE.test(readFileSync(f, "utf8")))
      .map((f) => relative(RACINE, f).replaceAll("\\", "/"));

    expect(poseurs.length).toBeGreaterThan(0);
    for (const f of poseurs) expect(declares, `${f} pose un cookie absent du registre`).toContain(f);
  });

  it("ne cite que des fichiers qui existent", () => {
    for (const c of REGISTRE) for (const s of c.sources) expect(existsSync(join(RACINE, s)), `${c.nom} → ${s}`).toBe(true);
  });

  it("dit la durée réelle des compteurs de limite", () => {
    // Deux fenêtres : de 2 × 1 min (rappels de paiement, bannières) à
    // 2 × 60 min (inscription, dépôts) — lu dans lib/securite/limites.ts.
    expect(dureeDesLimites()).toBe("De 2 minutes à 2 heures");
  });
});
