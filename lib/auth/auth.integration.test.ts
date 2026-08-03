/**
 * Cycle de vie d'un compte, contre la vraie base.
 *
 * On teste ici ce qu'un test unitaire ne peut pas voir : que l'inscription
 * n'écrit jamais le mot de passe en clair, que la connexion refuse
 * l'usurpation, et que la session est retrouvable par son empreinte et non par
 * le jeton lui-même.
 *
 * Les actions serveur ont besoin d'un contexte de requête pour poser un cookie :
 * on exerce donc directement les briques qu'elles enchaînent.
 */

import { createHash, randomBytes } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";

import { hacherMotDePasse, verifierMotDePasse } from "@/lib/auth/password";
import { capacitesDe } from "@/lib/auth/roles";
import { db } from "@/lib/db";

const MOT_DE_PASSE = "MotDePasse2026!";

async function creerCompte(email: string, username: string) {
  return db.user.create({
    data: {
      email,
      passwordHash: await hacherMotDePasse(MOT_DE_PASSE),
      profile: { create: { username, displayName: "Awa Diallo" } },
    },
    select: { id: true, email: true, passwordHash: true },
  });
}

/** Reproduit ce que fait `ouvrirSession` : la base ne voit qu'une empreinte. */
async function ouvrirSessionBrute(userId: string) {
  const jeton = randomBytes(32).toString("base64url");
  await db.session.create({
    data: {
      userId,
      token: createHash("sha256").update(jeton).digest("hex"),
      expiresAt: new Date(Date.now() + 30 * 86_400_000),
    },
  });
  return jeton;
}

describe("inscription", () => {
  let compte: Awaited<ReturnType<typeof creerCompte>>;

  beforeEach(async () => {
    compte = await creerCompte("awa@baobart.test", "awa-diallo");
  });

  it("n'écrit jamais le mot de passe en clair", async () => {
    expect(compte.passwordHash).not.toContain(MOT_DE_PASSE);
    expect(compte.passwordHash?.startsWith("scrypt$")).toBe(true);
  });

  it("crée le profil avec le compte, en une seule écriture", async () => {
    const profil = await db.profile.findUnique({
      where: { userId: compte.id },
      select: { username: true, displayName: true },
    });

    expect(profil).toMatchObject({
      username: "awa-diallo",
      displayName: "Awa Diallo",
    });
  });

  it("refuse deux comptes sur la même adresse", async () => {
    await expect(
      creerCompte("awa@baobart.test", "awa-2"),
    ).rejects.toThrow();
  });

  it("refuse deux profils sur le même nom d'utilisateur", async () => {
    await expect(
      creerCompte("autre@baobart.test", "awa-diallo"),
    ).rejects.toThrow();
  });
});

describe("connexion", () => {
  it("accepte le bon mot de passe, refuse un mot de passe voisin", async () => {
    const compte = await creerCompte("kofi@baobart.test", "kofi-mensah");

    expect(await verifierMotDePasse(MOT_DE_PASSE, compte.passwordHash)).toBe(true);
    expect(await verifierMotDePasse("MotDePasse2026", compte.passwordHash)).toBe(
      false,
    );
  });

  it("ne reconnaît pas le mot de passe d'un autre compte", async () => {
    // Deux comptes au même mot de passe ont deux empreintes différentes : le
    // sel empêche de les rapprocher dans la base.
    const a = await creerCompte("a@baobart.test", "compte-a");
    const b = await creerCompte("b@baobart.test", "compte-b");

    expect(a.passwordHash).not.toBe(b.passwordHash);
    expect(await verifierMotDePasse(MOT_DE_PASSE, b.passwordHash)).toBe(true);
  });
});

describe("session", () => {
  it("ne stocke que l'empreinte du jeton, jamais le jeton", async () => {
    const compte = await creerCompte("session@baobart.test", "compte-session");
    const jeton = await ouvrirSessionBrute(compte.id);

    const enBase = await db.session.findFirst({
      where: { userId: compte.id },
      select: { token: true },
    });

    expect(enBase!.token).not.toBe(jeton);
    expect(enBase!.token).toHaveLength(64); // SHA-256 en hexadécimal
  });

  it("retrouve la session par l'empreinte du jeton présenté", async () => {
    const compte = await creerCompte("retrouve@baobart.test", "compte-retrouve");
    const jeton = await ouvrirSessionBrute(compte.id);

    const trouvee = await db.session.findUnique({
      where: { token: createHash("sha256").update(jeton).digest("hex") },
      select: { userId: true },
    });

    expect(trouvee?.userId).toBe(compte.id);
  });

  it("ne retrouve rien avec un jeton voisin", async () => {
    const compte = await creerCompte("voisin@baobart.test", "compte-voisin");
    const jeton = await ouvrirSessionBrute(compte.id);

    const trouvee = await db.session.findUnique({
      where: {
        token: createHash("sha256").update(`${jeton}x`).digest("hex"),
      },
    });

    expect(trouvee).toBeNull();
  });

  it("ferme toutes les sessions d'un compte d'un coup", async () => {
    const compte = await creerCompte("multi@baobart.test", "compte-multi");
    await ouvrirSessionBrute(compte.id);
    await ouvrirSessionBrute(compte.id);

    expect(await db.session.count({ where: { userId: compte.id } })).toBe(2);

    await db.session.deleteMany({ where: { userId: compte.id } });

    expect(await db.session.count({ where: { userId: compte.id } })).toBe(0);
  });
});

describe("rôle dérivé, contre la base", () => {
  it("publier fait basculer les capacités, sans toucher à un champ", async () => {
    const compte = await creerCompte("createur@baobart.test", "compte-createur");

    const avant = await capacitesDe(compte.id);
    expect(avant).toMatchObject({ estCreateur: false, estAcheteur: false });

    await db.product.create({
      data: {
        sellerId: compte.id,
        slug: "premiere-ressource",
        name: "Première ressource",
        price: 5_000,
        status: "PUBLISHED",
      },
    });

    const apres = await capacitesDe(compte.id);
    expect(apres.estCreateur).toBe(true);
    expect(apres.vueParDefaut).toBe("createur");
  });

  it("un brouillon ne fait pas de vous un créateur", async () => {
    const compte = await creerCompte("brouillon@baobart.test", "compte-brouillon");

    await db.product.create({
      data: {
        sellerId: compte.id,
        slug: "pas-encore-prete",
        name: "Pas encore prête",
        price: 0,
        status: "DRAFT",
      },
    });

    expect((await capacitesDe(compte.id)).estCreateur).toBe(false);
  });

  it("l'intention déclarée oriente l'accueil sans rien autoriser", async () => {
    const compte = await db.user.create({
      data: {
        email: "intention@baobart.test",
        passwordHash: await hacherMotDePasse(MOT_DE_PASSE),
        intention: "CREATEUR",
        profile: { create: { username: "compte-intention", displayName: "Kofi" } },
      },
      select: { id: true },
    });

    const c = await capacitesDe(compte.id);
    expect(c.vueParDefaut).toBe("createur");
    expect(c.estCreateur).toBe(false);
  });

  it("sépare le profil public des informations de facturation", async () => {
    const compte = await db.user.create({
      data: {
        email: "facturation@baobart.test",
        passwordHash: await hacherMotDePasse(MOT_DE_PASSE),
        profile: { create: { username: "compte-fact", displayName: "Awa Diallo" } },
        billing: {
          create: {
            firstName: "Awa",
            lastName: "Diallo",
            addressLine1: "12 rue de la Corniche",
            city: "Dakar",
            country: "SN",
          },
        },
      },
      select: { id: true },
    });

    // Le profil public ne porte aucune adresse : la lire demande de viser
    // explicitement la facturation.
    const profil = await db.profile.findUnique({ where: { userId: compte.id } });
    expect(profil).not.toHaveProperty("addressLine1");

    const facturation = await db.billingInfo.findUnique({
      where: { userId: compte.id },
      select: { addressLine1: true },
    });
    expect(facturation?.addressLine1).toBe("12 rue de la Corniche");
  });
});
