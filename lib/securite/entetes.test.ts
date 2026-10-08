import { describe, expect, it } from "vitest";

import { entetesDeSecurite, politiqueDeContenu } from "@/lib/securite/entetes";
import nextConfig from "@/next.config";

function valeur(nom: string, env: Record<string, string | undefined> = {}) {
  return entetesDeSecurite(env).find((e) => e.key === nom)?.value;
}

describe("les en-têtes de sécurité", () => {
  it("interdisent l'affichage dans l'iframe d'un autre site", () => {
    expect(valeur("X-Frame-Options")).toBe("DENY");
    expect(politiqueDeContenu({})).toContain("frame-ancestors 'none'");
  });

  it("posent HSTS, nosniff et une politique de Referer", () => {
    expect(valeur("Strict-Transport-Security")).toMatch(/^max-age=\d{8,}/);
    expect(valeur("X-Content-Type-Options")).toBe("nosniff");
    expect(valeur("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("gardent la CSP en mode observation, sans bloquer", () => {
    // Le jour où on la passe en mode bloquant, ce test doit changer avec :
    // c'est une décision, pas un détail de configuration.
    const cles = entetesDeSecurite({}).map((e) => e.key);
    expect(cles).toContain("Content-Security-Policy-Report-Only");
    expect(cles).not.toContain("Content-Security-Policy");
  });

  it("autorisent le stockage pour les images et l'envoi direct", () => {
    const csp = politiqueDeContenu({
      S3_ENDPOINT: "http://localhost:9000",
      S3_PUBLIC_URL: "https://cdn.baobart.test/medias",
    });
    expect(csp).toMatch(/img-src [^;]*https:\/\/cdn\.baobart\.test/);
    expect(csp).toMatch(/connect-src [^;]*http:\/\/localhost:9000/);
  });

  it("ignore une URL de stockage illisible plutôt que de casser le build", () => {
    expect(() => politiqueDeContenu({ S3_ENDPOINT: "pas une url" })).not.toThrow();
  });

  it("n'autorise eval qu'en développement", () => {
    expect(politiqueDeContenu({ NODE_ENV: "production" })).not.toContain("unsafe-eval");
    expect(politiqueDeContenu({ NODE_ENV: "development" })).toContain("unsafe-eval");
  });

  it("sont réellement servis par next.config, sur toutes les routes", async () => {
    // Le module seul ne protège rien : ce test casse si quelqu'un retire le
    // branchement dans `next.config.ts`.
    const regles = await nextConfig.headers!();
    const toutes = regles.find((r) => r.source === "/:path*");
    expect(toutes?.headers.map((h) => h.key)).toContain("X-Frame-Options");
  });
});
