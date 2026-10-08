/**
 * La souscription d'Accès libre : un clic, gratuit, « tout sauf le payant ».
 */

import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { ouvrirRenouvellement } from "@/lib/abonnements/renouvellement";
import { quitterForfaitGratuit, renouvelerLesGratuits, souscrire } from "@/lib/abonnements/souscription";
import { db } from "@/lib/db";
import { autoriserTelechargement } from "@/lib/domain/downloads";
import { PORTS_BAOBART } from "@/lib/ndank/baobart";
import { lireQualifications } from "@/lib/services/qualifications";

const JOUR = 86_400_000;
let n = 0;

async function plans() {
  // Le TRUNCATE du montage vide `Plan` entre deux tests : on les recrée.
  const libre = await db.plan.upsert({
    where: { code: "LIBRE" },
    update: {},
    create: { code: "LIBRE", name: "Accès libre", priceMonthly: 0, downloadsPerMonth: null, openForSubscription: true, includesPaidResources: false },
  });
  const studio = await db.plan.upsert({
    where: { code: "STUDIO" },
    update: {},
    create: { code: "STUDIO", name: "Studio", priceMonthly: 7_500, downloadsPerMonth: null },
  });
  return { libre, studio };
}

async function compte() {
  n += 1;
  const s = `${n}-${Math.random().toString(36).slice(2, 7)}`;
  return db.user.create({ data: { email: `abo-${s}@baobart.test`, profile: { create: { username: `abo-${s}`, displayName: "Abonné" } } }, select: { id: true } });
}

async function ressource(prix: number) {
  const vendeur = await compte();
  const s = `${++n}-${Math.random().toString(36).slice(2, 7)}`;
  const p = await db.product.create({ data: { sellerId: vendeur.id, name: `Pack ${s}`, slug: `pack-${s}`, price: prix, currency: "XOF", status: "PUBLISHED" }, select: { id: true } });
  const m = await db.mediaAsset.create({ data: { ownerId: vendeur.id, purpose: "product", s3Key: `produits/${p.id}/f.zip`, checksum: "x", contentType: "application/zip", sizeBytes: 1024, status: "READY" }, select: { id: true } });
  return db.productFile.create({ data: { productId: p.id, mediaId: m.id, filename: "f.zip", sizeBytes: 1024, role: "SOURCE", position: 0 }, select: { id: true } });
}

describe("Accès libre", () => {
  it("s'active d'un clic, une seule fois, même en clics simultanés", async () => {
    await plans();
    const u = await compte();
    // Huit, pas deux : avec deux, la course se perdait trop souvent d'elle-même
    // et le test restait vert sans le verrou (preuve rouge du 08/10).
    const issues = await Promise.all(Array.from({ length: 8 }, () => souscrire({ userId: u.id, code: "LIBRE" })));
    expect(issues.filter((r) => r.ok)).toHaveLength(1);
    expect(issues.filter((r) => !r.ok).every((r) => !r.ok && r.motif === "DEJA_ABONNE")).toBe(true);

    const lignes = await db.subscription.findMany({ where: { userId: u.id }, include: { plan: true } });
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({ status: "ACTIVE", plan: { code: "LIBRE" }, paymentProvider: null });
    expect(Math.round((lignes[0]!.cycleEnd.getTime() - lignes[0]!.cycleStart.getTime()) / JOUR)).toBe(30);
  });

  it("attend une souscription concurrente d'un autre serveur au lieu de la doubler", async () => {
    // Le test précédent reste vert sans le verrou : mesuré le 08/10, ses huit
    // appels passent un à un dans ce processus. Celui-ci simule un second
    // serveur — un autre client, sa propre transaction — qui crée l'abonnement
    // et tarde à valider. Sans le verrou, `souscrire` ne voit rien (lecture
    // validée) et crée un doublon.
    const { libre } = await plans();
    const u = await compte();
    const autre = new PrismaClient();
    try {
      let signal!: () => void;
      const verrouPris = new Promise<void>((r) => (signal = r));
      const concurrent = autre.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`souscription:${u.id}`}))`;
          await tx.subscription.create({ data: { userId: u.id, planId: libre.id, cycleEnd: new Date(Date.now() + 30 * JOUR) } });
          signal();
          await new Promise((r) => setTimeout(r, 800));
        },
        { timeout: 10_000 },
      );
      await verrouPris;
      const r = await souscrire({ userId: u.id, code: "LIBRE" });
      await concurrent;
      expect(r).toEqual({ ok: false, motif: "DEJA_ABONNE" });
      expect(await db.subscription.count({ where: { userId: u.id } })).toBe(1);
    } finally {
      await autre.$disconnect();
    }
  });

  it("ne souscrit ni un forfait fermé, ni un forfait payant", async () => {
    const { studio } = await plans();
    const u = await compte();
    expect(await souscrire({ userId: u.id, code: "STUDIO" })).toEqual({ ok: false, motif: "FERME" });
    await db.plan.update({ where: { id: studio.id }, data: { openForSubscription: true } });
    expect(await souscrire({ userId: u.id, code: "STUDIO" })).toEqual({ ok: false, motif: "PAIEMENT_NON_OUVERT" });
    expect(await db.subscription.count({ where: { userId: u.id } })).toBe(0);
  });

  it("ouvre les ressources offertes, pas les payantes", async () => {
    await plans();
    const u = await compte();
    await souscrire({ userId: u.id, code: "LIBRE" });

    const payante = await ressource(5_000);
    const offerte = await ressource(0);
    expect((await autoriserTelechargement({ userId: u.id, productFileId: payante.id })).decision).toMatchObject({ autorise: false, raison: "COMMANDE_NON_PAYEE" });
    expect((await autoriserTelechargement({ userId: u.id, productFileId: offerte.id })).decision.autorise).toBe(true);
  });

  it("n'est jamais relancé, et son cycle avance seul", async () => {
    const { studio } = await plans();
    const libre = await compte();
    const payant = await compte();
    await souscrire({ userId: libre.id, code: "LIBRE" });
    const echu = new Date(Date.now() - 65 * JOUR);
    await db.subscription.updateMany({ where: { userId: libre.id }, data: { cycleStart: echu, cycleEnd: new Date(echu.getTime() + 30 * JOUR) } });
    await db.subscription.create({ data: { userId: payant.id, planId: studio.id, cycleStart: echu, cycleEnd: new Date(echu.getTime() + 30 * JOUR) } });

    // Ndank ne lit que le payant.
    const aRelancer = await PORTS_BAOBART.lecture.aRelancer(new Date(), 100);
    expect(aRelancer.map((a) => a.abonneId)).toEqual([payant.id]);

    expect(await renouvelerLesGratuits()).toBe(1);
    const apres = await db.subscription.findFirstOrThrow({ where: { userId: libre.id } });
    expect(apres.cycleEnd.getTime()).toBeGreaterThan(Date.now());
    expect(apres.status).toBe("ACTIVE");
    // L'abonnement payant n'a pas bougé : c'est à Ndank de le relancer.
    expect((await db.subscription.findFirstOrThrow({ where: { userId: payant.id } })).cycleEnd.getTime()).toBeLessThan(Date.now());
    // Et un second passage n'avance rien.
    expect(await renouvelerLesGratuits()).toBe(0);
  });

  it("compte comme abonnement ouvert, ne s'ouvre pas au paiement, et se quitte", async () => {
    await plans();
    const u = await compte();
    const r = await souscrire({ userId: u.id, code: "LIBRE" });
    if (!r.ok) throw new Error("souscription");

    expect((await lireQualifications(u.id)).abonnementOuvert).toBe(true);
    // Un paiement ouvrable par ailleurs (la simulation) : c'est la gratuité
    // qui refuse, pas l'absence de pilote.
    const avant = process.env.CHECKOUT_SIMULATION_ENABLED;
    process.env.CHECKOUT_SIMULATION_ENABLED = "1";
    try {
      expect(await ouvrirRenouvellement({ abonnementId: r.abonnementId, abonneId: u.id })).toEqual({ ok: false, motif: "GRATUIT" });
    } finally {
      if (avant === undefined) delete process.env.CHECKOUT_SIMULATION_ENABLED;
      else process.env.CHECKOUT_SIMULATION_ENABLED = avant;
    }

    expect(await quitterForfaitGratuit(u.id)).toEqual({ ok: true });
    expect((await lireQualifications(u.id)).abonnementOuvert).toBe(false);
    expect((await souscrire({ userId: u.id, code: "LIBRE" })).ok).toBe(true);
  });
});
