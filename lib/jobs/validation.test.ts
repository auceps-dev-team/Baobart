import { describe, expect, it } from "vitest";

import { MODES, POSTULER, TYPES } from "./enums";
import { pointeVersNous, valider, type Saisie } from "./validation";

const MAINTENANT = new Date("2026-09-02T12:00:00Z");

const BONNE: Saisie = {
  titre: "Illustrateur·rice pour une collection jeunesse",
  description:
    "Nous cherchons quelqu'un pour illustrer une collection de six albums jeunesse. " +
    "Le travail se fait par lots de deux albums, avec un aller-retour de relecture. " +
    "Expérience en édition appréciée, portfolio demandé.",
  type: "FREELANCE",
  mode: "REMOTE",
  pays: "CI",
  ville: "Abidjan",
  salaireMin: "300000",
  salaireMax: "500000",
  echeance: "2026-10-31",
  commentPostuler: "BAOBART",
  urlExterne: "",
};

const avec = (p: Partial<Saisie>): Saisie => ({ ...BONNE, ...p });

describe("une offre correcte", () => {
  it("passe", () => {
    const v = valider(BONNE, MAINTENANT);
    expect(v.ok).toBe(true);
  });

  it("normalise ce qui doit l'être", () => {
    const v = valider(
      avec({ titre: "  Illustrateur   jeunesse  ", pays: "ci" }),
      MAINTENANT,
    );
    if (!v.ok) throw new Error("refusée");
    expect(v.offre.titre).toBe("Illustrateur jeunesse");
    expect(v.offre.pays).toBe("CI");
  });
});

describe("l'échéance", () => {
  it("range la FIN du jour choisi", () => {
    // « Jusqu'au 31 octobre » veut dire que le 31 compte encore. Ranger minuit
    // ferait disparaître l'offre la veille du jour annoncé.
    const v = valider(BONNE, MAINTENANT);
    if (!v.ok) throw new Error("refusée");
    expect(v.offre.echeance?.toISOString()).toBe("2026-10-31T23:59:59.999Z");
  });

  it("refuse une date déjà passée", () => {
    // Une offre déposée avec une échéance passée ne paraîtrait jamais :
    // l'accepter en silence laisserait son auteur attendre une modération qui
    // n'aurait servi à rien.
    const v = valider(avec({ echeance: "2026-08-01" }), MAINTENANT);
    expect(v).toMatchObject({ ok: false, refus: { champ: "echeance" } });
  });

  it("refuse une échéance à plus d'un an", () => {
    // Une offre valable trois ans est une offre qu'on a oublié de fermer.
    const v = valider(avec({ echeance: "2029-01-01" }), MAINTENANT);
    expect(v).toMatchObject({ ok: false, refus: { champ: "echeance" } });
  });

  it("l'accepte absente", () => {
    const v = valider(avec({ echeance: "" }), MAINTENANT);
    if (!v.ok) throw new Error("refusée");
    expect(v.offre.echeance).toBeNull();
  });
});

describe("l'adresse externe", () => {
  const externe = (url: string) =>
    valider(avec({ commentPostuler: "EXTERNE", urlExterne: url }), MAINTENANT);

  it("accepte une adresse https", () => {
    expect(externe("https://exemple.africa/emplois/42").ok).toBe(true);
  });

  it("refuse tout ce qui n'est pas https", () => {
    // `javascript:` et `data:` sont des injections déguisées en lien ; `http`
    // conduit un candidat à envoyer son CV sans chiffrement.
    for (const url of [
      "http://exemple.africa/emplois",
      "javascript:alert(1)",
      "data:text/html,<script>",
      "ftp://exemple.africa",
    ]) {
      expect(externe(url)).toMatchObject({
        ok: false,
        refus: { champ: "urlExterne" },
      });
    }
  });

  it("refuse une adresse absente ou illisible", () => {
    expect(externe("")).toMatchObject({ ok: false, refus: { champ: "urlExterne" } });
    expect(externe("pas une url")).toMatchObject({
      ok: false,
      refus: { champ: "urlExterne" },
    });
  });

  it("efface l'adresse quand l'annonceur change d'avis", () => {
    // Les deux modes s'excluent. Une URL laissée par mégarde ne doit pas
    // survivre au passage en mode Baobart — sinon un écran finirait par
    // l'afficher.
    const v = valider(
      avec({ commentPostuler: "BAOBART", urlExterne: "https://ailleurs.test" }),
      MAINTENANT,
    );
    if (!v.ok) throw new Error("refusée");
    expect(v.offre.urlExterne).toBeNull();
    expect(v.offre.commentPostuler).toBe("BAOBART");
  });

  it("reconnaît une adresse qui pointe chez nous", () => {
    // Une offre « externe » qui renvoie sur Baobart emprunte notre nom pour
    // rassurer.
    expect(pointeVersNous("https://baobart.ci/x", "baobart.ci")).toBe(true);
    expect(pointeVersNous("https://Baobart.CI/x", "baobart.ci")).toBe(true);
    expect(pointeVersNous("https://ailleurs.test/x", "baobart.ci")).toBe(false);
    // Sans adresse publique connue, on ne peut rien affirmer.
    expect(pointeVersNous("https://baobart.ci/x", null)).toBe(false);
  });
});

describe("ce qui rend une offre inexploitable", () => {
  it("refuse une description trop courte", () => {
    // « Recrute, contacte par WhatsApp » est la forme exacte de l'arnaque
    // qu'on écarte — et c'est aussi inutilisable pour un candidat honnête.
    const v = valider(avec({ description: "Recrute, contacte-moi." }), MAINTENANT);
    expect(v).toMatchObject({ ok: false, refus: { champ: "description" } });
  });

  it("refuse un intitulé vide ou démesuré", () => {
    expect(valider(avec({ titre: "  " }), MAINTENANT).ok).toBe(false);
    expect(valider(avec({ titre: "x".repeat(200) }), MAINTENANT).ok).toBe(false);
  });

  it("refuse un type ou un mode inventé", () => {
    expect(valider(avec({ type: "STAGIAIRE" }), MAINTENANT)).toMatchObject({
      ok: false,
      refus: { champ: "type" },
    });
    expect(valider(avec({ mode: "TELETRAVAIL" }), MAINTENANT)).toMatchObject({
      ok: false,
      refus: { champ: "mode" },
    });
  });

  it("refuse un salaire inversé", () => {
    // Ce n'est pas une omission : c'est une saisie à l'envers, et l'afficher
    // telle quelle ferait passer l'annonceur pour négligent.
    const v = valider(
      avec({ salaireMin: "500000", salaireMax: "300000" }),
      MAINTENANT,
    );
    expect(v).toMatchObject({ ok: false, refus: { champ: "salaire" } });
  });

  it("accepte un salaire non annoncé", () => {
    const v = valider(avec({ salaireMin: "", salaireMax: "" }), MAINTENANT);
    if (!v.ok) throw new Error("refusée");
    expect(v.offre.salaireMin).toBeNull();
  });
});

describe("les listes recopiées du schéma", () => {
  it("ne sont pas vides et n'ont pas de doublon", () => {
    // Le vrai garde-fou est le test d'intégration, qui confronte ces listes à
    // l'enum Prisma. Celui-ci attrape au moins la faute de frappe.
    for (const liste of [TYPES, MODES, POSTULER]) {
      expect(liste.length).toBeGreaterThan(0);
      expect(new Set(liste).size).toBe(liste.length);
    }
  });
});
