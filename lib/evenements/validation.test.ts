/**
 * Ce qu'une saisie d'événement doit franchir.
 *
 * ─────────────────────────────────────────────────────────────────
 * CE QUE CES TESTS ENGAGENT
 *
 *   — les heures sont lues en GMT, quel que soit le fuseau du serveur. C'est
 *     la propriété qui casse le plus discrètement : le même code donnerait
 *     deux heures différentes selon la machine ;
 *   — une fin avant le début est une inversion, pas une omission — l'écrire
 *     donnerait une phase « terminé » dès la création ;
 *   — un présentiel sans adresse est refusé : c'est la seule chose qui
 *     permette de venir ;
 *   — la gratuité s'écrit d'une seule façon (`null`), pour qu'aucun écran
 *     n'ait à traiter zéro et vide séparément.
 */

import { describe, expect, it } from "vitest";

import { GENRES } from "@/lib/evenements/enums";
import { valider, type Saisie } from "@/lib/evenements/validation";

function saisie(over: Partial<Saisie> = {}): Saisie {
  return {
    titre: "Atelier sérigraphie sur wax",
    description:
      "Deux jours pour apprendre à imprimer sur tissu : préparation de l'écran, encres, séchage. Matériel fourni, douze places.",
    genre: "WORKSHOP",
    debut: "2026-10-10T14:00",
    fin: "2026-10-11T18:00",
    lieu: "Abidjan, Cocody",
    enLigne: "",
    capacite: "12",
    prixBillet: "",
    dotation: "",
    ...over,
  };
}

describe("les dates", () => {
  it("lit les heures en GMT, jamais dans le fuseau du serveur", () => {
    const v = valider(saisie());
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.evenement.debut.toISOString()).toBe("2026-10-10T14:00:00.000Z");
    expect(v.evenement.fin.toISOString()).toBe("2026-10-11T18:00:00.000Z");
  });

  it("refuse une fin avant le début", () => {
    const v = valider(saisie({ debut: "2026-10-11T18:00", fin: "2026-10-10T14:00" }));
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("fin");
  });

  it("refuse une fin égale au début", () => {
    // Durée nulle : la phase basculerait de « à venir » à « terminé » sans
    // jamais passer par « en cours ».
    const v = valider(saisie({ debut: "2026-10-10T14:00", fin: "2026-10-10T14:00" }));
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("fin");
  });

  it("refuse une durée de plus d'un an", () => {
    const v = valider(saisie({ debut: "2026-01-01T10:00", fin: "2027-06-01T10:00" }));
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("fin");
  });

  it("accepte une exposition de deux semaines", () => {
    const v = valider(saisie({ debut: "2026-10-10T10:00", fin: "2026-10-24T18:00" }));
    expect(v.ok).toBe(true);
  });

  it("refuse un début manquant", () => {
    const v = valider(saisie({ debut: "" }));
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("debut");
  });

  it("refuse une date mal formée", () => {
    const v = valider(saisie({ debut: "10/10/2026 14h" }));
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("debut");
  });

  it("accepte un événement passé — on archive après coup", () => {
    // Saisir un événement déjà tenu est légitime : on veut sa fiche, ses
    // résultats. Refuser obligerait à mentir sur les dates.
    const v = valider(saisie({ debut: "2020-03-01T10:00", fin: "2020-03-02T18:00" }));
    expect(v.ok).toBe(true);
  });
});

describe("le lieu", () => {
  it("refuse un présentiel sans adresse", () => {
    const v = valider(saisie({ lieu: "  ", enLigne: "" }));
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("lieu");
  });

  it("accepte un événement en ligne sans adresse", () => {
    const v = valider(saisie({ lieu: "", enLigne: "on" }));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.evenement.enLigne).toBe(true);
    expect(v.evenement.lieu).toBeNull();
  });

  it("efface une adresse laissée par mégarde sur un événement en ligne", () => {
    // Sinon la fiche annonce une adresse ET un lien, et l'on ne sait plus.
    const v = valider(saisie({ lieu: "Abidjan, Cocody", enLigne: "on" }));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.evenement.lieu).toBeNull();
  });
});

describe("la capacité", () => {
  it("accepte un plafond", () => {
    const v = valider(saisie({ capacite: "12" }));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.evenement.capacite).toBe(12);
  });

  it("accepte l'absence de plafond", () => {
    const v = valider(saisie({ capacite: "" }));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.evenement.capacite).toBeNull();
  });

  it("refuse zéro — qui n'ouvrirait aucune place", () => {
    const v = valider(saisie({ capacite: "0" }));
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("capacite");
  });

  it("refuse ce qui n'est pas un nombre", () => {
    const v = valider(saisie({ capacite: "une douzaine" }));
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("capacite");
  });
});

describe("les montants", () => {
  it("range la gratuité d'une seule façon — null, jamais zéro", () => {
    const vide = valider(saisie({ prixBillet: "" }));
    const zero = valider(saisie({ prixBillet: "0" }));
    expect(vide.ok && vide.evenement.prixBillet).toBeNull();
    expect(zero.ok && zero.evenement.prixBillet).toBeNull();
  });

  it("garde un prix payant", () => {
    const v = valider(saisie({ prixBillet: "5000" }));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.evenement.prixBillet).toBe(5000);
  });

  it("refuse un prix qui a un zéro de trop", () => {
    const v = valider(saisie({ prixBillet: "500000000" }));
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("prixBillet");
  });

  it("garde une dotation de concours", () => {
    const v = valider(saisie({ genre: "CONTEST", dotation: "250000" }));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.evenement.dotation).toBe(250_000);
  });
});

describe("le texte", () => {
  it("normalise les espaces du titre", () => {
    const v = valider(saisie({ titre: "Atelier   sérigraphie \n sur wax" }));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.evenement.titre).toBe("Atelier sérigraphie sur wax");
  });

  it("refuse un titre trop court", () => {
    const v = valider(saisie({ titre: "Expo" }));
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("titre");
  });

  it("refuse une description trop courte", () => {
    const v = valider(saisie({ description: "Venez nombreux" }));
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("description");
  });

  it("refuse un genre inconnu", () => {
    const v = valider(saisie({ genre: "SOIREE" }));
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("genre");
  });

  it("accepte les quatre genres du schéma", () => {
    for (const g of GENRES) {
      expect(valider(saisie({ genre: g })).ok).toBe(true);
    }
  });
});
