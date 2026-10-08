/**
 * Les actions du téléphone, de bout en bout, contre une vraie base.
 *
 * Next fournit les cookies, les en-têtes, la redirection et `after` : on les
 * remplace ici par des doublures minimales, et tout le reste est réel —
 * limites, liste de blocage, codes, sessions, défi de 2FA.
 *
 * Ce qu'on éprouve surtout, c'est ce qu'une action ne doit PAS faire : dire si
 * un numéro a un compte, ouvrir une session à un compte protégé par une 2FA,
 * ou à un compte suspendu.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Doublures de Next ────────────────────────────────────────────────────────

const pot = new Map<string, string>();
const magasin = {
  get: (nom: string) => (pot.has(nom) ? { name: nom, value: pot.get(nom)! } : undefined),
  set: (nom: string, valeur: string) => void pot.set(nom, valeur),
  delete: (nom: string) => void pot.delete(nom),
};
let adresseIp = "10.0.0.1";
const differes: Array<() => Promise<unknown>> = [];

class Redirection extends Error {
  constructor(public cible: string) {
    super(`redirection vers ${cible}`);
  }
}

vi.mock("next/headers", () => ({
  cookies: async () => magasin,
  headers: async () => new Headers({ "x-real-ip": adresseIp }),
}));
vi.mock("next/navigation", () => ({
  redirect: (cible: string) => {
    throw new Redirection(cible);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (tache: () => Promise<unknown>) => void differes.push(tache),
}));

const envoyes: { numero: string; texte: string }[] = [];
vi.mock("@/lib/sms/pilotes", async (original) => ({
  ...(await original<typeof import("@/lib/sms/pilotes")>()),
  envoyerSms: vi.fn(async (input: { numero: string; texte: string }) => {
    envoyes.push({ numero: input.numero, texte: input.texte });
    return { ok: true };
  }),
}));

import {
  confirmerTelephone,
  demanderCodeConnexion,
  demanderCodeVerification,
  verifierCodeConnexion,
} from "@/lib/auth/actions-telephone";
import { COOKIE_DEFI } from "@/lib/auth/deux-facteurs";
import { ouvrirSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { bloquer } from "@/lib/securite/blocklist";

const AVANT = { ...process.env };
let n = 0;

beforeEach(() => {
  pot.clear();
  envoyes.length = 0;
  differes.length = 0;
  n += 1;
  // Une adresse par test : les quotas par adresse sont réels, et cinq demandes
  // par heure s'épuiseraient d'un test à l'autre.
  adresseIp = `10.0.${Math.floor(n / 200)}.${n % 200}`;
  process.env.SMS_DRIVER = "console";
  process.env.RATE_LIMIT_DRIVER = "memoire";
});

afterEach(() => {
  process.env = { ...AVANT };
});

function numeroLocal(): { saisi: string; e164: string } {
  n += 1;
  const huit = String(10_000_000 + n).slice(-8);
  return { saisi: `07 ${huit}`, e164: `+22507${huit}` };
}

function formulaire(champs: Record<string, string>): FormData {
  const donnees = new FormData();
  for (const [k, v] of Object.entries(champs)) donnees.set(k, v);
  return donnees;
}

async function compte(options: { e164?: string; prouve?: boolean; suspendu?: boolean } = {}) {
  n += 1;
  return db.user.create({
    data: {
      email: `act-tel-${n}@baobart.test`,
      phone: options.e164 ?? null,
      phoneVerifiedAt: options.prouve ? new Date() : null,
      suspendedAt: options.suspendu ? new Date() : null,
    },
    select: { id: true },
  });
}

/** Les SMS partent après la réponse : on les laisse partir. */
async function laisserPartir() {
  for (const tache of differes.splice(0)) await tache();
}

function dernierCode(): string {
  const code = /\b(\d{6})\b/.exec(envoyes.at(-1)?.texte ?? "")?.[1];
  if (!code) throw new Error("aucun SMS avec un code");
  return code;
}

async function redirectionDe(promesse: Promise<unknown>): Promise<string | null> {
  try {
    await promesse;
    return null;
  } catch (cause) {
    if (cause instanceof Redirection) return cause.cible;
    throw cause;
  }
}

describe("demander un code de connexion", () => {
  it("répond pareil qu'un numéro ait un compte ou non", async () => {
    const connu = numeroLocal();
    await compte({ e164: connu.e164, prouve: true });
    const inconnu = numeroLocal();

    const a = await demanderCodeConnexion(null, formulaire({ numero: connu.saisi, pays: "CI" }));
    const b = await demanderCodeConnexion(null, formulaire({ numero: inconnu.saisi, pays: "CI" }));

    // Même forme, même texte : seul le numéro masqué diffère.
    expect({ ...a, numeroMasque: undefined }).toEqual({ ...b, numeroMasque: undefined });
    expect(a.etape).toBe("code");

    // Et le SMS ne part qu'APRÈS la réponse, seulement pour le compte connu.
    expect(envoyes).toHaveLength(0);
    await laisserPartir();
    expect(envoyes.map((e) => e.numero)).toEqual([connu.e164]);
  });

  it("n'envoie rien à un numéro saisi mais jamais prouvé", async () => {
    const tel = numeroLocal();
    await compte({ e164: tel.e164, prouve: false });

    await demanderCodeConnexion(null, formulaire({ numero: tel.saisi, pays: "CI" }));
    await laisserPartir();
    expect(envoyes).toHaveLength(0);
  });

  it("n'envoie rien à un compte suspendu", async () => {
    const tel = numeroLocal();
    await compte({ e164: tel.e164, prouve: true, suspendu: true });

    await demanderCodeConnexion(null, formulaire({ numero: tel.saisi, pays: "CI" }));
    await laisserPartir();
    expect(envoyes).toHaveLength(0);
  });

  it("refuse un numéro bloqué, sans dire pourquoi", async () => {
    const tel = numeroLocal();
    await bloquer({ type: "PHONE", valeur: tel.e164 });

    const suite = await demanderCodeConnexion(null, formulaire({ numero: tel.saisi, pays: "CI" }));
    expect(suite.erreur).toMatch(/ne peut pas être utilisé/);
  });

  it("n'envoie rien au compte dont le courriel est bloqué, sans le dire", async () => {
    // Relecture du 08/10 : le mot de passe regardait le courriel, le téléphone
    // non — un compte bloqué par son adresse entrait par son numéro.
    const tel = numeroLocal();
    const { id } = await compte({ e164: tel.e164, prouve: true });
    const { email } = await db.user.findUniqueOrThrow({ where: { id }, select: { email: true } });
    await bloquer({ type: "EMAIL", valeur: email });

    const suite = await demanderCodeConnexion(null, formulaire({ numero: tel.saisi, pays: "CI" }));
    // La même réponse qu'à un numéro inconnu : refuser dirait que ce numéro a un compte.
    expect(suite).toMatchObject({ etape: "code" });
    expect(suite.erreur).toBeUndefined();
    await laisserPartir();
    expect(envoyes).toHaveLength(0);
  });

  it("borne les demandes vers un même numéro, même depuis des adresses différentes", async () => {
    // Sans la borne par numéro, changer d'adresse à chaque essai suffirait à
    // arroser de SMS le téléphone d'un tiers.
    const tel = numeroLocal();
    let derniere = await demanderCodeConnexion(null, formulaire({ numero: tel.saisi, pays: "CI" }));
    for (let i = 0; i < 6; i += 1) {
      adresseIp = `10.9.${n}.${i}`;
      derniere = await demanderCodeConnexion(null, formulaire({ numero: tel.saisi, pays: "CI" }));
    }
    expect(derniere.erreur).toMatch(/Trop de tentatives/);
  });
});

describe("se connecter avec le code", () => {
  it("ouvre une session avec le bon code", async () => {
    const tel = numeroLocal();
    const { id } = await compte({ e164: tel.e164, prouve: true });

    await demanderCodeConnexion(null, formulaire({ numero: tel.saisi, pays: "CI" }));
    await laisserPartir();

    const cible = await redirectionDe(
      verifierCodeConnexion(null, formulaire({ code: dernierCode() })),
    );
    expect(cible).toBe("/dashboard");
    expect(await db.session.count({ where: { userId: id } })).toBe(1);
  });

  it("ne contourne pas la double authentification", async () => {
    const tel = numeroLocal();
    const { id } = await compte({ e164: tel.e164, prouve: true });
    await db.user.update({ where: { id }, data: { totpActiveLe: new Date() } });

    await demanderCodeConnexion(null, formulaire({ numero: tel.saisi, pays: "CI" }));
    await laisserPartir();

    const cible = await redirectionDe(
      verifierCodeConnexion(null, formulaire({ code: dernierCode() })),
    );
    expect(cible).toBe("/connexion/verification");
    expect(pot.has(COOKIE_DEFI)).toBe(true);
    // Le défi n'est pas une session.
    expect(await db.session.count({ where: { userId: id } })).toBe(0);
  });

  it("refuse un code faux, sans ouvrir de session", async () => {
    const tel = numeroLocal();
    const { id } = await compte({ e164: tel.e164, prouve: true });

    await demanderCodeConnexion(null, formulaire({ numero: tel.saisi, pays: "CI" }));
    await laisserPartir();
    const bon = dernierCode();

    const suite = await verifierCodeConnexion(
      null,
      formulaire({ code: bon === "000000" ? "111111" : "000000" }),
    );
    expect(suite).toMatchObject({ erreur: "Ce code ne correspond pas.", etape: "code" });
    expect(await db.session.count({ where: { userId: id } })).toBe(0);
  });

  it("n'ouvre rien si le courriel du compte est bloqué entre l'envoi et la saisie", async () => {
    const tel = numeroLocal();
    const { id } = await compte({ e164: tel.e164, prouve: true });

    await demanderCodeConnexion(null, formulaire({ numero: tel.saisi, pays: "CI" }));
    await laisserPartir();
    const { email } = await db.user.findUniqueOrThrow({ where: { id }, select: { email: true } });
    await bloquer({ type: "EMAIL", valeur: email });

    const suite = await verifierCodeConnexion(null, formulaire({ code: dernierCode() }));
    expect(suite.erreur).toMatch(/ne peut pas être utilisé/);
    expect(await db.session.count({ where: { userId: id } })).toBe(0);
  });

  it("n'ouvre rien si le numéro a quitté le compte entre-temps", async () => {
    const tel = numeroLocal();
    const { id } = await compte({ e164: tel.e164, prouve: true });

    await demanderCodeConnexion(null, formulaire({ numero: tel.saisi, pays: "CI" }));
    await laisserPartir();
    // Le numéro est retiré à la main, sans passer par `retirerTelephone` qui
    // aurait aussi brûlé le code : c'est la garde de l'action qu'on éprouve.
    await db.user.update({ where: { id }, data: { phone: null, phoneVerifiedAt: null } });

    const suite = await verifierCodeConnexion(null, formulaire({ code: dernierCode() }));
    expect(suite.erreur).toBeDefined();
    expect(await db.session.count({ where: { userId: id } })).toBe(0);
  });
});

describe("prouver son numéro depuis son compte", () => {
  it("rattache le numéro après le bon code", async () => {
    const { id } = await compte();
    await ouvrirSession(id);
    const tel = numeroLocal();

    const demande = await demanderCodeVerification(
      null,
      formulaire({ numero: tel.saisi, pays: "CI" }),
    );
    expect(demande).toMatchObject({ etape: "code" });

    const suite = await confirmerTelephone(null, formulaire({ code: dernierCode() }));
    expect(suite.info).toMatch(/Numéro vérifié/);

    const relu = await db.user.findUniqueOrThrow({ where: { id } });
    expect(relu.phone).toBe(tel.e164);
    expect(relu.phoneVerifiedAt).not.toBeNull();
  });

  it("exige une double authentification récente AVANT d'envoyer le SMS", async () => {
    // Relecture du 08/10 : vérifiée seulement à la confirmation, elle laissait
    // partir un SMS payé, inutilisable.
    const { id } = await compte();
    await db.user.update({ where: { id }, data: { totpActiveLe: new Date() } });
    // Session sans passage de 2FA : `totpValideLe` absent.
    await ouvrirSession(id);
    const tel = numeroLocal();

    const demande = await demanderCodeVerification(
      null,
      formulaire({ numero: tel.saisi, pays: "CI" }),
    );

    expect(demande.erreur).toMatch(/double authentification/);
    expect(envoyes).toHaveLength(0);
  });

  it("la redemande à la confirmation, si elle a vieilli entre-temps", async () => {
    const { id } = await compte();
    await db.user.update({ where: { id }, data: { totpActiveLe: new Date() } });
    await ouvrirSession(id);
    await db.session.updateMany({ where: { userId: id }, data: { totpValideLe: new Date() } });
    const tel = numeroLocal();

    await demanderCodeVerification(null, formulaire({ numero: tel.saisi, pays: "CI" }));
    // Seize minutes plus tard, le passage de 2FA ne couvre plus l'action.
    await db.session.updateMany({
      where: { userId: id },
      data: { totpValideLe: new Date(Date.now() - 16 * 60_000) },
    });
    const suite = await confirmerTelephone(null, formulaire({ code: dernierCode() }));

    expect(suite.erreur).toMatch(/double authentification/);
    expect((await db.user.findUniqueOrThrow({ where: { id } })).phone).toBeNull();
  });

  it("ne vole pas le numéro qu'un autre compte a prouvé", async () => {
    const tel = numeroLocal();
    await compte({ e164: tel.e164, prouve: true });
    const { id } = await compte();
    await ouvrirSession(id);

    await demanderCodeVerification(null, formulaire({ numero: tel.saisi, pays: "CI" }));
    const suite = await confirmerTelephone(null, formulaire({ code: dernierCode() }));

    expect(suite.erreur).toMatch(/déjà rattaché/);
    expect((await db.user.findUniqueOrThrow({ where: { id } })).phone).toBeNull();
  });

  it("refuse sans session", async () => {
    const tel = numeroLocal();
    const suite = await demanderCodeVerification(
      null,
      formulaire({ numero: tel.saisi, pays: "CI" }),
    );
    expect(suite.erreur).toMatch(/Reconnecte-toi/);
    expect(envoyes).toHaveLength(0);
  });
});
