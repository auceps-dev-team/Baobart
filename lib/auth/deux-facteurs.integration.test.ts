/**
 * La double authentification, contre une vraie base.
 *
 * `totp.test.ts` prouve le calcul contre les vecteurs de la RFC. Celui-ci
 * éprouve ce que le calcul ne dit pas : les deux temps de l'activation, la
 * consommation du défi, l'unicité d'un code de secours, et la fraîcheur d'un
 * passage.
 *
 * Quatre de ces cinq règles ne se voient que sur une transaction concurrente
 * ou une date passée — c'est-à-dire nulle part ailleurs qu'ici.
 */

import { beforeAll, describe, expect, it } from "vitest";

import {
  FRAICHEUR_SENSIBLE_MS,
  commencerActivation,
  confirmerActivation,
  desactiver,
  deuxFacteursRecent,
  etatDeuxFacteurs,
  noterPassage,
  ouvrirDefi,
  purgerDefisExpires,
  regenererCodesSecours,
  releverDefi,
} from "@/lib/auth/deux-facteurs";
import { codeA, deBase32 } from "@/lib/auth/totp";
import { db } from "@/lib/db";

let n = 0;
const suffixe = () => `${Date.now()}-${++n}`;

beforeAll(() => {
  // Le module refuse d'écrire un secret sans clé, et c'est le comportement
  // voulu — voir `totp.test.ts`. Ici on veut éprouver la suite, donc on pose
  // une clé de test.
  process.env.TOTP_ENCRYPTION_KEY ??= "clé-de-test-suffisamment-longue";
});

async function creerCompte() {
  return db.user.create({
    data: { email: `2fa-${suffixe()}@baobart.test`, riskState: "COMPLIANT" },
  });
}

/** Le code que l'application afficherait à cet instant, lu depuis la base. */
async function codeCourant(userId: string, instantMs = Date.now()) {
  const { secretLisible } = await commencerActivation(userId, "x@y.test");
  return codeA(deBase32(secretLisible), instantMs);
}

/** Un compte avec la 2FA active, et ses codes de secours. */
async function compteProtege() {
  const compte = await creerCompte();
  const debut = await commencerActivation(compte.id, compte.email);
  const secret = deBase32(debut.secretLisible);

  const suite = await confirmerActivation(compte.id, codeA(secret, Date.now()));
  if (!suite.ok) throw new Error(`activation refusée : ${suite.motif}`);

  return { compte, secret, codesSecours: suite.codesSecours };
}

describe("l'activation en deux temps", () => {
  it("pose le secret sans protéger le compte", async () => {
    // Le point : activer d'un seul geste fermerait le compte de qui a mal
    // recopié la clé — il exigerait des codes que l'application ne sait pas
    // produire.
    const compte = await creerCompte();

    await commencerActivation(compte.id, compte.email);

    const etat = await etatDeuxFacteurs(compte.id);
    expect(etat.active).toBe(false);
    expect(etat.enAttente).toBe(true);
  });

  it("refuse la confirmation sur un code faux, et ne protège toujours pas", async () => {
    const compte = await creerCompte();
    await commencerActivation(compte.id, compte.email);

    const suite = await confirmerActivation(compte.id, "000000");

    expect(suite.ok).toBe(false);
    expect((await etatDeuxFacteurs(compte.id)).active).toBe(false);
  });

  it("refuse de confirmer sans secret posé", async () => {
    const compte = await creerCompte();

    const suite = await confirmerActivation(compte.id, "123456");

    expect(suite).toEqual({ ok: false, motif: "PAS_DE_SECRET" });
  });

  it("active et rend huit codes de secours", async () => {
    const { compte, codesSecours } = await compteProtege();

    expect(codesSecours).toHaveLength(8);

    const etat = await etatDeuxFacteurs(compte.id);
    expect(etat.active).toBe(true);
    expect(etat.enAttente).toBe(false);
    expect(etat.codesSecoursRestants).toBe(8);
  });

  it("refuse de recommencer quand c'est déjà actif", async () => {
    // Sinon, qui a volé une session substituerait sa propre application sans
    // jamais avoir eu le téléphone.
    const { compte } = await compteProtege();

    await expect(
      commencerActivation(compte.id, compte.email),
    ).rejects.toThrow(/déjà active/);
  });

  it("ne cumule pas deux jeux de codes de secours", async () => {
    // Un lot précédent qui survivrait laisserait d'anciens papiers valables.
    const { compte } = await compteProtege();

    await regenererCodesSecours(compte.id);

    expect(await db.totpRecoveryCode.count({ where: { userId: compte.id } })).toBe(
      8,
    );
  });
});

describe("le défi de connexion", () => {
  it("s'ouvre, se relève, et ne se rejoue pas", async () => {
    // La consommation est ce qui empêche qu'un cookie volé rouvre une session
    // autant de fois qu'on veut pendant cinq minutes.
    const { compte, secret } = await compteProtege();

    const jeton = await ouvrirDefi(compte.id);
    const premier = await releverDefi(jeton, codeA(secret, Date.now()));

    expect(premier).toEqual({ ok: true, userId: compte.id });

    const rejeu = await releverDefi(jeton, codeA(secret, Date.now()));
    expect(rejeu).toEqual({ ok: false, motif: "DEFI_INCONNU" });
  });

  it("n'en garde qu'un par compte", async () => {
    // Deux onglets de connexion ne doivent pas laisser traîner un défi
    // utilisable quand on a abandonné l'autre.
    const { compte } = await compteProtege();

    const premier = await ouvrirDefi(compte.id);
    await ouvrirDefi(compte.id);

    expect(await db.totpChallenge.count({ where: { userId: compte.id } })).toBe(1);
    expect((await releverDefi(premier, "000000")).ok).toBe(false);
  });

  it("refuse un code faux et compte l'essai", async () => {
    const { compte } = await compteProtege();
    const jeton = await ouvrirDefi(compte.id);

    expect(await releverDefi(jeton, "000000")).toEqual({
      ok: false,
      motif: "CODE_FAUX",
    });

    const defi = await db.totpChallenge.findFirst({
      where: { userId: compte.id },
    });
    expect(defi!.attempts).toBe(1);
  });

  it("abandonne après cinq essais, même avec le bon code", async () => {
    const { compte, secret } = await compteProtege();
    const jeton = await ouvrirDefi(compte.id);

    for (let i = 0; i < 5; i += 1) {
      await releverDefi(jeton, "000000");
    }

    // Le bon code, mais trop tard : c'est ce qui rend la recherche de six
    // chiffres sans intérêt.
    expect(await releverDefi(jeton, codeA(secret, Date.now()))).toEqual({
      ok: false,
      motif: "TROP_D_ESSAIS",
    });
  });

  it("refuse un défi expiré, et retire la ligne", async () => {
    const { compte, secret } = await compteProtege();
    const jeton = await ouvrirDefi(compte.id);

    await db.totpChallenge.updateMany({
      where: { userId: compte.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await releverDefi(jeton, codeA(secret, Date.now()))).toEqual({
      ok: false,
      motif: "DEFI_EXPIRE",
    });
    expect(await db.totpChallenge.count({ where: { userId: compte.id } })).toBe(0);
  });

  it("refuse quand la 2FA a été coupée pendant le défi", async () => {
    // Le mot de passe a été donné il y a cinq minutes, et l'on ne sait pas qui
    // a coupé. Ouvrir serait le seul choix vraiment risqué.
    const { compte, secret } = await compteProtege();
    const jeton = await ouvrirDefi(compte.id);

    await db.user.update({
      where: { id: compte.id },
      data: { totpActiveLe: null, totpSecret: null },
    });

    expect(await releverDefi(jeton, codeA(secret, Date.now()))).toEqual({
      ok: false,
      motif: "DEFI_INCONNU",
    });
  });

  it("accepte un code de secours à la place du code d'application", async () => {
    const { compte, codesSecours } = await compteProtege();
    const jeton = await ouvrirDefi(compte.id);

    expect(await releverDefi(jeton, codesSecours[0]!)).toEqual({
      ok: true,
      userId: compte.id,
    });
  });

  it("ne laisse pas servir deux fois le même code de secours", async () => {
    const { compte, codesSecours } = await compteProtege();

    const premier = await ouvrirDefi(compte.id);
    await releverDefi(premier, codesSecours[0]!);

    const second = await ouvrirDefi(compte.id);
    expect(await releverDefi(second, codesSecours[0]!)).toEqual({
      ok: false,
      motif: "CODE_FAUX",
    });

    expect((await etatDeuxFacteurs(compte.id)).codesSecoursRestants).toBe(7);
  });

  it("le ménage retire les défis périmés", async () => {
    const { compte } = await compteProtege();
    await ouvrirDefi(compte.id);
    await db.totpChallenge.updateMany({
      where: { userId: compte.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await purgerDefisExpires()).toBeGreaterThanOrEqual(1);
  });
});

describe("la désactivation", () => {
  it("exige un code valable", async () => {
    // Sans cela, qui a volé une session la couperait d'un clic, et la
    // protection ne vaudrait que contre quelqu'un qui n'y a pas pensé.
    const { compte } = await compteProtege();

    expect(await desactiver(compte.id, "000000")).toBe(false);
    expect((await etatDeuxFacteurs(compte.id)).active).toBe(true);
  });

  it("efface le secret, les codes et les défis", async () => {
    const { compte, secret } = await compteProtege();
    await ouvrirDefi(compte.id);

    expect(await desactiver(compte.id, codeA(secret, Date.now()))).toBe(true);

    const etat = await etatDeuxFacteurs(compte.id);
    expect(etat.active).toBe(false);
    expect(etat.enAttente).toBe(false);
    expect(etat.codesSecoursRestants).toBe(0);
    expect(await db.totpChallenge.count({ where: { userId: compte.id } })).toBe(0);
  });
});

describe("la fraîcheur d'un passage", () => {
  async function sessionDe(userId: string, totpValideLe: Date | null) {
    return db.session.create({
      data: {
        userId,
        token: `s-${suffixe()}`,
        expiresAt: new Date(Date.now() + 86_400_000),
        totpValideLe,
      },
      select: { id: true },
    });
  }

  it("laisse passer un compte sans 2FA", async () => {
    // La garde exige un second facteur RÉCENT de qui en a un. Elle n'impose
    // pas d'en avoir un : ce serait fermer les versements à tout le monde du
    // jour où elle est posée.
    const compte = await creerCompte();
    const session = await sessionDe(compte.id, null);

    expect(await deuxFacteursRecent(session.id)).toBe(true);
  });

  it("refuse une session protégée qui n'a jamais franchi la 2FA", async () => {
    const { compte } = await compteProtege();
    const session = await sessionDe(compte.id, null);

    expect(await deuxFacteursRecent(session.id)).toBe(false);
  });

  it("accepte un passage récent", async () => {
    const { compte } = await compteProtege();
    const session = await sessionDe(compte.id, null);

    await noterPassage(session.id);

    expect(await deuxFacteursRecent(session.id)).toBe(true);
  });

  it("refuse un passage trop ancien", async () => {
    // Un ordinateur laissé ouvert dans un cybercafé ne doit pas servir une
    // heure plus tard.
    const { compte } = await compteProtege();
    const session = await sessionDe(
      compte.id,
      new Date(Date.now() - FRAICHEUR_SENSIBLE_MS - 60_000),
    );

    expect(await deuxFacteursRecent(session.id)).toBe(false);
  });

  it("refuse une session qui n'existe plus", async () => {
    expect(await deuxFacteursRecent("session-inexistante")).toBe(false);
  });
});

describe("le secret en base", () => {
  it("n'y est jamais en clair", async () => {
    // La raison d'être du chiffrement : une fuite de la base seule ne doit pas
    // permettre de fabriquer les codes de tout le monde.
    const { compte, secret } = await compteProtege();

    const ligne = await db.user.findUnique({
      where: { id: compte.id },
      select: { totpSecret: true },
    });

    expect(ligne!.totpSecret).not.toContain(secret.toString("hex"));
    expect(ligne!.totpSecret).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
  });
});

// `codeCourant` n'est pas employé par les tests ci-dessus ; il reste pour
// écrire rapidement un cas nouveau sans refaire l'échafaudage.
void codeCourant;
