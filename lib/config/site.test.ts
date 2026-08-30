import { afterEach, describe, expect, it } from "vitest";

import { urlDuSite } from "@/lib/config/site";

const INITIALE = process.env.APP_URL;

afterEach(() => {
  if (INITIALE === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = INITIALE;
});

function avec(valeur: string | undefined): string | null {
  if (valeur === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = valeur;
  return urlDuSite();
}

describe("l'adresse publique du site", () => {
  it("rend l'origine, sans le chemin", () => {
    expect(avec("https://baobart.com/quelque/part?x=1")).toBe("https://baobart.com");
  });

  it("tolère les espaces autour", () => {
    expect(avec("  https://baobart.com  ")).toBe("https://baobart.com");
  });

  it("accepte HTTP — le développement local n'a pas de certificat", () => {
    expect(avec("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("rend null quand la variable manque ou est vide", () => {
    expect(avec(undefined)).toBeNull();
    expect(avec("")).toBeNull();
    expect(avec("   ")).toBeNull();
  });

  it("rend null sur une valeur qui n'est pas une URL", () => {
    expect(avec("baobart.com")).toBeNull();
    expect(avec("pas une url du tout")).toBeNull();
  });

  it("refuse les protocoles qui ne mènent pas à une page", () => {
    // `new URL()` avale « javascript: » sans broncher. Un lien de
    // réinitialisation construit dessus s'exécuterait chez celui qui clique.
    expect(avec("javascript:alert(1)")).toBeNull();
    expect(avec("data:text/html,<script>")).toBeNull();
    expect(avec("file:///etc/passwd")).toBeNull();
  });
});
