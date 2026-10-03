import { describe, expect, it } from "vitest";

import {
  COLONNES_MAX,
  colonnesDepuisAgent,
  colonnesPour,
  disposer,
  hauteurDeCarte,
  largeurDEstimation,
  repartir,
} from "@/lib/feed/masonry";

describe("le nombre de colonnes", () => {
  it("suit la largeur, d'une colonne à quatre", () => {
    expect(colonnesPour(375)).toBe(1); // un téléphone
    expect(colonnesPour(540)).toBe(2);
    expect(colonnesPour(810)).toBe(3);
    expect(colonnesPour(1336)).toBe(COLONNES_MAX); // l'écran large de la maquette
    expect(colonnesPour(4000)).toBe(COLONNES_MAX);
  });

  it("rend au moins une colonne, même sans largeur mesurée", () => {
    expect(colonnesPour(0)).toBe(1);
    expect(colonnesPour(Number.NaN)).toBe(1);
  });
});

describe("le premier rendu, avant toute mesure", () => {
  it("devine une colonne sur téléphone, deux sur tablette, quatre ailleurs", () => {
    expect(colonnesDepuisAgent("Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36")).toBe(1);
    expect(colonnesDepuisAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(1);
    expect(colonnesDepuisAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe(2);
    expect(colonnesDepuisAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120")).toBe(COLONNES_MAX);
    expect(colonnesDepuisAgent(null)).toBe(COLONNES_MAX);
  });
});

describe("la répartition", () => {
  it("remplit la première rangée de gauche à droite", () => {
    // Le défaut des colonnes CSS : la deuxième carte tombait SOUS la première.
    const piles = repartir([300, 300, 300, 300], 4);
    expect(piles).toEqual([[0], [1], [2], [3]]);
  });

  it("met chaque carte dans la colonne la plus courte", () => {
    const piles = repartir([400, 100, 100, 100, 100], 2);
    // 0 → col 0 (400) ; 1 → col 1 ; 2 → col 1 ; 3 → col 1 (320 + 20 < 420) ; 4 → col 0 ou 1 selon le cumul.
    expect(piles[0]![0]).toBe(0);
    expect(piles[1]!.slice(0, 3)).toEqual([1, 2, 3]);
  });

  it("ne déplace aucune carte déjà placée quand on en ajoute", () => {
    // C'est ce qui permet « charger plus » sans que la grille saute.
    const hauteurs = Array.from({ length: 50 }, (_, i) => 190 + ((i * 37) % 150));
    const avant = repartir(hauteurs.slice(0, 24), 4);
    const apres = repartir(hauteurs, 4);
    avant.forEach((pile, c) => {
      expect(apres[c]!.slice(0, pile.length)).toEqual(pile);
    });
  });

  it("garde chaque carte une fois, et une seule", () => {
    const piles = repartir(Array.from({ length: 37 }, () => 250), 3);
    expect(piles.flat().sort((a, b) => a - b)).toEqual(Array.from({ length: 37 }, (_, i) => i));
  });
});

describe("le passage du serveur au navigateur", () => {
  it("garde la répartition du serveur quand le nombre de colonnes est le même", () => {
    // Le cas d'Explorer : le serveur suppose 1336 px, le navigateur mesure
    // 1264 (le rail en prend 72). Des titres de 27 signes tiennent sur une
    // ligne à 329 px de colonne, sur deux à 311 : estimés à la largeur
    // mesurée, ils changeaient de colonne à l'hydratation (mesuré le 03/10).
    const titres = Array.from({ length: 40 }, (_, i) => (i % 3 === 0 ? "x".repeat(27) : "x".repeat(8 + (i % 5))));
    const hauteur = (t: string, l: number) =>
      hauteurDeCarte({ visuel: 220 + (t.length % 4) * 30, titre: t, largeurColonne: l, infosVisibles: true });

    const serveur = disposer({ elements: titres, hauteur, largeurMesuree: null, colonnesInitiales: 4 });
    const navigateur = disposer({ elements: titres, hauteur, largeurMesuree: 1264, colonnesInitiales: 4 });

    expect(navigateur.colonnes).toBe(4);
    expect(navigateur.piles).toEqual(serveur.piles);
  });

  it("refait la répartition quand le nombre de colonnes change", () => {
    const serveur = disposer({ elements: [1, 2, 3, 4], hauteur: () => 300, largeurMesuree: null, colonnesInitiales: 4 });
    const telephone = disposer({ elements: [1, 2, 3, 4], hauteur: () => 300, largeurMesuree: 375, colonnesInitiales: 4 });
    expect(serveur.piles).toHaveLength(4);
    expect(telephone.piles).toEqual([[0, 1, 2, 3]]);
  });

  it("estime à la largeur de la maquette pour chaque nombre de colonnes", () => {
    expect(largeurDEstimation(4)).toBe((1336 - 3 * 20) / 4);
    expect(largeurDEstimation(1)).toBe(1336);
  });
});

describe("la hauteur estimée d'une carte", () => {
  it("ajoute le bloc d'informations au visuel, titre ramené à deux lignes", () => {
    const court = hauteurDeCarte({ visuel: 260, titre: "Pack wax", largeurColonne: 300, infosVisibles: true });
    const long = hauteurDeCarte({ visuel: 260, titre: "x".repeat(300), largeurColonne: 300, infosVisibles: true });
    expect(court).toBeGreaterThan(260);
    expect(long - court).toBeCloseTo(17.5, 1);
  });

  it("se réduit au visuel quand les informations n'apparaissent qu'au survol", () => {
    expect(hauteurDeCarte({ visuel: 300, titre: "Pack", largeurColonne: 300, infosVisibles: false })).toBe(300);
  });
});
