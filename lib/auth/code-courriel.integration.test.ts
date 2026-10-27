/**
 * Le code par courriel du compte de versement, contre la base.
 *
 * Ce qu'on éprouve, ce sont les gardes qui font d'un code à six chiffres un
 * second facteur : cinq essais par code, même lancés ensemble ; un seul code
 * vivant ; une minute entre deux envois ; quinze minutes de vie ; et le lien au
 * compte qu'il annonce. Aucun réseau : le courriel reste dans la file.
 */

import { describe, expect, it } from "vitest";

import {
  ATTENTE_RENVOI_COURRIEL_MS,
  DUREE_CODE_COURRIEL_MS,
  ESSAIS_MAX_COURRIEL,
  adresseMasquee,
  cibleDe,
  emettreCodeCourriel,
  purgerCodesCourriel,
  verifierCodeCourriel,
} from "@/lib/auth/code-courriel";
import { db } from "@/lib/db";

let n = 0;

async function compte() {
  n += 1;
  const marque = `codec-${n}-${Math.random().toString(36).slice(2, 7)}`;
  return db.user.create({
    data: { email: `${marque}@baobart.test`, profile: { create: { username: marque, displayName: "Awa Diallo" } } },
    select: { id: true, email: true },
  });
}

const WAVE = cibleDe("wave", "+2250700112233");
const OM = cibleDe("om", "+2250500998877");

async function emettre(userId: string, maintenant = new Date(), cible = WAVE) {
  return emettreCodeCourriel({ userId, but: "PAYOUT_ACCOUNT", cible, destination: "Wave — ···· 2233", maintenant });
}

/**
 * Le code tel qu'il est parti dans le courriel — c'est là qu'on le lit en
 * développement aussi. Par la clé du courriel, qui porte l'identifiant du
 * code : deux courriels du même test naissent dans la même milliseconde, et un
 * tri par date les rendrait dans n'importe quel ordre.
 */
async function codeDe(emission: Awaited<ReturnType<typeof emettre>>): Promise<string> {
  if (!emission.ok) throw new Error(`émission refusée : ${emission.motif}`);
  const envoi = await db.emailOutbox.findUniqueOrThrow({
    where: { idempotencyKey: `courriel:code-versement-${emission.id}` },
    select: { payload: true },
  });
  return (envoi.payload as { codeSecret: string }).codeSecret;
}

const verifier = (userId: string, saisie: string, cible = WAVE, maintenant?: Date) =>
  verifierCodeCourriel({ userId, but: "PAYOUT_ACCOUNT", cible, saisie, maintenant });

describe("émettre un code", () => {
  it("range l'empreinte, jamais le code, et dépose le courriel à l'adresse du compte", async () => {
    const u = await compte();
    const r = await emettre(u.id);
    expect(r).toMatchObject({ ok: true, vers: adresseMasquee(u.email) });

    const code = await codeDe(r);
    expect(code).toMatch(/^\d{6}$/);
    const ligne = await db.emailCode.findFirstOrThrow({ where: { userId: u.id } });
    expect(ligne.codeHash).not.toContain(code);
    expect(ligne.target).toBe(WAVE);
    expect(ligne.target).not.toContain("0700112233");
  });

  it("attend une minute avant d'en renvoyer un", async () => {
    const u = await compte();
    const t0 = new Date();
    expect((await emettre(u.id, t0)).ok).toBe(true);
    expect(await emettre(u.id, new Date(t0.getTime() + 30_000))).toEqual({ ok: false, motif: "TROP_TOT" });
    expect((await emettre(u.id, new Date(t0.getTime() + ATTENTE_RENVOI_COURRIEL_MS + 1))).ok).toBe(true);
  });

  it("périme le code précédent : un seul code vivant", async () => {
    const u = await compte();
    const t0 = new Date(Date.now() - 2 * ATTENTE_RENVOI_COURRIEL_MS);
    const ancien = await codeDe(await emettre(u.id, t0));
    const nouveau = await codeDe(await emettre(u.id, new Date(t0.getTime() + ATTENTE_RENVOI_COURRIEL_MS + 1)));
    // Peut tomber sur le même tirage une fois sur un million : on ne juge
    // l'ancien que s'il diffère.
    if (ancien !== nouveau) expect((await verifier(u.id, ancien)).ok).toBe(false);
    expect(await verifier(u.id, nouveau)).toEqual({ ok: true });
  });
});

describe("vérifier un code", () => {
  it("accepte le bon code une seule fois", async () => {
    const u = await compte();
    const code = await codeDe(await emettre(u.id));
    expect(await verifier(u.id, code)).toEqual({ ok: true });
    expect(await verifier(u.id, code)).toEqual({ ok: false, motif: "INVALIDE" });
  });

  it("brûle le code au cinquième essai faux, même si le bon arrive ensuite", async () => {
    const u = await compte();
    const code = await codeDe(await emettre(u.id));
    const faux = code === "000000" ? "111111" : "000000";
    for (let i = 1; i < ESSAIS_MAX_COURRIEL; i++) expect(await verifier(u.id, faux)).toEqual({ ok: false, motif: "INVALIDE" });
    expect(await verifier(u.id, faux)).toEqual({ ok: false, motif: "TROP_D_ESSAIS" });
    expect((await verifier(u.id, code)).ok).toBe(false);
  });

  it("n'accorde que cinq comparaisons à vingt essais lancés ensemble", async () => {
    const u = await compte();
    const code = await codeDe(await emettre(u.id));
    const faux = Array.from({ length: 20 }, (_, i) => String((Number(code) + i + 1) % 1_000_000).padStart(6, "0"));
    await Promise.all(faux.map((f) => verifier(u.id, f)));
    const ligne = await db.emailCode.findFirstOrThrow({ where: { userId: u.id } });
    expect(ligne.attempts).toBe(ESSAIS_MAX_COURRIEL);
    expect(ligne.usedAt).not.toBeNull();
  });

  it("refuse un code expiré", async () => {
    const u = await compte();
    const t0 = new Date(Date.now() - DUREE_CODE_COURRIEL_MS - 1_000);
    const code = await codeDe(await emettre(u.id, t0));
    expect(await verifier(u.id, code)).toEqual({ ok: false, motif: "EXPIRE" });
  });

  it("ne vaut que pour le compte qu'il annonce, et brûle s'il sert ailleurs", async () => {
    const u = await compte();
    const code = await codeDe(await emettre(u.id));
    expect(await verifier(u.id, code, OM)).toEqual({ ok: false, motif: "AUTRE_COMPTE" });
    expect((await verifier(u.id, code, WAVE)).ok).toBe(false);
  });

  it("n'accepte pas le code d'un autre compte", async () => {
    const a = await compte();
    const b = await compte();
    const codeA = await codeDe(await emettre(a.id));
    const codeB = await codeDe(await emettre(b.id));
    if (codeA !== codeB) expect((await verifier(b.id, codeA)).ok).toBe(false);
  });
});

describe("le ménage", () => {
  it("supprime les codes de plus d'un jour, et eux seuls", async () => {
    const u = await compte();
    await emettre(u.id, new Date(Date.now() - 25 * 60 * 60_000));
    await emettre(u.id);
    expect(await purgerCodesCourriel()).toBeGreaterThanOrEqual(1);
    expect(await db.emailCode.count({ where: { userId: u.id } })).toBe(1);
  });
});
