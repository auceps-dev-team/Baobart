/**
 * L'URL `mailto:` — qu'on éprouve sans monter ni React ni serveur mail.
 *
 * Ce qui est en jeu ici est l'échappement. Un titre avec apostrophe (« Charte
 * d'entreprise »), une adresse avec `+alias@`, un `&` dans un intitulé
 * cassaient le mailto sur au moins un client de mail. On vérifie chaque
 * caractère qui compte.
 */

import { describe, expect, it } from "vitest";

import { urlDeContact } from "@/lib/services/contact";

const OFFRE = {
  titre: "Charte d'entreprise",
  courrielCreateur: "awa+baobart@example.com",
  urlFiche: "https://baobart.example/services/cly123",
};

describe("urlDeContact", () => {
  it("compose un mailto avec sujet et corps encodés", () => {
    const url = urlDeContact(OFFRE, "commander");

    expect(url).toMatch(/^mailto:/);
    // L'adresse : le `+` est encodé, sinon des clients le lisent comme un espace.
    expect(url).toContain("awa%2Bbaobart%40example.com");
    // Le sujet contient l'intention et le titre échappé.
    expect(decodeURIComponent(url)).toContain("Commande — Charte d'entreprise");
    // Le corps porte l'URL et le titre pour aider au fil de la conversation.
    expect(decodeURIComponent(url)).toContain(OFFRE.urlFiche);
    expect(decodeURIComponent(url)).toContain(OFFRE.titre);
  });

  it("distingue « commander » et « question »", () => {
    const un = urlDeContact(OFFRE, "commander");
    const deux = urlDeContact(OFFRE, "question");

    expect(decodeURIComponent(un)).toContain("Commande —");
    expect(decodeURIComponent(deux)).toContain("Question —");
    // La formule d'ouverture change aussi — sinon les deux boutons se
    // confondraient dans la boîte du créateur au premier tri.
    expect(decodeURIComponent(un)).toContain("commander");
    expect(decodeURIComponent(deux)).toContain("question");
  });

  it("échappe un titre plein de caractères qui cassent le mailto", () => {
    // Ampersand, dièse, plus, apostrophe : chacun casse `?subject=` sur au
    // moins un client s'il n'est pas encodé.
    const url = urlDeContact(
      { ...OFFRE, titre: "R&D · #haute couture + retouches" },
      "commander",
    );
    expect(url).not.toContain(" ");
    expect(url).not.toContain("#");
    expect(url).toContain("%26");
    expect(url).toContain("%23");
    expect(url).toContain("%2B");
  });

  it("préfère `%20` aux `+` pour un espace", () => {
    // URLSearchParams remplace les espaces par `+` — que la plupart des
    // clients de mail interprètent comme un espace, mais Outlook comme un
    // signe plus littéral. On encode chaque paramètre à la main.
    const url = urlDeContact(OFFRE, "commander");
    expect(url).not.toMatch(/[?&]subject=[^&]*\+[^&]/);
    expect(url).toContain("%20");
  });
});
