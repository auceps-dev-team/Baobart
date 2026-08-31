import { describe, expect, it } from "vitest";

import { adresseDe, sujetAnonyme } from "@/lib/securite/adresse";

function requete(entetes: Record<string, string>): Request {
  return new Request("https://baobart.test/x", { headers: new Headers(entetes) });
}

describe("l'adresse d'une requête", () => {
  it("préfère l'en-tête que la plateforme pose elle-même", () => {
    // Celui-là, un client ne peut pas l'usurper : Vercel le remplace s'il
    // arrive de l'extérieur.
    const r = requete({
      "x-vercel-forwarded-for": "9.9.9.9",
      "x-forwarded-for": "1.1.1.1",
      "x-real-ip": "2.2.2.2",
    });
    expect(adresseDe(r)).toBe("9.9.9.9");
  });

  it("retombe sur x-real-ip, posé par les mandataires inverses", () => {
    const r = requete({ "x-real-ip": "2.2.2.2", "x-forwarded-for": "1.1.1.1" });
    expect(adresseDe(r)).toBe("2.2.2.2");
  });

  it("prend le DERNIER élément de x-forwarded-for, pas le premier", () => {
    // Le cœur du sujet. Un mandataire honnête AJOUTE l'adresse réelle à la fin
    // de ce qu'il a reçu : le premier élément est donc entièrement contrôlé par
    // le client, qui changerait de clé à chaque requête. Le dernier est écrit
    // par le mandataire le plus proche de nous.
    const r = requete({ "x-forwarded-for": "6.6.6.6, 7.7.7.7, 8.8.8.8" });
    expect(adresseDe(r)).toBe("8.8.8.8");
  });

  it("tolère un seul élément", () => {
    expect(adresseDe(requete({ "x-forwarded-for": "3.3.3.3" }))).toBe("3.3.3.3");
  });

  it("rend null quand il n'y a rien", () => {
    // Pas une erreur : en développement, derrière un tunnel, ou dans un test,
    // il n'y a pas d'adresse. L'appelant laissera passer.
    expect(adresseDe(requete({}))).toBeNull();
  });

  it("écarte les valeurs qui n'ont rien d'une adresse", () => {
    expect(adresseDe(requete({ "x-real-ip": "" }))).toBeNull();
    expect(adresseDe(requete({ "x-real-ip": "   " }))).toBeNull();
    // Trop longue pour être une adresse : quelqu'un essaie de faire grossir
    // nos clés de compteur.
    expect(adresseDe(requete({ "x-real-ip": "a".repeat(200) }))).toBeNull();
  });

  it("ignore un en-tête sûr vide et passe au suivant", () => {
    const r = requete({ "x-vercel-forwarded-for": "", "x-real-ip": "2.2.2.2" });
    expect(adresseDe(r)).toBe("2.2.2.2");
  });

  it("ne fabrique jamais de sujet de repli", () => {
    // Une valeur commune — « inconnu » — serait pire que rien : tous les
    // visiteurs sans adresse partageraient un compteur, et le premier robot
    // fermerait la porte à tous les autres.
    expect(sujetAnonyme(requete({}))).toBeNull();
  });
});
