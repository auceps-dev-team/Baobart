/**
 * Les codes SMS, contre une vraie base.
 *
 * Le SMS lui-même est intercepté (`envoyerSms`) : on lit le code dans le texte
 * qui serait parti, exactement comme la personne le lirait sur son téléphone.
 * Tout le reste — empreinte, essais, expiration, péremption — est réel.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const envoyes: { numero: string; texte: string; validiteS?: number }[] = [];
let envoiReussit = true;

vi.mock("@/lib/sms/pilotes", async (original) => ({
  ...(await original<typeof import("@/lib/sms/pilotes")>()),
  envoyerSms: vi.fn(async (input: { numero: string; texte: string; validiteS?: number }) => {
    envoyes.push({ numero: input.numero, texte: input.texte, validiteS: input.validiteS });
    return envoiReussit ? { ok: true } : { ok: false, motif: "refusé" };
  }),
}));

import {
  ATTENTE_RENVOI_MS,
  DUREE_CODE_MS,
  ESSAIS_MAX,
  compteDuTelephone,
  emettreCode,
  purgerCodesTelephone,
  rattacherTelephone,
  retirerTelephone,
  verifierCode,
} from "@/lib/auth/telephone";
import { db } from "@/lib/db";

const AVANT = { ...process.env };

beforeEach(() => {
  envoyes.length = 0;
  envoiReussit = true;
  process.env.SMS_DRIVER = "console";
});

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...AVANT };
});

let n = 0;

async function compte(options: { telephone?: string; prouve?: boolean } = {}) {
  n += 1;
  return db.user.create({
    data: {
      email: `tel-${n}@baobart.test`,
      phone: options.telephone ?? null,
      phoneVerifiedAt: options.prouve ? new Date() : null,
    },
    select: { id: true },
  });
}

function numero(): string {
  n += 1;
  return `+22507${String(10_000_000 + n).slice(-8)}`;
}

/** Le code tel qu'il apparaît dans le dernier SMS. */
function dernierCode(): string {
  const texte = envoyes.at(-1)?.texte ?? "";
  const code = /\b(\d{6})\b/.exec(texte)?.[1];
  if (!code) throw new Error(`aucun code dans « ${texte} »`);
  return code;
}

function faux(code: string): string {
  return code === "000000" ? "111111" : "000000";
}

describe("émettre puis vérifier", () => {
  it("le bon code ouvre, une fois et une seule", async () => {
    const { id } = await compte();
    const tel = numero();

    expect(await emettreCode({ userId: id, telephone: tel, but: "LOGIN" })).toEqual({ ok: true });
    expect(envoyes.at(-1)?.numero).toBe(tel);
    const code = dernierCode();

    expect(await verifierCode({ telephone: tel, but: "LOGIN", saisie: code })).toEqual({
      ok: true,
      userId: id,
    });
    // Rejoué : déjà consommé.
    expect(await verifierCode({ telephone: tel, but: "LOGIN", saisie: code })).toEqual({
      ok: false,
      motif: "INVALIDE",
    });
  });

  it("donne au SMS la durée de vie du code", async () => {
    // Une passerelle qui garde une file (téléphone éteint) jette le message au
    // lieu de livrer, une heure plus tard, un code déjà mort.
    const { id } = await compte();
    await emettreCode({ userId: id, telephone: numero(), but: "LOGIN" });
    expect(envoyes.at(-1)?.validiteS).toBe(DUREE_CODE_MS / 1000);
  });

  it("n'écrit jamais le code en base, seulement son empreinte", async () => {
    const { id } = await compte();
    const tel = numero();
    await emettreCode({ userId: id, telephone: tel, but: "LOGIN" });

    const ligne = await db.phoneCode.findFirstOrThrow({ where: { phone: tel } });
    expect(JSON.stringify(ligne)).not.toContain(dernierCode());
  });

  it("accepte un code tapé avec des espaces", async () => {
    const { id } = await compte();
    const tel = numero();
    await emettreCode({ userId: id, telephone: tel, but: "LOGIN" });
    const code = dernierCode();

    const suite = await verifierCode({
      telephone: tel,
      but: "LOGIN",
      saisie: `${code.slice(0, 3)} ${code.slice(3)}`,
    });
    expect(suite.ok).toBe(true);
  });

  it("ne mélange pas les buts : un code de connexion ne vérifie pas un numéro", async () => {
    const { id } = await compte();
    const tel = numero();
    await emettreCode({ userId: id, telephone: tel, but: "LOGIN" });

    expect(
      await verifierCode({ telephone: tel, but: "VERIFY", saisie: dernierCode() }),
    ).toEqual({ ok: false, motif: "INVALIDE" });
  });

  it("restreint au compte attendu quand on le nomme", async () => {
    const a = await compte();
    const b = await compte();
    const tel = numero();
    await emettreCode({ userId: a.id, telephone: tel, but: "VERIFY" });

    expect(
      await verifierCode({ telephone: tel, but: "VERIFY", saisie: dernierCode(), userId: b.id }),
    ).toEqual({ ok: false, motif: "INVALIDE" });
  });
});

describe("ce qui borne une attaque", () => {
  it(`brûle le code après ${ESSAIS_MAX} essais faux, même si le suivant est le bon`, async () => {
    const { id } = await compte();
    const tel = numero();
    await emettreCode({ userId: id, telephone: tel, but: "LOGIN" });
    const code = dernierCode();

    for (let i = 1; i < ESSAIS_MAX; i += 1) {
      expect(await verifierCode({ telephone: tel, but: "LOGIN", saisie: faux(code) })).toEqual({
        ok: false,
        motif: "INVALIDE",
      });
    }
    expect(await verifierCode({ telephone: tel, but: "LOGIN", saisie: faux(code) })).toEqual({
      ok: false,
      motif: "TROP_D_ESSAIS",
    });
    expect((await verifierCode({ telephone: tel, but: "LOGIN", saisie: code })).ok).toBe(false);
  });

  it("ne laisse pas cent essais parallèles dépasser le quota d'un code", async () => {
    // Le défaut qu'on cherche : lire `attempts`, comparer, puis compter. Cent
    // requêtes simultanées liraient toutes zéro et compareraient toutes.
    const { id } = await compte();
    const tel = numero();
    await emettreCode({ userId: id, telephone: tel, but: "LOGIN" });
    const code = dernierCode();

    await Promise.all(
      Array.from({ length: 30 }, () =>
        verifierCode({ telephone: tel, but: "LOGIN", saisie: faux(code) }),
      ),
    );

    const ligne = await db.phoneCode.findFirstOrThrow({ where: { phone: tel } });
    expect(ligne.attempts).toBeLessThanOrEqual(ESSAIS_MAX);
    expect((await verifierCode({ telephone: tel, but: "LOGIN", saisie: code })).ok).toBe(false);
  });

  it("refuse un code expiré", async () => {
    const { id } = await compte();
    const tel = numero();
    const t0 = new Date();
    await emettreCode({ userId: id, telephone: tel, but: "LOGIN", maintenant: t0 });

    const suite = await verifierCode({
      telephone: tel,
      but: "LOGIN",
      saisie: dernierCode(),
      maintenant: new Date(t0.getTime() + DUREE_CODE_MS + 1),
    });
    expect(suite).toEqual({ ok: false, motif: "EXPIRE" });
  });

  it("périme l'ancien code quand un nouveau part", async () => {
    const { id } = await compte();
    const tel = numero();
    const t0 = new Date(Date.now() - 2 * ATTENTE_RENVOI_MS);
    await emettreCode({ userId: id, telephone: tel, but: "LOGIN", maintenant: t0 });
    const ancien = dernierCode();

    await emettreCode({ userId: id, telephone: tel, but: "LOGIN" });
    const nouveau = dernierCode();

    if (ancien !== nouveau) {
      expect(await verifierCode({ telephone: tel, but: "LOGIN", saisie: ancien })).toEqual({
        ok: false,
        motif: "INVALIDE",
      });
    }
    expect((await verifierCode({ telephone: tel, but: "LOGIN", saisie: nouveau })).ok).toBe(true);
  });

  it("refuse un renvoi dans la minute, sans envoyer de SMS", async () => {
    const { id } = await compte();
    const tel = numero();
    await emettreCode({ userId: id, telephone: tel, but: "LOGIN" });
    const avant = envoyes.length;

    expect(await emettreCode({ userId: id, telephone: tel, but: "LOGIN" })).toEqual({
      ok: false,
      motif: "TROP_TOT",
    });
    expect(envoyes.length).toBe(avant);
  });

  it("ne garde pas valable un code dont le SMS n'est pas parti", async () => {
    const { id } = await compte();
    const tel = numero();
    envoiReussit = false;

    expect(await emettreCode({ userId: id, telephone: tel, but: "LOGIN" })).toEqual({
      ok: false,
      motif: "ENVOI_ECHOUE",
    });
    expect(
      await verifierCode({ telephone: tel, but: "LOGIN", saisie: dernierCode() }),
    ).toEqual({ ok: false, motif: "INVALIDE" });
  });
});

describe("quand émettre est impossible", () => {
  it("sans opérateur SMS", async () => {
    const { id } = await compte();
    process.env.SMS_DRIVER = "aucun";
    expect(await emettreCode({ userId: id, telephone: numero(), but: "LOGIN" })).toEqual({
      ok: false,
      motif: "INDISPONIBLE",
    });
  });

  it("par le pilote console en production — le code finirait au journal", async () => {
    const { id } = await compte();
    vi.stubEnv("NODE_ENV", "production");
    expect(await emettreCode({ userId: id, telephone: numero(), but: "LOGIN" })).toEqual({
      ok: false,
      motif: "INDISPONIBLE",
    });
    expect(envoyes).toHaveLength(0);
  });
});

describe("le numéro du compte", () => {
  it("n'ouvre la porte que s'il a été prouvé", async () => {
    const telProuve = numero();
    const telSaisi = numero();
    const prouve = await compte({ telephone: telProuve, prouve: true });
    await compte({ telephone: telSaisi, prouve: false });

    expect((await compteDuTelephone(telProuve))?.id).toBe(prouve.id);
    expect(await compteDuTelephone(telSaisi)).toBeNull();
  });

  it("se rattache au compte qui l'a prouvé", async () => {
    const { id } = await compte();
    const tel = numero();

    expect(await rattacherTelephone(id, tel)).toEqual({ ok: true });
    const relu = await db.user.findUniqueOrThrow({ where: { id } });
    expect(relu.phone).toBe(tel);
    expect(relu.phoneVerifiedAt).not.toBeNull();
  });

  it("reste à un autre compte qui l'a prouvé avant", async () => {
    const tel = numero();
    await compte({ telephone: tel, prouve: true });
    const { id } = await compte();

    expect(await rattacherTelephone(id, tel)).toEqual({ ok: false, motif: "DEJA_PRIS" });
  });

  it("passe d'un compte qui l'avait seulement saisi à celui qui le prouve", async () => {
    const tel = numero();
    const saisi = await compte({ telephone: tel, prouve: false });
    const { id } = await compte();

    expect(await rattacherTelephone(id, tel)).toEqual({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: saisi.id } })).phone).toBeNull();
  });

  it("se retire, et emporte les codes en cours", async () => {
    const tel = numero();
    const { id } = await compte({ telephone: tel, prouve: true });
    await emettreCode({ userId: id, telephone: tel, but: "LOGIN" });
    const code = dernierCode();

    await retirerTelephone(id);

    expect(await compteDuTelephone(tel)).toBeNull();
    expect((await verifierCode({ telephone: tel, but: "LOGIN", saisie: code })).ok).toBe(false);
  });
});

describe("le ménage", () => {
  it("supprime les codes de plus d'une journée, garde les récents", async () => {
    const { id } = await compte();
    const vieux = numero();
    const recent = numero();
    await emettreCode({
      userId: id,
      telephone: vieux,
      but: "LOGIN",
      maintenant: new Date(Date.now() - 2 * 24 * 60 * 60_000),
    });
    await emettreCode({ userId: id, telephone: recent, but: "LOGIN" });

    expect(await purgerCodesTelephone()).toBe(1);
    expect(await db.phoneCode.count({ where: { phone: recent } })).toBe(1);
  });
});
