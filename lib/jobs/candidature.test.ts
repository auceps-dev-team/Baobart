import { describe, expect, it } from "vitest";

import {
  CV_TAILLE_MAX,
  MESSAGE_MAX,
  depotAcceptable,
  valider,
  type Saisie,
} from "./candidature";

const BONNE: Saisie = {
  message: "Bonjour, je serais heureuse de participer à ce projet.",
  cvNom: "awa-diallo-cv.pdf",
  cvOctets: 250_000,
  cvType: "application/pdf",
};

const avec = (p: Partial<Saisie>): Saisie => ({ ...BONNE, ...p });

describe("valider une candidature", () => {
  it("accepte une candidature ordinaire", () => {
    const v = valider(BONNE);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.cvExtension).toBe("pdf");
  });

  it("laisse le message vide", () => {
    // Un mot d'accompagnement n'est pas obligatoire — beaucoup de recruteurs
    // le lisent en dernier. L'exiger ferait renoncer les candidats pressés.
    const v = valider(avec({ message: "" }));
    expect(v.ok).toBe(true);
  });

  it("refuse un message démesuré", () => {
    // Sans borne, un envoi automatisé remplit la base sans que l'unicité
    // n'arrête rien : un même contenu ne se répète pas.
    expect(valider(avec({ message: "x".repeat(MESSAGE_MAX + 1) })))
      .toMatchObject({ ok: false, refus: { champ: "message" } });
  });

  it("refuse un CV absent", () => {
    expect(valider(avec({ cvNom: "" }))).toMatchObject({
      ok: false,
      refus: { champ: "cv" },
    });
    expect(valider(avec({ cvOctets: 0 }))).toMatchObject({
      ok: false,
      refus: { champ: "cv" },
    });
  });

  it("refuse un CV trop lourd", () => {
    // Au-delà, ce n'est plus un CV, c'est un portfolio.
    const v = valider(avec({ cvOctets: CV_TAILLE_MAX + 1 }));
    expect(v).toMatchObject({ ok: false, refus: { champ: "cv" } });
  });

  it("refuse un fichier qui n'a pas l'extension pdf", () => {
    expect(valider(avec({ cvNom: "cv.docx" }))).toMatchObject({
      ok: false,
      refus: { champ: "cv" },
    });
  });

  it("refuse un type MIME qui n'est pas application/pdf", () => {
    // Le navigateur envoie ce qu'il veut. On refuse d'entrée, mais le vrai
    // contrôle est sur les octets.
    expect(valider(avec({ cvType: "application/octet-stream" }))).toMatchObject({
      ok: false,
      refus: { champ: "cv" },
    });
  });

  it("tolère un type MIME vide, car certains navigateurs n'en envoient pas", () => {
    // Le contrôle des magic bytes tranche ensuite.
    expect(valider(avec({ cvType: "" })).ok).toBe(true);
  });
});

describe("les magic bytes d'un PDF", () => {
  it("reconnaissent un vrai PDF", () => {
    // « %PDF- » en ASCII.
    expect(depotAcceptable(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(true);
  });

  it("refusent un fichier qui prétend l'être", () => {
    // Un DOCX renommé « cv.pdf » — ZIP, magic bytes « PK ». Sans ce contrôle,
    // le renommer aurait suffi à contourner l'extension.
    expect(depotAcceptable(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]))).toBe(false);
  });

  it("refusent un fichier vide ou trop court", () => {
    expect(depotAcceptable(new Uint8Array())).toBe(false);
    expect(depotAcceptable(new Uint8Array([0x25, 0x50]))).toBe(false);
  });
});
