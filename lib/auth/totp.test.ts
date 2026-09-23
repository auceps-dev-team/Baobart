/**
 * TOTP, éprouvé contre les vecteurs de la RFC 6238.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI CES VECTEURS CHANGENT LA NATURE DU TEST
 *
 * Un test écrit à partir du code vérifie que le code fait ce qu'il fait. Ici,
 * l'annexe B de la RFC 6238 publie les codes attendus pour un secret et des
 * instants donnés : on compare à une autorité extérieure, écrite avant nous et
 * par quelqu'un d'autre.
 *
 * C'est la différence entre « mon implémentation est cohérente » et « mon
 * implémentation est celle que Google Authenticator lira ». La première ne se
 * verrait jamais fausse ; la seconde, si.
 *
 * Le secret de l'annexe est la chaîne ASCII « 12345678901234567890 », soit
 * vingt octets — exactement la taille que produit `nouveauSecret`.
 */

import { describe, expect, it } from "vitest";

import {
  CHIFFRES,
  ChiffrementIndisponibleError,
  PAS_SECONDES,
  TOLERANCE_PAS,
  chiffrementDisponible,
  chiffrerSecret,
  codeA,
  codeValide,
  deBase32,
  dechiffrerSecret,
  empreinteCodeSecours,
  enBase32,
  nouveauSecret,
  nouveauxCodesSecours,
  secretLisible,
  uriOtpauth,
} from "@/lib/auth/totp";

const SECRET_RFC = Buffer.from("12345678901234567890", "ascii");

describe("les vecteurs de la RFC 6238", () => {
  /**
   * Annexe B, colonne SHA-1. Les instants sont en secondes ; on les passe en
   * millisecondes.
   *
   * Le dernier — 20 000 000 000 — dépasse 2^32 une fois divisé par 30, ce qui
   * éprouve l'écriture du compteur sur huit octets. Un raccourci à 32 bits
   * passerait les quatre premiers et se tromperait sur celui-là.
   */
  const VECTEURS: Array<[secondes: number, attendu: string]> = [
    [59, "287082"],
    [1_111_111_109, "081804"],
    [1_111_111_111, "050471"],
    [1_234_567_890, "005924"],
    [2_000_000_000, "279037"],
    [20_000_000_000, "353130"],
  ];

  for (const [secondes, attendu] of VECTEURS) {
    it(`rend ${attendu} à t=${secondes}`, () => {
      expect(codeA(SECRET_RFC, secondes * 1000)).toBe(attendu);
    });
  }
});

describe("la validation", () => {
  const INSTANT = 1_111_111_111_000;

  it("accepte le code du pas courant", () => {
    expect(codeValide(SECRET_RFC, "050471", INSTANT)).toBe(true);
  });

  it("accepte le pas précédent et le suivant", () => {
    // L'horloge du téléphone n'est pas la nôtre, et taper six chiffres prend
    // quelques secondes : sans tolérance, une personne sur dix échoue.
    const avant = codeA(SECRET_RFC, INSTANT - PAS_SECONDES * 1000);
    const apres = codeA(SECRET_RFC, INSTANT + PAS_SECONDES * 1000);

    expect(codeValide(SECRET_RFC, avant, INSTANT)).toBe(true);
    expect(codeValide(SECRET_RFC, apres, INSTANT)).toBe(true);
  });

  it("refuse deux pas plus loin", () => {
    // La fenêtre doit rester bornée : un code lu par-dessus l'épaule ne doit
    // pas rester valable deux minutes.
    const loin = codeA(SECRET_RFC, INSTANT + (TOLERANCE_PAS + 1) * PAS_SECONDES * 1000);
    expect(codeValide(SECRET_RFC, loin, INSTANT)).toBe(false);
  });

  it("refuse ce qui n'est pas six chiffres", () => {
    // La comparaison à durée constante exige deux tampons de même longueur :
    // sans ce filtre, `timingSafeEqual` lèverait au lieu de rendre `false`, et
    // un code de cinq chiffres produirait une erreur 500.
    for (const mauvais of ["", "12345", "1234567", "abcdef", "12 34 56 78"]) {
      expect(codeValide(SECRET_RFC, mauvais, INSTANT)).toBe(false);
    }
  });

  it("tolère les espaces dans un code correct", () => {
    expect(codeValide(SECRET_RFC, "050 471", INSTANT)).toBe(true);
  });

  it("refuse le code d'un autre secret", () => {
    const autre = Buffer.from("09876543210987654321", "ascii");
    expect(codeValide(autre, "050471", INSTANT)).toBe(false);
  });
});

describe("base32", () => {
  it("fait l'aller-retour", () => {
    const secret = nouveauSecret();
    expect(deBase32(enBase32(secret)).equals(secret)).toBe(true);
  });

  it("encode comme la RFC 4648", () => {
    // « foobar » est l'exemple de la RFC 4648 §10, sans remplissage.
    expect(enBase32(Buffer.from("foobar", "ascii"))).toBe("MZXW6YTBOI");
  });

  it("relit ce qu'un humain a recopié : minuscules, espaces, tirets", () => {
    const secret = nouveauSecret();
    const lisible = secretLisible(enBase32(secret));

    expect(deBase32(lisible.toLowerCase()).equals(secret)).toBe(true);
  });

  it("refuse un caractère qui n'existe pas dans l'alphabet", () => {
    // `0`, `1`, `8` et `9` sont absents exprès — ils se confondent avec O, I,
    // B et g. Les accepter silencieusement produirait un secret faux, et donc
    // des codes refusés sans explication.
    expect(() => deBase32("ABC0")).toThrow();
  });
});

describe("l'URI otpauth", () => {
  it("porte l'éditeur dans le chemin ET en paramètre", () => {
    const uri = uriOtpauth("JBSWY3DPEHPK3PXP", "aya@baobart.test");

    expect(uri.startsWith("otpauth://totp/Baobart%3Aaya%40baobart.test?")).toBe(
      true,
    );
    expect(uri).toContain("issuer=Baobart");
  });

  it("annonce les paramètres que le code emploie vraiment", () => {
    // Dérivés des constantes, pas recopiés : changer `CHIFFRES` sans changer
    // l'URI ferait afficher à l'application des codes que nous refusons.
    const uri = uriOtpauth("JBSWY3DPEHPK3PXP", "aya@baobart.test");

    expect(uri).toContain(`digits=${CHIFFRES}`);
    expect(uri).toContain(`period=${PAS_SECONDES}`);
    expect(uri).toContain("algorithm=SHA1");
  });
});

describe("le chiffrement du secret", () => {
  const cleOrigine = process.env.TOTP_ENCRYPTION_KEY;

  function avecCle<T>(cle: string | undefined, faire: () => T): T {
    if (cle === undefined) delete process.env.TOTP_ENCRYPTION_KEY;
    else process.env.TOTP_ENCRYPTION_KEY = cle;

    try {
      return faire();
    } finally {
      if (cleOrigine === undefined) delete process.env.TOTP_ENCRYPTION_KEY;
      else process.env.TOTP_ENCRYPTION_KEY = cleOrigine;
    }
  }

  it("fait l'aller-retour", () => {
    avecCle("une-phrase-assez-longue-pour-servir", () => {
      const secret = nouveauSecret();
      expect(dechiffrerSecret(chiffrerSecret(secret)).equals(secret)).toBe(true);
    });
  });

  it("ne rend jamais deux fois le même chiffré", () => {
    // Le nonce est tiré à chaque appel. Sans lui, deux personnes au même
    // secret auraient la même colonne, ce qui se lit dans un dump.
    avecCle("une-phrase-assez-longue-pour-servir", () => {
      const secret = nouveauSecret();
      expect(chiffrerSecret(secret)).not.toBe(chiffrerSecret(secret));
    });
  });

  it("refuse un contenu modifié", () => {
    // GCM authentifie. Sans cela, un octet changé en base donnerait un secret
    // déchiffré en n'importe quoi, et tous les codes seraient refusés sans
    // que rien n'explique pourquoi.
    avecCle("une-phrase-assez-longue-pour-servir", () => {
      const stocke = chiffrerSecret(nouveauSecret());
      const [nonce, tag, chiffre] = stocke.split(":");
      const altere = `${nonce}:${tag}:${chiffre!.slice(0, -2)}ff`;

      expect(() => dechiffrerSecret(altere)).toThrow();
    });
  });

  it("refuse franchement quand la clé manque", () => {
    // Le point qui compte : pas de repli en clair. Une fonctionnalité qui
    // aurait l'air active sans protéger serait pire que son absence.
    avecCle(undefined, () => {
      expect(chiffrementDisponible()).toBe(false);
      expect(() => chiffrerSecret(nouveauSecret())).toThrow(
        ChiffrementIndisponibleError,
      );
    });
  });

  it("refuse une clé trop courte", () => {
    avecCle("court", () => {
      expect(chiffrementDisponible()).toBe(false);
    });
  });
});

describe("les codes de secours", () => {
  it("en rend huit, tous différents", () => {
    const codes = nouveauxCodesSecours();

    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
  });

  it("les rend recopiables : deux groupes de quatre", () => {
    for (const code of nouveauxCodesSecours()) {
      expect(code).toMatch(/^[A-Z2-7]{4}-[A-Z2-7]{4}$/);
    }
  });

  it("hache pareil quelle que soit la casse ou la ponctuation", () => {
    // On recopie ces codes depuis un bout de papier : exiger le tiret et les
    // majuscules ferait échouer la seule chose qui sépare quelqu'un d'un
    // compte définitivement fermé.
    const attendu = empreinteCodeSecours("ABCD-EFGH");

    expect(empreinteCodeSecours("abcd-efgh")).toBe(attendu);
    expect(empreinteCodeSecours("ABCDEFGH")).toBe(attendu);
    expect(empreinteCodeSecours(" abcd efgh ")).toBe(attendu);
  });

  it("donne des empreintes différentes à des codes différents", () => {
    expect(empreinteCodeSecours("ABCD-EFGH")).not.toBe(
      empreinteCodeSecours("ABCD-EFGJ"),
    );
  });
});
