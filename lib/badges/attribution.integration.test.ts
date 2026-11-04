/**
 * Accorder et retirer un statut, contre une vraie base — et ce que cela ouvre.
 *
 * Audit du 04/11/2026 (`Doc/INVENTAIRE_FONCTIONNALITES_2026-11.md`, B1) :
 * publier un service exige Freelance ou Agence, et rien ne les accordait. Ces
 * tests vont donc jusqu'au droit lui-même (`lireQualifications`), et jusqu'à
 * l'offre d'emploi d'un recruteur vérifié : poser une ligne ne prouve rien si
 * personne ne la lit.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";

let administrateur: { id: string; email: string } | null = null;

vi.mock("@/lib/auth/acces-administration", () => ({
  exigerLePouvoir: async () => {
    if (!administrateur) throw new Error("NEXT_NOT_FOUND");
    return { ...administrateur, role: "ADMIN" };
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { agirSurUnStatut } from "@/lib/badges/actions";
import { accorderStatut, retirerStatut } from "@/lib/badges/attribution";
import { listerOffres } from "@/lib/jobs/queries";
import { lireQualifications } from "@/lib/services/qualifications";

let n = 0;

async function compte(role: string) {
  n += 1;
  const marque = `${role}-st-${n}-${Math.random().toString(36).slice(2, 7)}`;
  return db.user.create({
    data: { email: `${marque}@baobart.test`, profile: { create: { username: marque, displayName: marque } } },
    select: { id: true, email: true },
  });
}

const codes = async (userId: string) =>
  (await db.userBadge.findMany({ where: { userId }, select: { badge: { select: { code: true } } } })).map((b) => b.badge.code).sort();

function motif(texte: string) {
  const f = new FormData();
  f.set("motif", texte);
  return f;
}

beforeEach(() => {
  administrateur = null;
});

describe("accorder un statut", () => {
  it("pose le statut, et crée la ligne Badge quand le seed ne l'a pas fait", async () => {
    const c = await compte("membre");
    expect(await db.badge.count({ where: { code: "VERIFIED_CREATOR" } })).toBe(0);

    expect(await accorderStatut({ userId: c.id, code: "VERIFIED_CREATOR" })).toEqual({ ok: true, retire: null });
    expect(await codes(c.id)).toEqual(["VERIFIED_CREATOR"]);
  });

  it("refuse de poser deux fois le même statut", async () => {
    const c = await compte("membre");
    await accorderStatut({ userId: c.id, code: "VERIFIED_CREATOR" });
    expect(await accorderStatut({ userId: c.id, code: "VERIFIED_CREATOR" })).toEqual({ ok: false, motif: "DEJA_POSE" });
  });

  it("passe de Freelance à Agence sans jamais porter les deux", async () => {
    const c = await compte("membre");
    await accorderStatut({ userId: c.id, code: "FREELANCE" });

    expect(await accorderStatut({ userId: c.id, code: "AGENCE" })).toEqual({ ok: true, retire: "FREELANCE" });
    expect(await codes(c.id)).toEqual(["AGENCE"]);
  });

  it("répond « introuvable » pour un compte qui n'existe pas", async () => {
    expect(await accorderStatut({ userId: "inexistant", code: "FREELANCE" })).toEqual({ ok: false, motif: "INTROUVABLE" });
  });
});

describe("retirer un statut", () => {
  it("retire ce qui était posé, et le dit quand rien ne l'était", async () => {
    const c = await compte("membre");
    await accorderStatut({ userId: c.id, code: "VERIFIED_RECRUITER" });

    expect(await retirerStatut({ userId: c.id, code: "VERIFIED_RECRUITER" })).toEqual({ ok: true });
    expect(await retirerStatut({ userId: c.id, code: "VERIFIED_RECRUITER" })).toEqual({ ok: false, motif: "PAS_POSE" });
    expect(await codes(c.id)).toEqual([]);
  });
});

describe("ce que le statut ouvre", () => {
  it("ouvre le droit de publier des services (B1)", async () => {
    const c = await compte("createur");
    expect((await lireQualifications(c.id)).badgeProfessionnel).toBe(false);

    await accorderStatut({ userId: c.id, code: "FREELANCE" });

    expect((await lireQualifications(c.id)).badgeProfessionnel).toBe(true);
  });

  it("marque « vérifiée » chaque offre d'un recruteur vérifié", async () => {
    const recruteur = await compte("recruteur");
    const offre = await db.jobPosting.create({
      data: {
        recruiterId: recruteur.id,
        title: "Illustrateur",
        description: "Une description assez longue pour être acceptée par la validation.",
        type: "FREELANCE",
        mode: "REMOTE",
        state: "PUBLIE",
      },
      select: { id: true },
    });
    const verifiee = async () => (await listerOffres()).find((o) => o.id === offre.id)?.verifiee;

    expect(await verifiee()).toBe(false);
    await accorderStatut({ userId: recruteur.id, code: "VERIFIED_RECRUITER" });
    expect(await verifiee()).toBe(true);
  });
});

describe("l'action de l'administration", () => {
  it("exige un motif, et laisse une trace d'audit après l'acte", async () => {
    const admin = await compte("admin");
    const c = await compte("membre");
    administrateur = admin;

    expect(await agirSurUnStatut(c.id, "ACCORDER:FREELANCE", null, motif(""))).toMatchObject({ ok: false });
    expect(await codes(c.id)).toEqual([]);

    expect(await agirSurUnStatut(c.id, "ACCORDER:FREELANCE", null, motif("Portfolio et identité contrôlés"))).toMatchObject({ ok: true });
    const traces = await db.auditLog.findMany({ where: { resource: `user:${c.id}` } });
    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({ actorId: admin.id, action: "statut.accorder", details: { statut: "FREELANCE", motif: "Portfolio et identité contrôlés" } });
  });

  it("refuse une clé forgée et un statut que l'on s'accorde à soi-même", async () => {
    const admin = await compte("admin");
    administrateur = admin;

    expect(await agirSurUnStatut(admin.id, "ACCORDER:TOP_CREATOR", null, motif("forgé depuis la console"))).toEqual({ ok: false, message: "Geste inconnu." });
    expect(await agirSurUnStatut(admin.id, "ACCORDER:VERIFIED_CREATOR", null, motif("je me vérifie moi-même"))).toMatchObject({ ok: false });
    expect(await codes(admin.id)).toEqual([]);
  });
});
