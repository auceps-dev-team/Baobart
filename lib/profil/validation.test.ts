/**
 * Ce qu'une saisie de profil doit franchir.
 *
 * ─────────────────────────────────────────────────────────────────
 * CE QUE CES TESTS ENGAGENT
 *
 *   — le nom d'utilisateur se normalise **exactement** comme à l'inscription.
 *     Deux règles qui divergeraient feraient qu'on ne peut plus « changer »
 *     son nom pour celui qu'on a déjà : l'unicité se heurterait à soi-même ;
 *   — un pseudo de réseau se range nu, quelle que soit la façon dont il a été
 *     collé — sinon la vitrine affiche « @https://instagram.com/awa » ;
 *   — un portfolio en `http` ou en `javascript:` est refusé : c'est un lien
 *     qu'on met en avant sur une page publique ;
 *   — l'absence s'écrit d'une seule façon, `null`, pour qu'aucun écran n'ait
 *     à distinguer la chaîne vide du rien.
 */

import { describe, expect, it } from "vitest";

import { normaliserUsername, valider, type Saisie } from "@/lib/profil/validation";

function saisie(over: Partial<Saisie> = {}): Saisie {
  return {
    nomAffiche: "Awa Diallo",
    username: "awa-diallo",
    bio: "Illustratrice à Abidjan.",
    ville: "Abidjan",
    pays: "CI",
    specialite: "Illustration éditoriale",
    portfolio: "",
    instagram: "",
    behance: "",
    disponibilite: "",
    tarifJournalier: "",
    ...over,
  };
}

describe("le nom d'utilisateur", () => {
  it("se normalise comme à l'inscription", () => {
    expect(normaliserUsername("  Awa DIALLO  ")).toBe("awa-diallo");
    expect(normaliserUsername("Créa'Tion Wax")).toBe("crea-tion-wax");
    expect(normaliserUsername("---awa---")).toBe("awa");
  });

  it("refuse un nom trop court", () => {
    const v = valider(saisie({ username: "aw" }));
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("username");
  });

  it("refuse un nom qui ne laisse rien après normalisation", () => {
    // « @@@ » devient une chaîne vide : il n'y a pas d'adresse à fabriquer.
    const v = valider(saisie({ username: "@@@" }));
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("username");
  });
});

describe("les réseaux", () => {
  it("garde le pseudo nu quand on colle une URL", () => {
    const v = valider(saisie({ instagram: "https://instagram.com/awa.diallo/" }));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.profil.instagram).toBe("awa.diallo");
  });

  it("retire le @ quand on le tape", () => {
    const v = valider(saisie({ behance: "@awadiallo" }));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.profil.behance).toBe("awadiallo");
  });

  it("laisse un pseudo nu tel quel", () => {
    const v = valider(saisie({ instagram: "awadiallo" }));
    expect(v.ok && v.profil.instagram).toBe("awadiallo");
  });

  it("range null quand le champ est vide", () => {
    const v = valider(saisie({ instagram: "   " }));
    expect(v.ok && v.profil.instagram).toBeNull();
  });
});

describe("le portfolio", () => {
  it("accepte une adresse https", () => {
    const v = valider(saisie({ portfolio: "https://awa.example" }));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.profil.portfolio).toContain("awa.example");
  });

  it("refuse http en clair", () => {
    // C'est un lien qu'on met en avant sur une page publique.
    const v = valider(saisie({ portfolio: "http://awa.example" }));
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("portfolio");
  });

  it("refuse une injection déguisée en lien", () => {
    const v = valider(saisie({ portfolio: "javascript:alert(1)" }));
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("portfolio");
  });

  it("refuse ce qui n'est pas une URL", () => {
    const v = valider(saisie({ portfolio: "mon site perso" }));
    expect(v.ok).toBe(false);
  });
});

describe("le reste", () => {
  it("refuse un pays qui n'est pas un code à deux lettres", () => {
    const v = valider(saisie({ pays: "Côte d'Ivoire" }));
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("pays");
  });

  it("met le pays en majuscules", () => {
    const v = valider(saisie({ pays: "ci" }));
    expect(v.ok && v.profil.pays).toBe("CI");
  });

  it("range l'absence de tarif d'une seule façon", () => {
    const vide = valider(saisie({ tarifJournalier: "" }));
    const zero = valider(saisie({ tarifJournalier: "0" }));
    expect(vide.ok && vide.profil.tarifJournalier).toBeNull();
    expect(zero.ok && zero.profil.tarifJournalier).toBeNull();
  });

  it("garde un tarif annoncé", () => {
    const v = valider(saisie({ tarifJournalier: "45000" }));
    expect(v.ok && v.profil.tarifJournalier).toBe(45_000);
  });

  it("refuse un tarif qui a un zéro de trop", () => {
    const v = valider(saisie({ tarifJournalier: "500000000" }));
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("tarifJournalier");
  });

  it("refuse un nom affiché vide", () => {
    const v = valider(saisie({ nomAffiche: " " }));
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("nomAffiche");
  });

  it("normalise les espaces du nom affiché", () => {
    const v = valider(saisie({ nomAffiche: "Awa   Diallo" }));
    expect(v.ok && v.profil.nomAffiche).toBe("Awa Diallo");
  });

  it("refuse une bio trop longue", () => {
    const v = valider(saisie({ bio: "x".repeat(601) }));
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("bio");
  });
});
