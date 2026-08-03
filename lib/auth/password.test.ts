import { describe, expect, it } from "vitest";

import {
  MotDePasseTropCourtError,
  hacherMotDePasse,
  verifierMotDePasse,
} from "./password";
import { forceMotDePasse } from "./strength";

describe("hachage", () => {
  it("accepte le bon mot de passe et refuse les autres", async () => {
    const empreinte = await hacherMotDePasse("motdepasse-solide");

    expect(await verifierMotDePasse("motdepasse-solide", empreinte)).toBe(true);
    expect(await verifierMotDePasse("motdepasse-solidE", empreinte)).toBe(false);
    expect(await verifierMotDePasse("", empreinte)).toBe(false);
  });

  it("ne stocke jamais le mot de passe en clair", async () => {
    const empreinte = await hacherMotDePasse("wax-et-motifs-2026");
    expect(empreinte).not.toContain("wax-et-motifs-2026");
  });

  it("produit une empreinte différente à chaque fois, grâce au sel", async () => {
    const a = await hacherMotDePasse("le-meme-mot-de-passe");
    const b = await hacherMotDePasse("le-meme-mot-de-passe");

    expect(a).not.toBe(b);
    // Les deux restent vérifiables : deux comptes au même mot de passe ne se
    // reconnaissent pas entre eux dans la base.
    expect(await verifierMotDePasse("le-meme-mot-de-passe", a)).toBe(true);
    expect(await verifierMotDePasse("le-meme-mot-de-passe", b)).toBe(true);
  });

  it("transporte ses paramètres avec l'empreinte", async () => {
    const empreinte = await hacherMotDePasse("un-mot-de-passe");
    const [algo, n, r, p] = empreinte.split("$");

    expect(algo).toBe("scrypt");
    expect(Number(n)).toBeGreaterThan(0);
    expect(Number(r)).toBeGreaterThan(0);
    expect(Number(p)).toBeGreaterThan(0);
  });

  it("refuse un mot de passe trop court", async () => {
    await expect(hacherMotDePasse("court")).rejects.toThrow(
      MotDePasseTropCourtError,
    );
  });
});

describe("vérification — entrées douteuses", () => {
  it("répond faux plutôt que de lever, sur une empreinte illisible", async () => {
    for (const stocke of [
      null,
      "",
      "pas-une-empreinte",
      "scrypt$16384$8$1$seulement-cinq-parties",
      "bcrypt$16384$8$1$aa$bb",
      "scrypt$abc$8$1$aa$bb",
    ]) {
      expect(await verifierMotDePasse("peu importe", stocke)).toBe(false);
    }
  });
});

describe("force affichée", () => {
  it("vaut zéro tant que la longueur minimale n'est pas atteinte", () => {
    expect(forceMotDePasse("court")).toBe(0);
    expect(forceMotDePasse("")).toBe(0);
  });

  it("monte avec la variété et la longueur", () => {
    expect(forceMotDePasse("motdepasse")).toBe(1);
    expect(forceMotDePasse("MotDePasse1")).toBe(2);
    expect(forceMotDePasse("MotDePasse1!supplement")).toBe(3);
  });

  it("ne dépasse jamais trois — la jauge n'a que trois segments", () => {
    expect(forceMotDePasse("Un!MotDePasse1TresTresTresLong2026")).toBe(3);
  });
});
