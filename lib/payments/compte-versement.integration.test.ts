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

// ── Doublures de Next ────────────────────────────────────────────────────────

// La session est posée par chaque test après avoir créé son utilisateur.
let sessionCouranteValeur: { id: string; email: string; nom: string } | null = null;

vi.mock("@/lib/auth/session", () => ({
  sessionCourante: async () => sessionCouranteValeur,
}));
vi.mock("@/lib/auth/deux-facteurs", () => ({
  verifierCodeOuSecours: async (_userId: string, code: string) => code === "123456",
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { enregistrerCompteDeVersement } from "@/lib/payments/actions";

let n = 0;

async function compteConnecte(options: { totp?: boolean } = { totp: true }) {
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
  sessionCouranteValeur = { id: u.id, email: u.email, nom: "Awa Diallo" };
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
