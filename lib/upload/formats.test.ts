import { describe, expect, it } from "vitest";

import {
  FORMATS,
  NOM_MAX,
  TAILLE_MAX,
  TAILLE_MAX_APERCU,
  extensionDe,
  formatDe,
  formatPoids,
  natureApercu,
  nomSur,
  verifierApercu,
  verifierEnvoi,
} from "./formats";

describe("reconnaissance du format", () => {
  it("lit l'extension, quelle que soit la casse", () => {
    expect(extensionDe("photo.PNG")).toBe("png");
    expect(extensionDe("archive.tar.gz")).toBe("gz");
  });

  it("ne prend pas un fichier caché pour une extension", () => {
    expect(extensionDe(".gitignore")).toBe("");
    expect(extensionDe("sans-extension")).toBe("");
    expect(extensionDe("finit-par-un-point.")).toBe("");
  });

  it("retrouve les formats annoncés par la maquette", () => {
    for (const nom of [
      "a.png",
      "a.jpg",
      "a.ai",
      "a.psd",
      "a.svg",
      "a.ttf",
      "a.mp4",
      "a.zip",
    ]) {
      expect(formatDe(nom), nom).not.toBeNull();
    }
  });
});

describe("ce qu'on peut montrer", () => {
  it("affiche directement les images du web", () => {
    for (const nom of ["a.png", "a.jpg", "a.webp", "a.svg"]) {
      expect(formatDe(nom)?.apercu, nom).toBe("direct");
    }
  });

  it("range en « à produire » ce qui demande un traitement", () => {
    // Un TIFF ne s'affiche pas dans un navigateur ; un PSD encore moins.
    for (const nom of ["a.tif", "a.psd", "a.ai", "a.ttf", "a.mp4", "a.pdf"]) {
      expect(formatDe(nom)?.apercu, nom).toBe("a-produire");
    }
  });

  it("n'attend aucun aperçu d'une archive", () => {
    expect(formatDe("a.zip")?.apercu).toBe("aucun");
  });

  it("ne déclare aucun format sans famille ni type", () => {
    for (const f of FORMATS) {
      expect(f.mime.includes("/"), f.extension).toBe(true);
      expect(f.famille.length, f.extension).toBeGreaterThan(0);
    }
  });
});

describe("acceptation d'un envoi", () => {
  const bon = { nom: "portrait.png", taille: 1024, mimeDeclare: "image/png" };

  it("accepte un fichier conforme", () => {
    expect(verifierEnvoi(bon)).toMatchObject({ accepte: true });
  });

  it("accepte un type non déclaré — certains navigateurs le laissent vide", () => {
    expect(verifierEnvoi({ nom: "portrait.png", taille: 1024 })).toMatchObject({
      accepte: true,
    });
  });

  it("refuse une extension inconnue", () => {
    expect(verifierEnvoi({ ...bon, nom: "script.exe" })).toMatchObject({
      accepte: false,
      refus: "EXTENSION_INCONNUE",
    });
  });

  it("refuse un type qui contredit l'extension", () => {
    // Sans ce contrôle, le fichier serait servi plus tard avec un type qui
    // n'est pas le sien.
    expect(
      verifierEnvoi({ nom: "innocent.png", taille: 10, mimeDeclare: "application/zip" }),
    ).toMatchObject({ accepte: false, refus: "TYPE_INCOHERENT" });
  });

  it("tolère une variante de type dans la même famille", () => {
    // `image/jpg` au lieu de `image/jpeg` : la même chose, mal orthographiée.
    expect(
      verifierEnvoi({ nom: "photo.jpg", taille: 10, mimeDeclare: "image/jpg" }),
    ).toMatchObject({ accepte: true });
  });

  it("refuse au-delà de 200 Mo", () => {
    expect(verifierEnvoi({ ...bon, taille: TAILLE_MAX + 1 })).toMatchObject({
      accepte: false,
      refus: "TROP_LOURD",
    });
    expect(verifierEnvoi({ ...bon, taille: TAILLE_MAX })).toMatchObject({
      accepte: true,
    });
  });

  it("refuse une taille absurde", () => {
    for (const taille of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(verifierEnvoi({ ...bon, taille }), String(taille)).toMatchObject({
        accepte: false,
      });
    }
  });

  it("refuse un nom vide ou démesuré", () => {
    expect(verifierEnvoi({ ...bon, nom: "   " })).toMatchObject({
      accepte: false,
      refus: "NOM_VIDE",
    });
    expect(
      verifierEnvoi({ ...bon, nom: `${"a".repeat(NOM_MAX)}.png` }),
    ).toMatchObject({ accepte: false, refus: "NOM_TROP_LONG" });
  });

  it("donne toujours un message lisible avec un refus", () => {
    const v = verifierEnvoi({ ...bon, nom: "truc.exe" });
    expect((v.message ?? "").length).toBeGreaterThan(10);
  });
});

describe("acceptation d'un aperçu", () => {
  it("reconnaît les trois natures", () => {
    expect(natureApercu("vignette.png")).toBe("image");
    expect(natureApercu("extrait.mp4")).toBe("video");
    expect(natureApercu("extrait.mp3")).toBe("audio");
  });

  it("n'en reconnaît aucune pour ce qui ne s'ouvre pas dans un navigateur", () => {
    for (const nom of ["a.psd", "a.ai", "a.ttf", "a.zip", "a.tif"]) {
      expect(natureApercu(nom), nom).toBeNull();
    }
  });

  it("accepte une image, un extrait vidéo, un extrait audio", () => {
    for (const nom of ["v.png", "v.jpg", "v.webp", "e.mp4", "e.webm", "e.mp3"]) {
      expect(
        verifierApercu({ nom, taille: 2048 }),
        nom,
      ).toMatchObject({ accepte: true });
    }
  });

  it("refuse comme aperçu ce qu'il accepterait comme source", () => {
    // Un PSD est un fichier vendable parfaitement valide — mais il ne montre
    // rien à personne, et c'est précisément pourquoi cette zone existe.
    for (const nom of ["maquette.psd", "police.ttf", "pack.zip", "vecteur.ai"]) {
      expect(verifierEnvoi({ nom, taille: 2048 }), nom).toMatchObject({
        accepte: true,
      });
      expect(verifierApercu({ nom, taille: 2048 }), nom).toMatchObject({
        accepte: false,
        refus: "EXTENSION_INCONNUE",
      });
    }
  });

  it("plafonne l'aperçu à 25 Mo, bien en deçà d'une source", () => {
    const gros = { nom: "extrait.mp4", taille: TAILLE_MAX_APERCU + 1 };
    expect(verifierApercu(gros)).toMatchObject({
      accepte: false,
      refus: "TROP_LOURD",
    });
    // La même taille reste parfaitement acceptable pour un fichier vendu.
    expect(verifierEnvoi(gros)).toMatchObject({ accepte: true });
    expect(TAILLE_MAX_APERCU).toBeLessThan(TAILLE_MAX);
  });

  it("applique aussi les règles générales", () => {
    expect(
      verifierApercu({ nom: "faux.png", taille: 10, mimeDeclare: "application/zip" }),
    ).toMatchObject({ accepte: false, refus: "TYPE_INCOHERENT" });
    expect(verifierApercu({ nom: "v.png", taille: 0 })).toMatchObject({
      accepte: false,
    });
  });
});

describe("poids lisible", () => {
  it("monte d'unité au bon moment", () => {
    expect(formatPoids(512)).toBe("512 o");
    expect(formatPoids(1024)).toBe("1 Ko");
    expect(formatPoids(1024 * 1024)).toBe("1 Mo");
    expect(formatPoids(1024 * 1024 * 1024)).toBe("1 Go");
  });

  it("écrit « 84 Mo » comme la maquette", () => {
    expect(formatPoids(84 * 1024 * 1024)).toBe("84 Mo");
  });

  it("garde une décimale sous dix, avec la virgule française", () => {
    expect(formatPoids(Math.round(8.4 * 1024 * 1024))).toBe("8,4 Mo");
  });

  it("ne s'arrête pas sur une valeur impossible", () => {
    expect(formatPoids(Number.NaN)).toBe("—");
    expect(formatPoids(-1)).toBe("—");
  });
});

describe("assainissement du nom", () => {
  it("translittère et garde l'extension", () => {
    expect(nomSur("Portrait Wax Éditorial.PNG")).toBe(
      "portrait-wax-editorial.png",
    );
  });

  it("neutralise ce qui pourrait sortir du dossier", () => {
    // Un nom qui remonte l'arborescence ne doit jamais atteindre le stockage.
    expect(nomSur("../../etc/passwd.png")).toBe("etc-passwd.png");
    expect(nomSur("a/b/c.png")).toBe("a-b-c.png");
  });

  it("garde un nom utilisable quand il ne reste rien", () => {
    expect(nomSur("!!!.png")).toBe("fichier.png");
  });

  it("borne la longueur", () => {
    expect(nomSur(`${"a".repeat(300)}.png`).length).toBeLessThanOrEqual(85);
  });
});
