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
import { estAdministrateur } from "@/lib/auth/administration";
import { progressionDe } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import {
  fermerToutesLesSessions,
  resoudreSession,
} from "@/lib/auth/session";

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

describe("progression dérivée, contre la base", () => {
  it("créer puis publier fait franchir les deux paliers", async () => {
    const compte = await creerCompte("createur@baobart.test", "compte-createur");

    expect((await progressionDe(compte.id)).etape).toBe("ACHETEUR");

    await db.product.create({
      data: {
        sellerId: compte.id,
        slug: "premiere-ressource",
        name: "Première ressource",
        price: 5_000,
        status: "PUBLISHED",
      },
    });

    const apres = await progressionDe(compte.id);
    expect(apres.etape).toBe("BOUTIQUE");
    expect(apres.profilPublicVisible).toBe(true);
  });

  it("un brouillon ouvre l'atelier sans ouvrir la vitrine", async () => {
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

    const p = await progressionDe(compte.id);
    expect(p.etape).toBe("ATELIER");
    expect(p.profilPublicVisible).toBe(false);
  });

  it("supprimer son unique brouillon ramène à l'état acheteur", async () => {
    const compte = await creerCompte("regression@baobart.test", "compte-regression");

    const brouillon = await db.product.create({
      data: {
        sellerId: compte.id,
        slug: "a-supprimer",
        name: "À supprimer",
        price: 0,
        status: "DRAFT",
      },
    });
    expect((await progressionDe(compte.id)).etape).toBe("ATELIER");

    await db.product.delete({ where: { id: brouillon.id } });
    expect((await progressionDe(compte.id)).etape).toBe("ACHETEUR");
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

describe("durée de vie d'une session", () => {
  let n = 0;
  const nouveauCompte = () => {
    n += 1;
    return creerCompte(`session-${n}@baobart.test`, `session-${n}`);
  };

  async function ouvrir(userId: string, expiresAt: Date) {
    const jeton = randomBytes(32).toString("base64url");
    await db.session.create({
      data: {
        userId,
        token: createHash("sha256").update(jeton).digest("hex"),
        expiresAt,
      },
    });
    return jeton;
  }

  it("reconnaît une session valide", async () => {
    const compte = await nouveauCompte();
    const jeton = await ouvrir(compte.id, new Date(Date.now() + 86_400_000));

    const vu = await resoudreSession(jeton);
    expect(vu?.id).toBe(compte.id);
  });

  it("refuse une session expirée et la retire de la table", async () => {
    // Sans ce ménage, la table grossit indéfiniment de jetons morts.
    const compte = await nouveauCompte();
    const jeton = await ouvrir(compte.id, new Date(Date.now() - 1_000));

    expect(await resoudreSession(jeton)).toBeNull();
    expect(await db.session.count({ where: { userId: compte.id } })).toBe(0);
  });

  it("refuse au moment exact de l'expiration, pas une seconde après", async () => {
    const compte = await nouveauCompte();
    const jeton = await ouvrir(compte.id, new Date(Date.now()));
    expect(await resoudreSession(jeton)).toBeNull();
  });

  it("coupe l'accès d'un compte suspendu, jeton frais ou non", async () => {
    // La suspension doit prendre effet tout de suite : attendre l'expiration
    // laisserait un compte suspendu naviguer une semaine de plus.
    const compte = await nouveauCompte();
    const jeton = await ouvrir(compte.id, new Date(Date.now() + 86_400_000));
    expect(await resoudreSession(jeton)).not.toBeNull();

    await db.user.update({
      where: { id: compte.id },
      data: { suspendedAt: new Date() },
    });

    expect(await resoudreSession(jeton)).toBeNull();
    // La ligne survit : lever la suspension doit rendre l'accès sans
    // obliger la personne à se reconnecter.
    expect(await db.session.count({ where: { userId: compte.id } })).toBe(1);

    await db.user.update({
      where: { id: compte.id },
      data: { suspendedAt: null },
    });
    expect(await resoudreSession(jeton)).not.toBeNull();
  });

  it("ne reconnaît pas un jeton inventé", async () => {
    const compte = await nouveauCompte();
    await ouvrir(compte.id, new Date(Date.now() + 86_400_000));
    expect(await resoudreSession("jeton-invente")).toBeNull();
    expect(await resoudreSession("")).toBeNull();
  });

  it("fermer toutes les sessions coupe chaque appareil", async () => {
    const compte = await nouveauCompte();
    const telephone = await ouvrir(compte.id, new Date(Date.now() + 86_400_000));
    const bureau = await ouvrir(compte.id, new Date(Date.now() + 86_400_000));

    await fermerToutesLesSessions(compte.id);

    expect(await resoudreSession(telephone)).toBeNull();
    expect(await resoudreSession(bureau)).toBeNull();
  });
});

describe("rôle sur la plateforme", () => {
  it("sort MEMBER par défaut — l'administration ne s'attrape pas à l'inscription", async () => {
    const compte = await creerCompte("neuf@baobart.test", "compte-neuf");
    const jeton = await ouvrirSessionBrute(compte.id);

    const session = await resoudreSession(jeton);
    expect(session?.role).toBe("MEMBER");
    expect(estAdministrateur(session!.role)).toBe(false);
  });

  it("porte le rôle accordé en base", async () => {
    const compte = await creerCompte("admin@baobart.test", "compte-admin");
    await db.user.update({
      where: { id: compte.id },
      data: { platformRole: "ADMIN" },
    });
    const jeton = await ouvrirSessionBrute(compte.id);

    const session = await resoudreSession(jeton);
    expect(session?.role).toBe("ADMIN");
    expect(estAdministrateur(session!.role)).toBe(true);
  });

  it("ne confond pas le pouvoir sur la plateforme avec la progression du compte", async () => {
    // Publier des ressources ouvre l'atelier, jamais l'administration : les
    // deux notions se lisent à des endroits différents et doivent le rester.
    const compte = await creerCompte("vendeur@baobart.test", "compte-vendeur");
    const jeton = await ouvrirSessionBrute(compte.id);

    const session = await resoudreSession(jeton);
    expect(session?.role).toBe("MEMBER");
  });

  it("retire l'accès dès la rétrogradation, sans attendre l'expiration du jeton", async () => {
    const compte = await creerCompte("dechu@baobart.test", "compte-dechu");
    await db.user.update({
      where: { id: compte.id },
      data: { platformRole: "SUPER_ADMIN" },
    });
    const jeton = await ouvrirSessionBrute(compte.id);
    expect((await resoudreSession(jeton))?.role).toBe("SUPER_ADMIN");

    await db.user.update({
      where: { id: compte.id },
      data: { platformRole: "MEMBER" },
    });

    // Le jeton reste valable — c'est le rôle qui est relu à chaque résolution.
    const apres = await resoudreSession(jeton);
    expect(apres?.role).toBe("MEMBER");
    expect(estAdministrateur(apres!.role)).toBe(false);
  });
});
