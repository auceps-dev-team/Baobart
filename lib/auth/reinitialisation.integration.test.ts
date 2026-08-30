/**
 * Réinitialisation du mot de passe, contre la vraie base.
 *
 * Ce qu'on éprouve ici n'est pas « ça marche » — c'est la liste des choses qui
 * ne doivent surtout pas marcher : un jeton resservi, un jeton périmé, un jeton
 * qu'une nouvelle demande a rendu caduc, deux envois simultanés du même
 * formulaire. Chacune de ces situations, laissée ouverte, donne la main sur un
 * compte à quelqu'un qui a lu un vieux courriel.
 */

import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";

import { hacherMotDePasse, verifierMotDePasse } from "@/lib/auth/password";
import {
  changerMotDePasse,
  creerJeton,
  demanderReinitialisation,
  verifierJeton,
} from "@/lib/auth/reinitialisation";
import { db } from "@/lib/db";

const ANCIEN = "AncienMotDePasse2026!";
const NOUVEAU = "NouveauMotDePasse2026!";

async function creerCompte(email: string) {
  return db.user.create({
    data: {
      email,
      passwordHash: await hacherMotDePasse(ANCIEN),
      profile: { create: { username: email.split("@")[0]!, displayName: "Awa Diallo" } },
    },
    select: { id: true, email: true },
  });
}

function empreinte(jeton: string): string {
  return createHash("sha256").update(jeton, "utf8").digest("hex");
}

async function motDePasseDe(userId: string): Promise<string> {
  const u = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });
  return u.passwordHash!;
}

beforeEach(() => {
  process.env.APP_URL = "https://baobart.test";
});

describe("le jeton", () => {
  it("n'est jamais écrit en clair dans la base", async () => {
    const u = await creerCompte("empreinte@exemple.com");
    const jeton = await creerJeton(u.id);

    const enBase = await db.passwordReset.findFirstOrThrow({
      where: { userId: u.id },
      select: { token: true },
    });

    expect(enBase.token).not.toBe(jeton);
    expect(enBase.token).toBe(empreinte(jeton));
  });

  it("ouvre le changement tant qu'il est frais", async () => {
    const u = await creerCompte("frais@exemple.com");
    const jeton = await creerJeton(u.id);

    const verif = await verifierJeton(jeton);
    expect(verif.valide).toBe(true);
  });

  it("ne sert qu'une fois", async () => {
    const u = await creerCompte("unique@exemple.com");
    const jeton = await creerJeton(u.id);

    expect(await changerMotDePasse(jeton, NOUVEAU)).toEqual({ fait: true });

    const second = await changerMotDePasse(jeton, "EncoreAutreChose2026!");
    expect(second).toEqual({ fait: false, motif: "expire" });

    // Le second essai n'a rien écrit : c'est le premier mot de passe qui tient.
    expect(await verifierMotDePasse(NOUVEAU, await motDePasseDe(u.id))).toBe(true);
  });

  it("cesse d'ouvrir passé son heure", async () => {
    const u = await creerCompte("perime@exemple.com");
    const jeton = await creerJeton(u.id);

    await db.passwordReset.updateMany({
      where: { userId: u.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    expect(await verifierJeton(jeton)).toEqual({ valide: false, motif: "expire" });
    expect(await changerMotDePasse(jeton, NOUVEAU)).toEqual({
      fait: false,
      motif: "expire",
    });
    expect(await verifierMotDePasse(ANCIEN, await motDePasseDe(u.id))).toBe(true);
  });

  it("devient caduc dès qu'on en demande un autre", async () => {
    const u = await creerCompte("remplace@exemple.com");
    const premier = await creerJeton(u.id);
    const second = await creerJeton(u.id);

    expect(await verifierJeton(premier)).toEqual({ valide: false, motif: "expire" });
    expect((await verifierJeton(second)).valide).toBe(true);
  });

  it("inconnu ne dit rien de plus qu'inconnu", async () => {
    expect(await verifierJeton("un-jeton-qui-n-existe-pas-du-tout")).toEqual({
      valide: false,
      motif: "inconnu",
    });
  });
});

describe("le changement", () => {
  it("pose bien le nouveau mot de passe et abandonne l'ancien", async () => {
    const u = await creerCompte("change@exemple.com");
    const jeton = await creerJeton(u.id);

    await changerMotDePasse(jeton, NOUVEAU);

    const hache = await motDePasseDe(u.id);
    expect(await verifierMotDePasse(NOUVEAU, hache)).toBe(true);
    expect(await verifierMotDePasse(ANCIEN, hache)).toBe(false);
  });

  it("ferme toutes les sessions ouvertes", async () => {
    const u = await creerCompte("sessions@exemple.com");
    await db.session.createMany({
      data: [
        {
          userId: u.id,
          token: empreinte("a"),
          expiresAt: new Date(Date.now() + 86_400_000),
        },
        {
          userId: u.id,
          token: empreinte("b"),
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      ],
    });

    const jeton = await creerJeton(u.id);
    await changerMotDePasse(jeton, NOUVEAU);

    // Le cas qu'on traite est souvent « quelqu'un d'autre est entré chez moi ».
    // Lui laisser sa session viderait le geste de son sens.
    expect(await db.session.count({ where: { userId: u.id } })).toBe(0);
  });

  it("refuse un mot de passe trop faible sans consommer le jeton", async () => {
    const u = await creerCompte("faible@exemple.com");
    const jeton = await creerJeton(u.id);

    const suite = await changerMotDePasse(jeton, "abc");
    expect(suite.fait).toBe(false);

    // Le jeton reste utilisable : sinon une faute de frappe obligerait à
    // recommencer toute la démarche, courriel compris.
    expect((await verifierJeton(jeton)).valide).toBe(true);
  });

  it("n'en laisse passer qu'un seul quand deux partent ensemble", async () => {
    const u = await creerCompte("course@exemple.com");
    const jeton = await creerJeton(u.id);

    const [a, b] = await Promise.all([
      changerMotDePasse(jeton, NOUVEAU),
      changerMotDePasse(jeton, "UnTroisiemeMotDePasse2026!"),
    ]);

    expect([a.fait, b.fait].filter(Boolean)).toHaveLength(1);
  });
});

describe("la demande", () => {
  it("dépose un courriel portant le lien", async () => {
    const u = await creerCompte("depot@exemple.com");

    expect(await demanderReinitialisation(u.email)).toEqual({ fait: true });

    const envoi = await db.emailOutbox.findFirstOrThrow({
      where: { recipient: u.email },
      select: { template: true, payload: true },
    });

    expect(envoi.template).toBe("REINITIALISATION_MOT_DE_PASSE");
    const charge = envoi.payload as { lien: string; heures: number };
    expect(charge.lien.startsWith("https://baobart.test/reinitialiser/")).toBe(true);
    expect(charge.heures).toBe(1);

    // Le lien porte le jeton en clair — c'est son empreinte qui est en base.
    const jeton = charge.lien.split("/").pop()!;
    expect((await verifierJeton(jeton)).valide).toBe(true);
  });

  it("répond pareil pour une adresse inconnue, et n'écrit rien", async () => {
    const suite = await demanderReinitialisation("personne@exemple.com");

    expect(suite).toEqual({ fait: true });
    expect(
      await db.emailOutbox.count({ where: { recipient: "personne@exemple.com" } }),
    ).toBe(0);
  });

  it("cesse d'envoyer au-delà du plafond, sans le dire", async () => {
    const u = await creerCompte("plafond@exemple.com");

    for (let i = 0; i < 5; i++) {
      expect(await demanderReinitialisation(u.email)).toEqual({ fait: true });
    }

    // Une boîte mail n'est pas une arme : on borne ce qu'on y déverse, et on
    // rend la même réponse pour ne pas signaler que le compte existe.
    const envoyes = await db.emailOutbox.count({ where: { recipient: u.email } });
    expect(envoyes).toBe(3);
  });

  it("refuse franchement quand l'adresse du site manque", async () => {
    delete process.env.APP_URL;
    const u = await creerCompte("sansurl@exemple.com");

    expect(await demanderReinitialisation(u.email)).toEqual({
      fait: false,
      motif: "site_non_configure",
    });
    expect(await db.emailOutbox.count({ where: { recipient: u.email } })).toBe(0);
  });
});
