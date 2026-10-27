/**
 * Le bouton « Contact » d'une vitrine, contre la base : ce qui part, ce qui
 * reste, et ce qui ne sort jamais — l'adresse du créateur.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PLAFOND_PAR_CREATEUR } from "@/lib/contact/createur";
import { ecrireAuCreateur, reglerLesMessages } from "@/lib/contact/createur-service";
import { db } from "@/lib/db";

let n = 0;
const avant = process.env.APP_URL;

beforeAll(() => {
  process.env.APP_URL = "https://baobart.test";
});
afterAll(() => {
  if (avant === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = avant;
});

async function compte(options: { profil?: boolean; ouvert?: boolean } = {}) {
  n += 1;
  const s = `${n}-${Math.random().toString(36).slice(2, 7)}`;
  return db.user.create({
    data: {
      email: `contact-createur-${s}@baobart.test`,
      ...(options.profil === false
        ? {}
        : {
            profile: {
              create: {
                username: `vitrine-${s}`,
                displayName: `Vitrine ${s}`,
                acceptsMessages: options.ouvert ?? true,
              },
            },
          }),
    },
    select: { id: true, email: true, profile: { select: { username: true } } },
  });
}

const MESSAGE = { sujet: "Une affiche pour notre festival", corps: "Bonjour, nous aimerions vous confier l'affiche de mars." };

describe("écrire à un créateur", () => {
  it("garde le message et dépose son courriel, l'adresse de l'expéditeur en « Répondre à »", async () => {
    const createur = await compte();
    const visiteur = await compte();

    const issue = await ecrireAuCreateur({ expediteurId: visiteur.id, username: createur.profile!.username, ...MESSAGE });
    expect(issue.ok).toBe(true);
    if (!issue.ok) return;

    const garde = await db.creatorMessage.findUniqueOrThrow({ where: { id: issue.id } });
    expect(garde).toMatchObject({ senderId: visiteur.id, recipientId: createur.id, subject: MESSAGE.sujet });

    const courriel = await db.emailOutbox.findUniqueOrThrow({ where: { idempotencyKey: `courriel:message-createur-${issue.id}` } });
    expect(courriel.recipient).toBe(createur.email);
    expect(courriel.template).toBe("MESSAGE_CREATEUR");
    expect((courriel.payload as { repondreA: string }).repondreA).toBe(visiteur.email);
  });

  it("ne rend jamais l'adresse du créateur à l'appelant", async () => {
    const createur = await compte();
    const visiteur = await compte();

    const issue = await ecrireAuCreateur({ expediteurId: visiteur.id, username: createur.profile!.username, ...MESSAGE });
    expect(JSON.stringify(issue)).not.toContain(createur.email);
  });

  it("refuse quand le créateur a fermé son bouton, sans rien garder", async () => {
    const createur = await compte({ ouvert: false });
    const visiteur = await compte();

    expect(await ecrireAuCreateur({ expediteurId: visiteur.id, username: createur.profile!.username, ...MESSAGE })).toEqual({ ok: false, refus: "FERME" });
    expect(await db.creatorMessage.count({ where: { senderId: visiteur.id } })).toBe(0);
  });

  it("refuse de s'écrire à soi-même", async () => {
    const createur = await compte();
    expect(await ecrireAuCreateur({ expediteurId: createur.id, username: createur.profile!.username, ...MESSAGE })).toEqual({ ok: false, refus: "SOI_MEME" });
  });

  it("répond « introuvable » pour une vitrine suspendue, comme pour une vitrine qui n'existe pas", async () => {
    const createur = await compte();
    const visiteur = await compte();
    await db.user.update({ where: { id: createur.id }, data: { suspendedAt: new Date() } });

    const suspendue = await ecrireAuCreateur({ expediteurId: visiteur.id, username: createur.profile!.username, ...MESSAGE });
    const inconnue = await ecrireAuCreateur({ expediteurId: visiteur.id, username: `personne-${n}-${Date.now()}`, ...MESSAGE });
    expect(suspendue).toEqual({ ok: false, refus: "INTROUVABLE" });
    expect(inconnue).toEqual(suspendue);
  });

  it(`s'arrête à ${PLAFOND_PAR_CREATEUR} messages au même créateur en vingt-quatre heures`, async () => {
    const createur = await compte();
    const visiteur = await compte();
    const ecrire = () => ecrireAuCreateur({ expediteurId: visiteur.id, username: createur.profile!.username, ...MESSAGE });

    for (let i = 0; i < PLAFOND_PAR_CREATEUR; i++) expect((await ecrire()).ok).toBe(true);
    expect(await ecrire()).toEqual({ ok: false, refus: "PLAFOND_CREATEUR" });
  });

  it("ne laisse pas huit envois simultanés dépasser le plafond", async () => {
    // Le double clic, en pire. Avant le verrou (27/10), les comptes se lisaient
    // hors transaction : chacun voyait zéro, et tous passaient.
    const createur = await compte();
    const visiteur = await compte();

    const issues = await Promise.all(
      Array.from({ length: 8 }, () => ecrireAuCreateur({ expediteurId: visiteur.id, username: createur.profile!.username, ...MESSAGE })),
    );

    expect(issues.filter((i) => i.ok)).toHaveLength(PLAFOND_PAR_CREATEUR);
    expect(issues.filter((i) => !i.ok).every((i) => !i.ok && i.refus === "PLAFOND_CREATEUR")).toBe(true);
    expect(await db.creatorMessage.count({ where: { senderId: visiteur.id } })).toBe(PLAFOND_PAR_CREATEUR);
    // Un courriel par message gardé, pas un de plus.
    expect(await db.emailOutbox.count({ where: { template: "MESSAGE_CREATEUR", recipient: createur.email } })).toBe(PLAFOND_PAR_CREATEUR);
  }, 60_000);

  it("refuse sans adresse du site plutôt que d'envoyer des liens morts", async () => {
    const createur = await compte();
    const visiteur = await compte();
    delete process.env.APP_URL;
    try {
      expect(await ecrireAuCreateur({ expediteurId: visiteur.id, username: createur.profile!.username, ...MESSAGE })).toEqual({ ok: false, refus: "INDISPONIBLE" });
      expect(await db.creatorMessage.count({ where: { senderId: visiteur.id } })).toBe(0);
    } finally {
      process.env.APP_URL = "https://baobart.test";
    }
  });
});

describe("l'interrupteur du profil", () => {
  it("pose l'état demandé, et deux « fermer » le laissent fermé", async () => {
    const createur = await compte();

    expect(await reglerLesMessages(createur.id, false)).toBe(true);
    expect(await reglerLesMessages(createur.id, false)).toBe(true);
    expect((await db.profile.findUniqueOrThrow({ where: { userId: createur.id } })).acceptsMessages).toBe(false);

    expect(await reglerLesMessages(createur.id, true)).toBe(true);
    expect((await db.profile.findUniqueOrThrow({ where: { userId: createur.id } })).acceptsMessages).toBe(true);
  });

  it("rend faux sans profil : il n'y a pas de vitrine où le bouton apparaîtrait", async () => {
    const sansVitrine = await compte({ profil: false });
    expect(await reglerLesMessages(sansVitrine.id, false)).toBe(false);
  });
});
