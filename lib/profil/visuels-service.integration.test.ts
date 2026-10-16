/**
 * La photo de profil et la bannière, contre la vraie base.
 *
 * Le stockage est un dictionnaire en mémoire, comme pour la régénération des
 * aperçus : la CI n'a pas de S3. « Le navigateur dépose » s'écrit donc en
 * rangeant les octets sous la clé réservée.
 *
 * Ce qu'on éprouve surtout : que l'original ne soit jamais publié, que ses
 * métadonnées ne passent pas dans la copie, et qu'un refus ne laisse rien
 * derrière lui.
 */

import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const objets = new Map<string, { corps: Buffer; type: string }>();

vi.mock("@/lib/upload/storage", async (original) => ({
  ...(await original<typeof import("@/lib/upload/storage")>()),
  signerDepot: async (o: { cle: string }) => ({
    url: `https://depot.baobart.test/${o.cle}`,
    cle: o.cle,
    expireLe: new Date(Date.now() + 600_000),
  }),
  lireObjet: async (cle: string) => {
    const o = objets.get(cle);
    return o ? { taille: o.corps.length, contentType: o.type, etag: "e" } : null;
  },
  telechargerObjet: async (cle: string) => objets.get(cle)?.corps ?? null,
  deposerObjet: async (o: { cle: string; corps: Buffer; contentType: string }) =>
    void objets.set(o.cle, { corps: o.corps, type: o.contentType }),
  supprimerObjet: async (cle: string) => void objets.delete(cle),
  urlPublique: (cle: string) => `https://cdn.baobart.test/${cle}`,
}));

import { db } from "@/lib/db";
import { anonymiser } from "@/lib/rgpd/effacement";
import {
  confirmerVisuelDe,
  reserverVisuelDe,
  retirerVisuelDe,
} from "@/lib/profil/visuels-service";

let n = 0;

beforeEach(() => objets.clear());

async function compte() {
  n += 1;
  return db.user.create({
    data: {
      email: `visuel-${n}-${Date.now()}@baobart.test`,
      profile: { create: { username: `visuel-${n}-${Date.now()}`, displayName: "Aya Kouassi" } },
    },
    select: { id: true },
  });
}

async function photo(largeur: number, hauteur: number, format: "png" | "jpeg" = "png") {
  const base = sharp({ create: { width: largeur, height: hauteur, channels: 3, background: { r: 200, g: 120, b: 60 } } });
  return format === "png" ? base.png().toBuffer() : base.jpeg().toBuffer();
}

/** Réserve, « dépose » comme le ferait le navigateur, rend l'identifiant. */
async function deposer(userId: string, visuel: "avatar" | "banniere", corps: Buffer, nom = "moi.png", type = "image/png") {
  const r = await reserverVisuelDe(userId, visuel, { nom, taille: corps.length, mime: type });
  if (!r.ok) throw new Error(r.message);
  const cle = new URL(r.url).pathname.slice(1);
  objets.set(cle, { corps, type });
  return { reservationId: r.reservationId, cle };
}

async function profil(userId: string) {
  return db.profile.findUniqueOrThrow({ where: { userId }, select: { avatarUrl: true, bannerUrl: true } });
}

describe("une photo de profil", () => {
  it("devient une copie WebP carrée, publique ; l'original disparaît", async () => {
    const c = await compte();
    const { reservationId, cle } = await deposer(c.id, "avatar", await photo(900, 600));

    const r = await confirmerVisuelDe(c.id, "avatar", reservationId);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const publiee = r.url.replace("https://cdn.baobart.test/", "");
    expect(publiee).toMatch(new RegExp(`^public/profils/${c.id}/avatar-[a-f0-9-]+\\.webp$`));
    expect(await sharp(objets.get(publiee)!.corps).metadata()).toMatchObject({ format: "webp", width: 400, height: 400 });
    // L'original, jamais public, n'existe plus.
    expect(cle.startsWith(`profils/${c.id}/`)).toBe(true);
    expect(objets.has(cle)).toBe(false);
    expect((await profil(c.id)).avatarUrl).toBe(r.url);
    expect((await db.uploadReservation.findUniqueOrThrow({ where: { id: reservationId } })).status).toBe("uploaded");
  });

  it("ne garde aucune métadonnée de l'original", async () => {
    // Une photo de téléphone dit souvent où elle a été prise.
    const c = await compte();
    const avecExif = await sharp(await photo(800, 800, "jpeg"))
      .withExif({ IFD0: { Copyright: "Aya Kouassi, rue des Jardins, Abidjan" } })
      .jpeg()
      .toBuffer();
    expect((await sharp(avecExif).metadata()).exif).toBeDefined();

    const { reservationId } = await deposer(c.id, "avatar", avecExif, "moi.jpg", "image/jpeg");
    const r = await confirmerVisuelDe(c.id, "avatar", reservationId);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const copie = objets.get(r.url.replace("https://cdn.baobart.test/", ""))!.corps;
    expect((await sharp(copie).metadata()).exif).toBeUndefined();
    expect(copie.includes(Buffer.from("rue des Jardins"))).toBe(false);
  });

  it("refuse une image trop petite, et ne laisse rien derrière", async () => {
    const c = await compte();
    const { reservationId, cle } = await deposer(c.id, "avatar", await photo(300, 300));

    const r = await confirmerVisuelDe(c.id, "avatar", reservationId);
    expect(r).toEqual({ ok: false, message: "Photo de profil : 400×400 au minimum — celle-ci fait 300×300." });
    expect(objets.size).toBe(0);
    expect(objets.has(cle)).toBe(false);
    expect((await profil(c.id)).avatarUrl).toBeNull();
  });

  it("refuse un fichier qui se dit PNG et n'en est pas un", async () => {
    const c = await compte();
    const { reservationId } = await deposer(c.id, "avatar", Buffer.from("<svg onload=alert(1)>"));
    const r = await confirmerVisuelDe(c.id, "avatar", reservationId);
    expect(r.ok).toBe(false);
    expect(objets.size).toBe(0);
  });

  it("refuse la réservation d'un autre compte, ou d'un autre visuel", async () => {
    const a = await compte();
    const b = await compte();
    const { reservationId } = await deposer(a.id, "avatar", await photo(500, 500));

    expect(await confirmerVisuelDe(b.id, "avatar", reservationId)).toEqual({ ok: false, message: "Envoi introuvable." });
    expect(await confirmerVisuelDe(a.id, "banniere", reservationId)).toEqual({ ok: false, message: "Envoi introuvable." });
    expect((await profil(b.id)).avatarUrl).toBeNull();
  });

  it("remplacée, l'ancienne copie est supprimée ; retirée, la dernière aussi", async () => {
    const c = await compte();
    const premiere = await confirmerVisuelDe(c.id, "avatar", (await deposer(c.id, "avatar", await photo(500, 500))).reservationId);
    const seconde = await confirmerVisuelDe(c.id, "avatar", (await deposer(c.id, "avatar", await photo(600, 600))).reservationId);
    if (!premiere.ok || !seconde.ok) throw new Error("envoi refusé");

    const cle = (u: string) => u.replace("https://cdn.baobart.test/", "");
    expect(objets.has(cle(premiere.url))).toBe(false);
    expect(objets.has(cle(seconde.url))).toBe(true);

    await retirerVisuelDe(c.id, "avatar");
    expect(objets.has(cle(seconde.url))).toBe(false);
    expect((await profil(c.id)).avatarUrl).toBeNull();
  });
});

describe("une bannière", () => {
  it("garde ses proportions, réduite à 2 400 px de large au plus", async () => {
    const c = await compte();
    const r = await confirmerVisuelDe(c.id, "banniere", (await deposer(c.id, "banniere", await photo(3200, 800))).reservationId);
    if (!r.ok) throw new Error(r.message);
    const meta = await sharp(objets.get(r.url.replace("https://cdn.baobart.test/", ""))!.corps).metadata();
    expect(meta).toMatchObject({ width: 2400, height: 600 });
    expect((await profil(c.id)).bannerUrl).toBe(r.url);
  });
});

describe("l'effacement du compte", () => {
  it("emporte la photo et la bannière du stockage", async () => {
    const c = await compte();
    const a = await confirmerVisuelDe(c.id, "avatar", (await deposer(c.id, "avatar", await photo(500, 500))).reservationId);
    const b = await confirmerVisuelDe(c.id, "banniere", (await deposer(c.id, "banniere", await photo(1600, 400))).reservationId);
    if (!a.ok || !b.ok) throw new Error("envoi refusé");
    expect(objets.size).toBe(2);

    const bilan = await anonymiser(c.id);

    expect(objets.size).toBe(0);
    expect(bilan.supprimees["profil (images)"]).toBe(2);
  });

  it("ne supprime pas une image qui n'est pas la sienne", async () => {
    // Une adresse posée par la démonstration, hors de son préfixe.
    const c = await compte();
    objets.set("public/apercus/autre-v3.webp", { corps: Buffer.from("x"), type: "image/webp" });
    await db.profile.update({
      where: { userId: c.id },
      data: { avatarUrl: "https://cdn.baobart.test/public/apercus/autre-v3.webp" },
    });

    await anonymiser(c.id);
    expect(objets.has("public/apercus/autre-v3.webp")).toBe(true);
  });
});
