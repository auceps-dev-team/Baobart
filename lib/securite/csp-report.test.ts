import { describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/csp-report/route";
import { journal } from "@/lib/observabilite/journal";

describe("la route /api/csp-report", () => {
  it("accepte un rapport CSP direct et répond 204", async () => {
    const espion = vi.spyOn(journal, "avertissement");
    const requete = new Request("https://baobart.test/api/csp-report", {
      method: "POST",
      headers: {
        "content-type": "application/csp-report",
        "x-real-ip": "1.2.3.4",
      },
      body: JSON.stringify({
        "document-uri": "https://baobart.test/boutique",
        "violated-directive": "script-src",
      }),
    });

    const rep = await POST(requete);
    expect(rep.status).toBe(204);
    expect(espion).toHaveBeenCalledWith(
      "csp: violation signalee",
      expect.objectContaining({
        directive: "script-src", page: "/boutique",
      }),
    );
  });

  it("accepte un rapport CSP imbriqué sous csp-report et répond 204", async () => {
    const espion = vi.spyOn(journal, "avertissement");
    const requete = new Request("https://baobart.test/api/csp-report", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-real-ip": "1.2.3.5",
      },
      body: JSON.stringify({
        "csp-report": {
          "document-uri": "https://baobart.test/panier",
          "violated-directive": "connect-src",
        },
      }),
    });

    const rep = await POST(requete);
    expect(rep.status).toBe(204);
    expect(espion).toHaveBeenCalledWith(
      "csp: violation signalee",
      expect.objectContaining({
        directive: "connect-src", page: "/panier",
      }),
    );
  });

  it("répond 400 quand le corps n'est pas un JSON valide", async () => {
    const requete = new Request("https://baobart.test/api/csp-report", {
      method: "POST",
      headers: {
        "content-type": "application/csp-report",
        "x-real-ip": "1.2.3.6",
      },
      body: "ceci n'est pas du json",
    });

    const rep = await POST(requete);
    expect(rep.status).toBe(400);
  });

  it("bloque en 429 avec Retry-After si le quota est dépassé", async () => {
    const ip = "9.9.9.99";
    // Le quota csp.rapport est de 60 requêtes par minute
    for (let i = 0; i < 60; i++) {
      const requete = new Request("https://baobart.test/api/csp-report", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-real-ip": ip,
        },
        body: JSON.stringify({ "violated-directive": "img-src" }),
      });
      const rep = await POST(requete);
      expect(rep.status).toBe(204);
    }

    // Le 61ème doit être refusé
    const refus = new Request("https://baobart.test/api/csp-report", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-real-ip": ip,
      },
      body: JSON.stringify({ "violated-directive": "img-src" }),
    });
    const repRefus = await POST(refus);
    expect(repRefus.status).toBe(429);
    expect(repRefus.headers.get("retry-after")).toBeTruthy();
  });

  it("ne journalise jamais le jeton que porte l'adresse de la page", async () => {
    const espion = vi.spyOn(journal, "avertissement");
    const jeton = "Zx9_secretJetonDeReinitialisation-42";
    const rep = await POST(
      new Request("https://baobart.test/api/csp-report", {
        method: "POST",
        headers: { "content-type": "application/csp-report", "x-real-ip": "1.2.3.7" },
        body: JSON.stringify({
          "csp-report": {
            "document-uri": `https://baobart.test/reinitialiser/${jeton}?suite=/dashboard`,
            "violated-directive": "script-src-elem",
            "blocked-uri": `chrome-extension://abc/inject.js?k=${jeton}`,
          },
        }),
      }),
    );
    expect(rep.status).toBe(204);
    const journalise = JSON.stringify(espion.mock.calls.at(-1));
    expect(journalise).not.toContain(jeton);
    expect(espion).toHaveBeenLastCalledWith(
      "csp: violation signalee",
      expect.objectContaining({ page: "/reinitialiser/:x", bloque: "chrome-extension" }),
    );
  });

  it("refuse un corps trop gros sans le lire jusqu'au bout", async () => {
    const espion = vi.spyOn(journal, "avertissement");
    espion.mockClear();
    const rep = await POST(
      new Request("https://baobart.test/api/csp-report", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": "1.2.3.8" },
        body: JSON.stringify({ "violated-directive": "img-src", bourrage: "x".repeat(20_000) }),
      }),
    );
    expect(rep.status).toBe(413);
    expect(espion).not.toHaveBeenCalled();
  });

  it("lit aussi le format de l'API Reporting", async () => {
    const espion = vi.spyOn(journal, "avertissement");
    const rep = await POST(
      new Request("https://baobart.test/api/csp-report", {
        method: "POST",
        headers: { "content-type": "application/reports+json", "x-real-ip": "1.2.3.9" },
        body: JSON.stringify([
          { type: "csp-violation", body: { effectiveDirective: "img-src", blockedURL: "https://pub.exemple/x.png?id=1", documentURL: "https://baobart.test/@awa", disposition: "enforce" } },
        ]),
      }),
    );
    expect(rep.status).toBe(204);
    expect(espion).toHaveBeenLastCalledWith(
      "csp: violation signalee",
      { directive: "img-src", bloque: "https://pub.exemple", page: "/:x", disposition: "enforce" },
    );
  });
});