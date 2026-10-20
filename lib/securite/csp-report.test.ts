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
        rapport: expect.stringContaining("script-src"),
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
        rapport: expect.stringContaining("connect-src"),
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
});
