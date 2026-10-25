/**
 * L'alerte au changement de compte de versement, de bout en bout.
 *
 * Ce qu'on éprouve, c'est le point de sécurité et rien d'autre : changer son
 * compte dépose une alerte À L'ADRESSE DU COMPTE (pas au nouveau compte), elle
 * ne porte que le moyen et les quatre derniers chiffres, et elle part DANS la
 * même transaction que le changement — si le changement tient, l'alerte tient.
 *
 * Next fournit la session et le cache ; on les remplace par des doublures
 * minimales, et tout le reste est réel — validation du compte, écriture,
 * rendu de la charge au dépôt.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { oublierCompteurs } from "@/lib/securite/pilotes";

// ── Doublures de Next ────────────────────────────────────────────────────────

// La session est posée par chaque test après avoir créé son utilisateur.
let sessionCouranteValeur: { id: string; sessionId: string; email: string; nom: string } | null = null;

vi.mock("@/lib/auth/session", () => ({
  sessionCourante: async () => sessionCouranteValeur,
}));
// Le reste du module reste réel : `FRAICHEUR_SENSIBLE_MS` en vient.
const verifierCodeOuSecours = vi.fn(async (_userId: string, code: string) => code === "123456");
vi.mock("@/lib/auth/deux-facteurs", async (original) => ({
  ...(await original<typeof import("@/lib/auth/deux-facteurs")>()),
  verifierCodeOuSecours: (userId: string, code: string) => verifierCodeOuSecours(userId, code),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
// La file des courriels n'est pas poussée ici : le code se lit dans la file.
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: () => {},
}));

import { demanderCodeVersement, enregistrerCompteDeVersement } from "@/lib/payments/actions";

let n = 0;

async function compteConnecte(
  options: { totp?: boolean; cleDAcces?: boolean; passageIlYA?: number | null } = { totp: true },
) {
  n += 1;
  const marque = `${n}-${Math.random().toString(36).slice(2, 7)}`;
  const u = await db.user.create({
    data: {
      email: `versement-${marque}@baobart.test`,
      totpActiveLe: options.totp !== false ? new Date() : null,
      profile: { create: { username: `versement-${marque}`, displayName: "Awa Diallo" } },
    },
    select: { id: true, email: true },
  });
  if (options.cleDAcces) {
    await db.passkey.create({ data: { userId: u.id, credentialId: `cle-${marque}`, publicKey: "x" } });
  }
  // Une vraie session : la règle lit son dernier passage 2FA.
  const passage = options.passageIlYA == null ? null : new Date(Date.now() - options.passageIlYA);
  const session = await db.session.create({
    data: { userId: u.id, token: `jeton-${marque}`, expiresAt: new Date(Date.now() + 3_600_000), totpValideLe: passage },
    select: { id: true },
  });
  sessionCouranteValeur = { id: u.id, sessionId: session.id, email: u.email, nom: "Awa Diallo" };
  return u;
}

function saisie(champs: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.append(k, v);
  if (!fd.has("code2FA")) fd.append("code2FA", "123456");
  return fd;
}

describe("enregistrerCompteDeVersement — l'alerte de sécurité", () => {
  beforeEach(() => {
    sessionCouranteValeur = null;
    oublierCompteurs();
    verifierCodeOuSecours.mockClear();
  });

  it("dépose une alerte à l'adresse du compte quand le compte de versement change", async () => {
    const u = await compteConnecte();

    const r = await enregistrerCompteDeVersement(
      null,
      saisie({ provider: "wave", reference: "+225 0700112233" }),
    );
    expect(r.ok).toBe(true);

    const alertes = await db.emailOutbox.findMany({
      where: { template: "COMPTE_VERSEMENT_MODIFIE", recipient: u.email },
    });
    expect(alertes).toHaveLength(1);

    // L'alerte part au PROPRIÉTAIRE (l'adresse du compte), pas ailleurs.
    expect(alertes[0]!.recipient).toBe(u.email);

    const charge = alertes[0]!.payload as { nom: string; moyen: string; compte: string };
    expect(charge.moyen).toBe("Wave");
    // Masqué : les quatre derniers chiffres, jamais la référence entière.
    expect(charge.compte).toBe("···· 2233");
    expect(JSON.stringify(charge)).not.toContain("0700112233");
  });

  it("alerte à chaque changement, une fois par changement", async () => {
    const u = await compteConnecte();

    await enregistrerCompteDeVersement(null, saisie({ provider: "wave", reference: "+225 0700112233" }));
    await enregistrerCompteDeVersement(null, saisie({ provider: "om", reference: "+225 0500998877" }));

    const alertes = await db.emailOutbox.findMany({
      where: { template: "COMPTE_VERSEMENT_MODIFIE", recipient: u.email },
      orderBy: { createdAt: "asc" },
    });
    // Deux changements → deux alertes (clés distinctes, une par nouveau compte).
    expect(alertes).toHaveLength(2);
    expect((alertes[1]!.payload as { moyen: string }).moyen).toBe("Orange Money");
  });

  it("l'alerte et le changement tiennent ensemble : le compte actif est bien le nouveau", async () => {
    const u = await compteConnecte();

    await enregistrerCompteDeVersement(null, saisie({ provider: "wave", reference: "+2250700112233" }));

    const actifs = await db.payoutAccount.findMany({
      where: { userId: u.id, deletedAt: null },
    });
    expect(actifs).toHaveLength(1);
    expect(actifs[0]!.provider).toBe("wave");

    // Et l'alerte correspondante existe : les deux écritures sont dans la même
    // transaction, donc inséparables.
    expect(
      await db.emailOutbox.count({
        where: { template: "COMPTE_VERSEMENT_MODIFIE", recipient: u.email },
      }),
    ).toBe(1);
  });

  it("un compte refusé n'écrit rien et n'alerte personne", async () => {
    const u = await compteConnecte();

    const r = await enregistrerCompteDeVersement(
      null,
      saisie({ provider: "wave", reference: "pas-un-numero" }),
    );
    expect(r.ok).toBe(false);

    expect(await db.payoutAccount.count({ where: { userId: u.id } })).toBe(0);
    expect(
      await db.emailOutbox.count({
        where: { template: "COMPTE_VERSEMENT_MODIFIE", recipient: u.email },
      }),
    ).toBe(0);
  });
});

describe("enregistrerCompteDeVersement — la preuve demandée", () => {
  beforeEach(() => {
    sessionCouranteValeur = null;
    oublierCompteurs();
    verifierCodeOuSecours.mockClear();
  });

  const WAVE = { provider: "wave", reference: "+225 0700112233" };

  it("arrête la devinette : au sixième code en un quart d'heure, même le bon est refusé", async () => {
    const u = await compteConnecte();
    for (let i = 0; i < 5; i += 1) {
      const r = await enregistrerCompteDeVersement(null, saisie({ ...WAVE, code2FA: `00000${i}` }));
      expect(r).toMatchObject({ ok: false, message: "Ce code ne correspond pas." });
    }
    const r = await enregistrerCompteDeVersement(null, saisie({ ...WAVE, code2FA: "123456" }));
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.message).toMatch(/Trop de codes/);
    // Le sixième n'a même pas été vérifié.
    expect(verifierCodeOuSecours).toHaveBeenCalledTimes(5);
    expect(await db.payoutAccount.count({ where: { userId: u.id } })).toBe(0);
  });

  it("une faute de frappe sur le numéro ne coûte aucun essai de code", async () => {
    await compteConnecte();
    await enregistrerCompteDeVersement(null, saisie({ provider: "wave", reference: "pas-un-numero" }));
    expect(verifierCodeOuSecours).not.toHaveBeenCalled();
  });

  it("sans application, un code à six chiffres se vérifie comme un code reçu par courriel", async () => {
    // Le 18/10, ce compte était refusé d'office. Depuis le 23/10, il reçoit un
    // code par courriel ; « 123456 », jamais demandé, ne correspond à rien.
    const u = await compteConnecte({ totp: false });
    const r = await enregistrerCompteDeVersement(null, saisie(WAVE));
    expect(r).toMatchObject({ ok: false, message: "Ce code ne correspond pas." });
    expect(verifierCodeOuSecours).not.toHaveBeenCalled();
    expect(await db.payoutAccount.count({ where: { userId: u.id } })).toBe(0);
  });

  it("laisse passer un compte à clé d'accès franchie il y a dix minutes, sans code", async () => {
    const u = await compteConnecte({ totp: false, cleDAcces: true, passageIlYA: 10 * 60_000 });
    const fd = new FormData();
    for (const [k, v] of Object.entries(WAVE)) fd.append(k, v);
    const r = await enregistrerCompteDeVersement(null, fd);
    expect(r.ok).toBe(true);
    expect(await db.payoutAccount.count({ where: { userId: u.id, deletedAt: null } })).toBe(1);
  });

  it("redemande la clé d'accès quand elle date de plus d'un quart d'heure", async () => {
    const u = await compteConnecte({ totp: false, cleDAcces: true, passageIlYA: 20 * 60_000 });
    const fd = new FormData();
    for (const [k, v] of Object.entries(WAVE)) fd.append(k, v);
    const r = await enregistrerCompteDeVersement(null, fd);
    expect(r.ok).toBe(false);
    expect(await db.payoutAccount.count({ where: { userId: u.id } })).toBe(0);
  });
});

describe("le code par courriel, de bout en bout", () => {
  beforeEach(() => {
    sessionCouranteValeur = null;
    oublierCompteurs();
    verifierCodeOuSecours.mockClear();
  });

  const WAVE = { provider: "wave", reference: "+225 0700112233" };

  function formulaire(champs: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(champs)) fd.append(k, v);
    return fd;
  }

  async function codeEnvoyeA(email: string): Promise<string> {
    const envoi = await db.emailOutbox.findFirstOrThrow({
      where: { recipient: email, template: "CODE_COMPTE_VERSEMENT" },
      select: { payload: true },
    });
    return (envoi.payload as { codeSecret: string }).codeSecret;
  }

  it("demander le code, le recevoir, enregistrer le compte", async () => {
    const u = await compteConnecte({ totp: false });

    const demande = await demanderCodeVersement(null, formulaire(WAVE));
    expect(demande.ok).toBe(true);
    const envoi = await db.emailOutbox.findFirstOrThrow({
      where: { recipient: u.email, template: "CODE_COMPTE_VERSEMENT" },
      select: { payload: true },
    });
    // Le courriel nomme ce qu'il autorise, masqué.
    expect((envoi.payload as { destination: string }).destination).toBe("Wave — ···· 2233");

    const code = await codeEnvoyeA(u.email);
    const r = await enregistrerCompteDeVersement(null, formulaire({ ...WAVE, code2FA: code }));
    expect(r.ok).toBe(true);
    expect(await db.payoutAccount.count({ where: { userId: u.id, deletedAt: null } })).toBe(1);
    // Et l'alerte de changement part toujours.
    expect(await db.emailOutbox.count({ where: { recipient: u.email, template: "COMPTE_VERSEMENT_MODIFIE" } })).toBe(1);
  });

  it("le code demandé pour un numéro ne vaut pas pour un autre", async () => {
    const u = await compteConnecte({ totp: false });
    await demanderCodeVersement(null, formulaire(WAVE));
    const code = await codeEnvoyeA(u.email);

    const r = await enregistrerCompteDeVersement(null, formulaire({ provider: "wave", reference: "+225 0799887766", code2FA: code }));
    expect(r.ok).toBe(false);
    expect(await db.payoutAccount.count({ where: { userId: u.id } })).toBe(0);
  });

  it("ne demande pas de code pour un numéro mal formé", async () => {
    const u = await compteConnecte({ totp: false });
    const r = await demanderCodeVersement(null, formulaire({ provider: "wave", reference: "pas-un-numero" }));
    expect(r.ok).toBe(false);
    expect(await db.emailOutbox.count({ where: { recipient: u.email, template: "CODE_COMPTE_VERSEMENT" } })).toBe(0);
  });

  it("n'envoie pas de code par courriel à un compte qui a son application", async () => {
    const u = await compteConnecte({ totp: true });
    const r = await demanderCodeVersement(null, formulaire(WAVE));
    expect(r.ok).toBe(false);
    expect(await db.emailOutbox.count({ where: { recipient: u.email, template: "CODE_COMPTE_VERSEMENT" } })).toBe(0);
  });

  it("attend une minute entre deux demandes (le plafond horaire est « courriel.code »)", async () => {
    const u = await compteConnecte({ totp: false });
    expect((await demanderCodeVersement(null, formulaire(WAVE))).ok).toBe(true);
    const tropTot = await demanderCodeVersement(null, formulaire(WAVE));
    expect(tropTot).toMatchObject({ ok: false });
    expect(await db.emailOutbox.count({ where: { recipient: u.email, template: "CODE_COMPTE_VERSEMENT" } })).toBe(1);
  });
});
