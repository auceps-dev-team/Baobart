/**
 * L'envoi d'un numéro de la lettre : aux confirmées seules, une fois, avec un
 * lien de désinscription qui marche.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { enregistrerNumero, envoyerNumero } from "@/lib/infolettre/envoi";
import { desinscrire } from "@/lib/infolettre/service";

const AVANT = { APP_URL: process.env.APP_URL, AUTH_SECRET: process.env.AUTH_SECRET };
beforeEach(() => {
  process.env.APP_URL = "https://baobart.test";
  process.env.AUTH_SECRET = "un-secret-de-test-assez-long-pour-signer";
});
afterEach(() => {
  for (const [k, v] of Object.entries(AVANT)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

let n = 0;
async function abonne(status: "PENDING" | "CONFIRMED" | "UNSUBSCRIBED") {
  n += 1;
  const s = `${n}-${Math.random().toString(36).slice(2, 7)}`;
  return db.newsletterSubscriber.create({
    data: { email: `lettre-${s}@baobart.test`, status, confirmTokenHash: `c-${s}`, unsubscribeTokenHash: `d-${s}`, confirmExpiresAt: new Date() },
    select: { id: true, email: true },
  });
}

async function brouillon() {
  const r = await enregistrerNumero({ sujet: "Les nouveautés d'octobre", corps: "Trois nouvelles familles de ressources arrivent ce mois-ci.", parId: "equipe" });
  if (!r.ok) throw new Error("brouillon");
  return r.id;
}

describe("l'envoi d'un numéro", () => {
  it("part aux seules adresses confirmées, chacune avec son lien de désinscription", async () => {
    const oui = await abonne("CONFIRMED");
    const oui2 = await abonne("CONFIRMED");
    await abonne("PENDING");
    await abonne("UNSUBSCRIBED");
    const id = await brouillon();

    expect(await envoyerNumero({ id, parId: "equipe" })).toEqual({ ok: true, destinataires: 2 });
    const envois = await db.emailOutbox.findMany({ where: { template: "INFOLETTRE" }, select: { recipient: true, payload: true } });
    expect(envois.map((e) => e.recipient).sort()).toEqual([oui.email, oui2.email].sort());
    expect(await db.newsletterIssue.findUniqueOrThrow({ where: { id }, select: { status: true, recipients: true } })).toEqual({ status: "SENT", recipients: 2 });

    // Le lien du courriel désinscrit vraiment — et seulement son destinataire.
    const lien = (envois.find((e) => e.recipient === oui.email)!.payload as { desinscrire: string }).desinscrire;
    const jeton = new URL(lien).searchParams.get("jeton")!;
    expect(await desinscrire(jeton)).toEqual({ ok: true });
    expect(await db.newsletterSubscriber.findUniqueOrThrow({ where: { id: oui.id }, select: { status: true } })).toEqual({ status: "UNSUBSCRIBED" });
    expect(await db.newsletterSubscriber.findUniqueOrThrow({ where: { id: oui2.id }, select: { status: true } })).toEqual({ status: "CONFIRMED" });
  });

  it("ne part qu'une fois, même en deux clics, et ne se réécrit plus", async () => {
    await abonne("CONFIRMED");
    const id = await brouillon();
    const [a, b] = await Promise.all([envoyerNumero({ id, parId: "equipe" }), envoyerNumero({ id, parId: "equipe" })]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    expect(await db.emailOutbox.count({ where: { template: "INFOLETTRE" } })).toBe(1);
    expect(await enregistrerNumero({ id, sujet: "Autre objet", corps: "Un autre texte assez long pour passer.", parId: "equipe" })).toEqual({ ok: false, motif: "DEJA_ENVOYE" });
  });

  it("refuse un jeton signé falsifié", async () => {
    const a = await abonne("CONFIRMED");
    expect(await desinscrire(`${a.id}.${"x".repeat(43)}`)).toEqual({ ok: false, motif: "INCONNU" });
    expect(await db.newsletterSubscriber.findUniqueOrThrow({ where: { id: a.id }, select: { status: true } })).toEqual({ status: "CONFIRMED" });
  });

  it("ne part pas sans secret de signature, ni sans abonné — et reste un brouillon", async () => {
    const id = await brouillon();
    expect(await envoyerNumero({ id, parId: "equipe" })).toEqual({ ok: false, motif: "AUCUN_ABONNE" });
    await abonne("CONFIRMED");
    delete process.env.AUTH_SECRET;
    expect(await envoyerNumero({ id, parId: "equipe" })).toEqual({ ok: false, motif: "SITE_NON_CONFIGURE" });
    expect(await db.newsletterIssue.findUniqueOrThrow({ where: { id }, select: { status: true } })).toEqual({ status: "DRAFT" });
    expect(await db.emailOutbox.count({ where: { template: "INFOLETTRE" } })).toBe(0);
  });
});
