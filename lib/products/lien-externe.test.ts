import { describe, expect, it } from "vitest";

import { hoteAffiche, hoteDuLien, LIEN_MAX, NOM_MAX, nomDuLien, verifierLienExterne } from "./lien-externe";

describe("un lien externe", () => {
  it.each([
    ["https://drive.google.com/file/d/1AbC/view?usp=sharing", "drive.google.com"],
    ["  https://www.dropbox.com/s/xyz/pack.zip?dl=1  ", "dropbox.com"],
    ["https://createur.ci/telechargements/pack.zip", "createur.ci"],
  ])("accepte %s", (brut, hote) => {
    const v = verifierLienExterne(brut);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.hote).toBe(hote);
      expect(v.url).toBe(new URL(brut.trim()).href);
    }
  });

  it.each([
    ["", "Colle"],
    ["drive.google.com/file/d/1AbC", "https://"],
    ["http://drive.google.com/file/d/1AbC", "https"],
    ["javascript:alert(1)", "https"],
    ["data:text/html,<script>alert(1)</script>", "https"],
    ["ftp://fichiers.exemple.com/pack.zip", "https"],
  ])("refuse « %s »", (brut, attendu) => {
    const v = verifierLienExterne(brut);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.message).toContain(attendu);
  });

  it("refuse un identifiant dans l'adresse, qui se recopierait chez chaque acheteur", () => {
    const v = verifierLienExterne("https://moi:secret@fichiers.exemple.com/pack.zip");
    expect(v.ok).toBe(false);
  });

  it.each([
    "https://192.168.1.10/pack.zip",
    "https://127.0.0.1/pack.zip",
    "https://[::1]/pack.zip",
    "https://localhost/pack.zip",
    "https://nas.local/pack.zip",
    "https://intranet/pack.zip",
    "https://metadata.google.internal/computeMetadata",
  ])("refuse ce qui ne mène pas à un site public : %s", (brut) => {
    expect(verifierLienExterne(brut).ok).toBe(false);
  });

  it("refuse une adresse plus longue que la borne", () => {
    expect(verifierLienExterne(`https://exemple.com/${"a".repeat(LIEN_MAX)}`).ok).toBe(false);
  });
});

describe("ce qu'on en montre", () => {
  it("dit l'hôte sans www.", () => {
    expect(hoteAffiche("WWW.Dropbox.com")).toBe("dropbox.com");
    expect(hoteDuLien("https://www.dropbox.com/s/x")).toBe("dropbox.com");
  });

  it("ne lève pas sur un lien illisible en base", () => {
    expect(hoteDuLien("pas une adresse")).toBe("un site extérieur");
  });

  it("nomme le fichier, ou à défaut l'hôte", () => {
    expect(nomDuLien("  Pack   complet.zip ", "drive.google.com")).toBe("Pack complet.zip");
    expect(nomDuLien("", "drive.google.com")).toBe("Fichier sur drive.google.com");
    expect(nomDuLien("Ligne\nsuivante\u0007", "x.com")).toBe("Ligne suivante");
    expect(nomDuLien("x".repeat(500), "x.com")).toHaveLength(NOM_MAX);
  });
});
