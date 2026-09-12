import { describe, expect, it } from "vitest";

import {
  MotDePasseTropCourtError,
  hacherMotDePasse,
  verifierMotDePasse,
} from "./password";
import {
  forceMotDePasse,
  libelleForce,
  manqueAuMotDePasse,
} from "./strength";

/**
 * Ces tests sont lents PAR CONSTRUCTION, et c'est la propriété qu'on achète.
 *
 * `hacherMotDePasse` demande scrypt avec N = 2^16, soit ~64 Mio et un temps
 * mesurable à chaque appel : c'est ce qui rend une attaque par dictionnaire
 * coûteuse. Un seul test en enchaîne quatre.
 *
 * Le délai par défaut de Vitest est de 5 s. Il suffit sur une machine au
 * repos, et il tombe dès qu'un build — ou un autre projet Node — occupe les
 * cœurs à côté. L'échec obtenu désigne alors du code juste : c'est un faux
 * positif, et il coûte une heure à qui le prend au sérieux.
 *
 * Trente secondes ici plutôt que dans `vitest.config.ts` : le reste de la
 * suite unitaire doit garder un délai serré, faute de quoi une vraie boucle
 * infinie mettrait une demi-minute à se signaler.
 */
const LENT = { timeout: 30_000 };

describe("hachage", LENT, () => {
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

describe("vérification — entrées douteuses", LENT, () => {
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

describe("ce que dit la jauge", () => {
  it("nomme chaque niveau, pour ne pas dépendre de la couleur seule", () => {
    expect(libelleForce("court")).toBe("Trop court");
    expect(libelleForce("motdepasse")).toBe("Acceptable");
    expect(libelleForce("MotDePasse1")).toBe("Bien");
    expect(libelleForce("MotDePasse1!supplement")).toBe("Solide");
  });

  it("dit combien de caractères il manque, et se tait quand il n'en manque plus", () => {
    expect(manqueAuMotDePasse("")).toBeNull();
    expect(manqueAuMotDePasse("abc")).toBe("Encore 5 caractères.");
    expect(manqueAuMotDePasse("abcdefg")).toBe("Encore 1 caractère.");
    expect(manqueAuMotDePasse("abcdefgh")).toBeNull();
  });
});
