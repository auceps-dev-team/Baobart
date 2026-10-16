import { describe, expect, it } from "vitest";

import {
  POIDS_MAX,
  cleDeVisuel,
  cleDepuisAdresse,
  dimensionsVues,
  verifierAnnonce,
  verifierDimensions,
} from "@/lib/profil/visuels";

describe("ce qu'on accepte", () => {
  it("prend un PNG ou un JPG, comme la maquette l'écrit", () => {
    expect(verifierAnnonce("avatar", { nom: "moi.png", taille: 1000, mime: "image/png" }).ok).toBe(true);
    expect(verifierAnnonce("avatar", { nom: "moi.JPEG", taille: 1000, mime: "image/jpeg" }).ok).toBe(true);
  });

  it("refuse un type que l'extension contredit", () => {
    expect(verifierAnnonce("avatar", { nom: "moi.png", taille: 1000, mime: "image/jpeg" }).ok).toBe(false);
    expect(verifierAnnonce("avatar", { nom: "page.svg", taille: 1000, mime: "image/svg+xml" }).ok).toBe(false);
  });

  it("refuse un fichier vide ou trop lourd", () => {
    expect(verifierAnnonce("banniere", { nom: "b.jpg", taille: 0, mime: "image/jpeg" }).ok).toBe(false);
    expect(verifierAnnonce("banniere", { nom: "b.jpg", taille: POIDS_MAX + 1, mime: "image/jpeg" }).ok).toBe(false);
  });

  it("refuse une image trop petite, en disant sa taille", () => {
    const d = verifierDimensions("avatar", 300, 300);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.message).toContain("300×300");
    expect(verifierDimensions("avatar", 400, 400).ok).toBe(true);
    expect(verifierDimensions("banniere", 1600, 399).ok).toBe(false);
  });

  it("lit les dimensions d'une photo couchée par son orientation EXIF", () => {
    expect(dimensionsVues(4000, 3000, 6)).toEqual([3000, 4000]);
    expect(dimensionsVues(4000, 3000, 1)).toEqual([4000, 3000]);
    expect(dimensionsVues(4000, 3000)).toEqual([4000, 3000]);
  });
});

describe("ce qu'on supprime", () => {
  it("retrouve la clé d'une copie publiée de ce compte", () => {
    const cle = cleDeVisuel("u1", "avatar", "9f3a-01");
    expect(cleDepuisAdresse(`http://localhost:9000/baobart-media/${cle}`, "u1")).toBe(cle);
  });

  it("ne touche jamais à ce qui n'est pas à lui", () => {
    // La photo d'un autre compte, un aperçu de produit, une adresse étrangère.
    expect(cleDepuisAdresse(`https://cdn.example/${cleDeVisuel("u2", "avatar", "a1")}`, "u1")).toBeNull();
    expect(cleDepuisAdresse("https://cdn.example/public/apercus/m1-v3.webp", "u1")).toBeNull();
    expect(cleDepuisAdresse("https://cdn.example/public/profils/u1/../apercus/x.webp", "u1")).toBeNull();
    expect(cleDepuisAdresse(null, "u1")).toBeNull();
  });
});
