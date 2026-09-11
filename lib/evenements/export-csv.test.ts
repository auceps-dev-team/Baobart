/**
 * Le CSV, et ce qu'il refuse de laisser passer.
 *
 * ─────────────────────────────────────────────────────────────────
 * CE QUE CES TESTS GARDENT
 *
 *   — **l'injection de formule.** C'est le seul de ces tests qui protège
 *     quelqu'un : les noms exportés sont saisis par les inscrits, et un
 *     tableur exécute toute cellule commençant par `=`, `+`, `-` ou `@`.
 *     L'attaque ne vise pas notre serveur mais la personne qui ouvre le
 *     fichier, chez elle ;
 *   — **l'échappement RFC 4180.** Un nom qui contient un point-virgule
 *     couperait la ligne en deux, et le fichier deviendrait illisible sans
 *     qu'aucune erreur ne le dise ;
 *   — **le BOM.** Sans lui, Excel affiche « GnahorÃ© ». C'est trois octets
 *     invisibles dont tout le reste dépend.
 */

import { describe, expect, it } from "vitest";

import { cellule, nomDeFichier, versCsv } from "@/lib/evenements/export-csv";

describe("l'injection de formule", () => {
  it("neutralise une cellule qui commence par =", () => {
    // Le cas d'école : un lien cliquable dans le fichier de l'organisateur.
    const sortie = cellule('=HYPERLINK("http://malveillant.example","Clic")');
    expect(sortie.startsWith("'=") || sortie.startsWith(`"'=`)).toBe(true);
  });

  it("neutralise les quatre amorces", () => {
    for (const amorce of ["=", "+", "-", "@"]) {
      const sortie = cellule(`${amorce}SOMME(A1:A9)`);
      // L'apostrophe passe devant, que la valeur soit ensuite entourée de
      // guillemets ou non.
      expect(sortie.replace(/^"/, "").startsWith("'")).toBe(true);
    }
  });

  it("neutralise la tabulation et le retour chariot", () => {
    // Moins connus, mais reconnus comme amorces par certains tableurs.
    expect(cellule("\t=1+1").includes("'")).toBe(true);
    expect(cellule("\r=1+1").includes("'")).toBe(true);
  });

  it("laisse tranquille un nom ordinaire", () => {
    expect(cellule("Awa Diallo")).toBe("Awa Diallo");
    expect(cellule("awa@baobart.test")).toBe("awa@baobart.test");
  });

  it("ne confond pas un signe moins au milieu avec une formule", () => {
    // « Jean-Pierre » commence par une lettre : rien à neutraliser.
    expect(cellule("Jean-Pierre")).toBe("Jean-Pierre");
  });

  it("neutralise un nom qui commence vraiment par un tiret", () => {
    expect(cellule("-Awa")).toBe("'-Awa");
  });
});

describe("l'échappement", () => {
  it("entoure et double les guillemets", () => {
    expect(cellule('Awa "la wax" Diallo')).toBe('"Awa ""la wax"" Diallo"');
  });

  it("entoure une valeur qui contient le séparateur", () => {
    // Sans cela, « Abidjan; Cocody » deviendrait deux colonnes.
    expect(cellule("Abidjan; Cocody")).toBe('"Abidjan; Cocody"');
  });

  it("entoure une valeur qui contient un saut de ligne", () => {
    expect(cellule("ligne 1\nligne 2")).toBe('"ligne 1\nligne 2"');
  });

  it("rend une chaîne vide pour null et undefined", () => {
    expect(cellule(null)).toBe("");
    expect(cellule(undefined)).toBe("");
  });

  it("accepte un nombre", () => {
    expect(cellule(5000)).toBe("5000");
    expect(cellule(0)).toBe("0");
  });
});

describe("le fichier complet", () => {
  const csv = versCsv(
    ["Nom", "Adresse", "Inscrit le"],
    [
      ["Awa Diallo", "awa@baobart.test", "2026-09-11"],
      ["=cmd|'/c calc'!A1", "pirate@example", "2026-09-11"],
    ],
  );

  it("commence par le BOM — sans lui, Excel casse les accents", () => {
    expect(csv.startsWith("﻿")).toBe(true);
  });

  it("sépare par des points-virgules, pour Excel en français", () => {
    expect(csv).toContain("Nom;Adresse;Inscrit le");
  });

  it("termine ses lignes en CRLF, comme le RFC 4180", () => {
    expect(csv).toContain("\r\n");
  });

  it("neutralise la formule jusque dans le fichier assemblé", () => {
    // La vérification qui compte : l'échappement ne doit pas se perdre entre
    // `cellule` et l'assemblage.
    expect(csv).not.toMatch(/(^|;|\n)=cmd/);
    expect(csv).toContain("'=cmd");
  });

  it("porte autant de lignes que d'inscrits, plus l'en-tête", () => {
    const lignes = csv.trim().split("\r\n");
    expect(lignes).toHaveLength(3);
  });
});

describe("le nom de fichier", () => {
  it("garde le titre lisible et la date", () => {
    expect(nomDeFichier("Atelier sérigraphie", new Date("2026-09-11"))).toBe(
      "inscrits-atelier-serigraphie-2026-09-11.csv",
    );
  });

  it("retire ce qu'un système de fichiers refuse", () => {
    const nom = nomDeFichier('Wax / Futurism : "édition"', new Date("2026-09-11"));
    expect(nom).not.toMatch(/[/:"]/);
    expect(nom.endsWith(".csv")).toBe(true);
  });

  it("reste utilisable quand le titre ne donne rien", () => {
    // Un titre entièrement composé de signes : on garde un nom qui a du sens.
    expect(nomDeFichier("«»—", new Date("2026-09-11"))).toBe(
      "inscrits-evenement-2026-09-11.csv",
    );
  });
});
