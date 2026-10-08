import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/auth/telephone/route";
import { empreinteDe, genererCode, lireCode, texteDuCode } from "@/lib/auth/telephone";
import { replier, segments } from "@/lib/sms/gsm7";

describe("le code", () => {
  it("a toujours six chiffres, zéros de tête compris", () => {
    for (let i = 0; i < 500; i += 1) expect(genererCode()).toMatch(/^\d{6}$/);
  });

  it("se lit avec espaces ou tiret, et seulement sur six chiffres", () => {
    expect(lireCode("482 913")).toBe("482913");
    expect(lireCode("482-913")).toBe("482913");
    expect(lireCode("48291")).toBeNull();
    expect(lireCode("4829134")).toBeNull();
    expect(lireCode("48a913")).toBeNull();
  });

  it("dépend du sel : deux lignes ne partagent pas une empreinte", () => {
    expect(empreinteDe("a", "123456")).not.toBe(empreinteDe("b", "123456"));
    expect(empreinteDe("a", "123456")).toBe(empreinteDe("a", "123456"));
  });
});

describe("le SMS", () => {
  it.each(["LOGIN", "VERIFY"] as const)(
    "%s tient en un seul segment facturé, une fois replié en GSM-7",
    (but) => {
      // Un caractère typographique de trop et le message passe en UCS-2 :
      // 70 caractères par segment au lieu de 160, et la facture double.
      const texte = replier(texteDuCode("482913", but));
      expect(segments(texte)).toBe(1);
      expect(texte).toContain("482913");
    },
  );
});

describe("la route du bouton « Téléphone »", () => {
  it("mène au formulaire, jamais à une 404", () => {
    const reponse = GET();
    expect(reponse.status).toBe(303);
    // Relative : le navigateur la résout contre l'hôte qu'il a demandé. Une
    // adresse absolue tirée de `requete.url` portait l'hôte d'écoute du
    // serveur (`localhost`), et la session se posait sur le mauvais hôte —
    // ce qu'un test qui fabrique lui-même sa `Request` ne pouvait pas voir.
    expect(reponse.headers.get("location")).toBe("/connexion/telephone");
  });
});
