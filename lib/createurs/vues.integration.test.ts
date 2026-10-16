/**
 * Les vues d'un profil public, contre la vraie base et le pilote en mémoire.
 *
 * Ce qu'on éprouve : un visiteur ne compte qu'une fois par jour, les robots et
 * les visiteurs qu'on ne sait pas reconnaître ne comptent pas, une adresse ne
 * fait pas monter un compteur à l'infini — et la route refuse ce qui vient
 * d'ailleurs, du créateur lui-même, ou d'un préchargement.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let connecte: { id: string } | null = null;
vi.mock("@/lib/auth/session", () => ({ sessionCourante: async () => connecte }));

import { POST } from "@/app/api/vues/profils/[id]/route";
import { VISITEURS_PAR_ADRESSE, compterUneVue, empreinte, estUnRobot } from "@/lib/createurs/vues";
import { db } from "@/lib/db";
import { oublierCompteurs } from "@/lib/securite/pilotes";

const AVANT = { pilote: process.env.RATE_LIMIT_DRIVER, secret: process.env.AUTH_SECRET };
const NAVIGATEUR = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36";
beforeEach(() => {
  process.env.RATE_LIMIT_DRIVER = "memoire";
  process.env.AUTH_SECRET = "un-secret-de-vues-assez-long";
  oublierCompteurs();
  connecte = null;
});
afterEach(() => {
  for (const [nom, valeur] of [
    ["RATE_LIMIT_DRIVER", AVANT.pilote],
    ["AUTH_SECRET", AVANT.secret],
  ] as const) {
    if (valeur === undefined) delete process.env[nom];
    else process.env[nom] = valeur;
  }
  oublierCompteurs();
});

let n = 0;
async function profil() {
  n += 1;
  const u = await db.user.create({
    data: {
      email: `vues-${n}-${Date.now()}@baobart.test`,
      profile: { create: { username: `vues-${n}-${Date.now()}`, displayName: "Awa" } },
    },
    select: { id: true, profile: { select: { id: true } } },
  });
  return { userId: u.id, profilId: u.profile!.id };
}

const vues = async (profilId: string) =>
  (await db.profile.findUniqueOrThrow({ where: { id: profilId }, select: { viewCount: true } })).viewCount;

const visite = (profilId: string, quoi: Partial<Parameters<typeof compterUneVue>[0]> = {}) =>
  compterUneVue({ profilId, visiteurId: null, adresse: "41.202.10.7", ua: NAVIGATEUR, ...quoi });

describe("une vue", () => {
  it("compte une fois par visiteur et par jour", async () => {
    const p = await profil();
    expect(await visite(p.profilId)).toBe("comptee");
    expect(await visite(p.profilId)).toBe("deja");
    expect(await visite(p.profilId)).toBe("deja");
    expect(await vues(p.profilId)).toBe(1);

    // Le lendemain, la même personne compte de nouveau.
    expect(await visite(p.profilId, { maintenant: new Date(Date.now() + 24 * 3_600_000) })).toBe("comptee");
    expect(await vues(p.profilId)).toBe(2);
  });

  it("distingue deux navigateurs derrière la même adresse, et un compte où qu'il soit", async () => {
    const p = await profil();
    expect(await visite(p.profilId)).toBe("comptee");
    expect(await visite(p.profilId, { ua: `${NAVIGATEUR} autre` })).toBe("comptee");

    const v = await profil();
    expect(await visite(p.profilId, { visiteurId: v.userId, adresse: "1.1.1.1" })).toBe("comptee");
    expect(await visite(p.profilId, { visiteurId: v.userId, adresse: "2.2.2.2" })).toBe("deja");
    expect(await vues(p.profilId)).toBe(3);
  });

  it("ne compte ni les robots, ni un visiteur qu'on ne sait pas reconnaître", async () => {
    const p = await profil();
    expect(await visite(p.profilId, { ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" })).toBe("ignoree");
    expect(await visite(p.profilId, { ua: "facebookexternalhit/1.1" })).toBe("ignoree");
    expect(await visite(p.profilId, { ua: null })).toBe("ignoree");
    expect(await visite(p.profilId, { adresse: null })).toBe("ignoree");

    // Sans secret, l'empreinte ne cacherait rien : on ne compte pas.
    delete process.env.AUTH_SECRET;
    expect(await visite(p.profilId)).toBe("ignoree");
    expect(await vues(p.profilId)).toBe(0);
  });

  it("borne ce qu'une adresse peut faire compter à un même profil", async () => {
    const p = await profil();
    let comptees = 0;
    for (let i = 0; i < VISITEURS_PAR_ADRESSE + 5; i += 1) {
      if ((await visite(p.profilId, { ua: `${NAVIGATEUR} n${i}` })) === "comptee") comptees += 1;
    }
    expect(comptees).toBe(VISITEURS_PAR_ADRESSE);
    expect(await vues(p.profilId)).toBe(VISITEURS_PAR_ADRESSE);
  });

  it("garde une empreinte qui change avec le jour et ne contient pas l'adresse", () => {
    const a = empreinte("secret-assez-long-pour", "2026-10-16", "adresse:41.202.10.7");
    expect(a).not.toContain("41.202");
    expect(a).not.toBe(empreinte("secret-assez-long-pour", "2026-10-17", "adresse:41.202.10.7"));
    expect(estUnRobot(NAVIGATEUR)).toBe(false);
  });
});

describe("la route", () => {
  const envoyer = (profilId: string, entetes: Record<string, string> = {}) =>
    POST(
      new Request(`http://localhost:3100/api/vues/profils/${profilId}`, {
        method: "POST",
        headers: { origin: "http://localhost:3100", "user-agent": NAVIGATEUR, "x-real-ip": "41.202.10.9", ...entetes },
      }),
      { params: Promise.resolve({ id: profilId }) },
    );

  it("compte une vue venue de notre site, et répond 204", async () => {
    const p = await profil();
    const r = await envoyer(p.profilId);
    expect(r.status).toBe(204);
    expect(await vues(p.profilId)).toBe(1);
  });

  it("ne compte pas une vue envoyée depuis un autre site", async () => {
    const p = await profil();
    expect((await envoyer(p.profilId, { origin: "https://autre.example" })).status).toBe(204);
    expect(await vues(p.profilId)).toBe(0);
  });

  it("ne compte ni le créateur sur sa propre vitrine, ni un préchargement", async () => {
    const p = await profil();
    connecte = { id: p.userId };
    await envoyer(p.profilId);
    connecte = null;
    await envoyer(p.profilId, { "sec-purpose": "prefetch" });
    expect(await vues(p.profilId)).toBe(0);
  });

  it("ne compte pas la vitrine d'un compte suspendu", async () => {
    const p = await profil();
    await db.user.update({ where: { id: p.userId }, data: { suspendedAt: new Date() } });
    await envoyer(p.profilId);
    expect(await vues(p.profilId)).toBe(0);
  });
});
