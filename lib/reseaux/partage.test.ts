import { describe, expect, it } from "vitest";

import { absolue, courrielDePartage, destinationsDePartage } from "@/lib/reseaux/partage";

const PAGE = {
  url: "https://baobart.example/products/pack-wax",
  titre: "Pack d'icônes « wax » & co",
};

describe("les adresses de partage", () => {
  it("propose cinq réseaux sans image, six avec", () => {
    expect(destinationsDePartage(PAGE).map((d) => d.reseau)).toEqual(["whatsapp", "facebook", "x", "linkedin", "threads"]);
    expect(
      destinationsDePartage({ ...PAGE, image: "https://baobart.example/img/c.jpg" }).map((d) => d.reseau),
    ).toEqual(["whatsapp", "facebook", "x", "linkedin", "pinterest", "threads"]);
  });

  it("encode chaque paramètre, apostrophes, guillemets et esperluettes compris", () => {
    const facebook = destinationsDePartage(PAGE).find((d) => d.reseau === "facebook")!;
    expect(facebook.href).toBe(
      "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fbaobart.example%2Fproducts%2Fpack-wax",
    );
    const x = new URL(destinationsDePartage(PAGE).find((d) => d.reseau === "x")!.href);
    // Relu par le navigateur, le titre revient intact : rien n'a coupé
    // l'adresse à l'esperluette.
    expect(x.searchParams.get("text")).toBe(PAGE.titre);
    expect(x.searchParams.get("url")).toBe(PAGE.url);
  });

  it("n'écrit jamais les espaces en +", () => {
    for (const d of destinationsDePartage(PAGE)) expect(d.href).not.toContain("+");
    expect(courrielDePartage(PAGE)).not.toContain("+");
  });

  it("n'ajoute aucun paramètre de suivi", () => {
    for (const d of destinationsDePartage(PAGE)) expect(d.href).not.toMatch(/utm_/);
  });

  it("met l'image dans l'épingle Pinterest", () => {
    const p = new URL(
      destinationsDePartage({ ...PAGE, image: "https://baobart.example/img/c.jpg" }).find((d) => d.reseau === "pinterest")!.href,
    );
    expect(p.searchParams.get("media")).toBe("https://baobart.example/img/c.jpg");
  });
});

describe("une adresse absolue", () => {
  it("se compose depuis un chemin, et laisse passer une adresse déjà absolue", () => {
    expect(absolue("/img/demo/neon.png", "https://baobart.example")).toBe("https://baobart.example/img/demo/neon.png");
    expect(absolue("https://cdn.example/a.png", "https://baobart.example")).toBe("https://cdn.example/a.png");
    expect(absolue(null, "https://baobart.example")).toBeNull();
  });
});
