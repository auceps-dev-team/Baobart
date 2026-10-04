/**
 * La lettre d'information : inscription confirmée, désinscription par lien.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { RELANCE_MIN_MS, VALIDITE_JOURS, confirmer, desinscrire, inscrire } from "@/lib/infolettre/service";

const AVANT = process.env.APP_URL;
beforeEach(() => {
  process.env.APP_URL = "https://baobart.test";
});
afterEach(() => {
  if (AVANT === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = AVANT;
});

let n = 0;
const adresse = () => `lettre-${++n}-${Math.random().toString(36).slice(2, 7)}@baobart.test`;

/** Les deux jetons en clair, tels que le courriel les porte. */
async function liens(email: string) {
  const envois = await db.emailOutbox.findMany({ where: { recipient: email, template: "INFOLETTRE_CONFIRMATION" }, orderBy: { createdAt: "desc" } });
  const charge = envois[0]!.payload as { confirmer: string; desinscrire: string; jours: number };
  return {
    envois: envois.length,
    jours: charge.jours,
    confirmer: new URL(charge.confirmer).searchParams.get("jeton")!,
    desinscrire: new URL(charge.desinscrire).searchParams.get("jeton")!,
  };
}

describe("la lettre d'information", () => {
  it("n'inscrit qu'après le clic sur le lien de confirmation", async () => {
    const email = adresse();
    expect(await inscrire(`  ${email.toUpperCase()} `)).toEqual({ fait: true });

    const ligne = await db.newsletterSubscriber.findUniqueOrThrow({ where: { email } });
    expect(ligne).toMatchObject({ status: "PENDING", confirmedAt: null });
    const l = await liens(email);
    expect(l.jours).toBe(VALIDITE_JOURS);
    // La base ne garde que l'empreinte : le jeton du courriel n'y figure pas.
    expect(ligne.confirmTokenHash).not.toBe(l.confirmer);

    expect(await confirmer(l.confirmer)).toEqual({ ok: true });
    expect(await db.newsletterSubscriber.findUniqueOrThrow({ where: { email } })).toMatchObject({ status: "CONFIRMED", confirmedAt: expect.any(Date) });
  });

  it("répond pareil à une adresse déjà inscrite, sans lui écrire", async () => {
    const email = adresse();
    await inscrire(email);
    await confirmer((await liens(email)).confirmer);

    expect(await inscrire(email)).toEqual({ fait: true });
    expect((await liens(email)).envois).toBe(1);
  });

  it("ne renvoie pas de lien à chaque clic, mais en renvoie un plus tard", async () => {
    const email = adresse();
    await inscrire(email);
    await inscrire(email);
    expect((await liens(email)).envois).toBe(1);

    const plusTard = new Date(Date.now() + RELANCE_MIN_MS + 1_000);
    await inscrire(email, plusTard);
    expect((await liens(email)).envois).toBe(2);
  });

  it("refuse un lien expiré, et un lien d'avant une désinscription", async () => {
    const email = adresse();
    await inscrire(email);
    const l = await liens(email);
    const apres = new Date(Date.now() + (VALIDITE_JOURS + 1) * 86_400_000);
    expect(await confirmer(l.confirmer, apres)).toEqual({ ok: false, motif: "EXPIRE" });

    expect(await desinscrire(l.desinscrire)).toEqual({ ok: true });
    expect(await confirmer(l.confirmer)).toEqual({ ok: false, motif: "DESINSCRITE" });
    expect(await db.newsletterSubscriber.findUniqueOrThrow({ where: { email } })).toMatchObject({ status: "UNSUBSCRIBED" });
  });

  it("désinscrit une adresse confirmée, et ignore un jeton inventé", async () => {
    const email = adresse();
    await inscrire(email);
    const l = await liens(email);
    await confirmer(l.confirmer);

    expect(await desinscrire("x".repeat(43))).toEqual({ ok: false, motif: "INCONNU" });
    expect(await desinscrire(l.desinscrire)).toEqual({ ok: true });
    expect(await db.newsletterSubscriber.findUniqueOrThrow({ where: { email } })).toMatchObject({ status: "UNSUBSCRIBED", unsubscribedAt: expect.any(Date) });
  });

  it("n'écrit rien sans adresse du site, ni à une adresse invalide", async () => {
    expect(await inscrire("pas-une-adresse")).toEqual({ fait: false, motif: "adresse_invalide" });
    delete process.env.APP_URL;
    const email = adresse();
    expect(await inscrire(email)).toEqual({ fait: false, motif: "site_non_configure" });
    expect(await db.newsletterSubscriber.count({ where: { email } })).toBe(0);
  });
});
