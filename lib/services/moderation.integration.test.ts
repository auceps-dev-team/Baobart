/**
 * Trancher sur un service — contre la vraie base.
 *
 * ─────────────────────────────────────────────────────────────────
 * QUATRE PROPRIÉTÉS PARTAGÉES AVEC JOBS
 *
 *   — la machine à états refuse ce qui ne se dit pas (publier depuis PUBLIE) ;
 *   — un refus sans motif est indéfendable — donc refusé ;
 *   — deux modérateurs sur la même fiche : seul le premier tranche ;
 *   — la trace d'audit est écrite APRÈS l'acte, jamais avant.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { trancher } from "@/lib/services/moderation";

let n = 0;

async function moderateur() {
  n += 1;
  return db.user.create({
    data: { email: `mod-${n}@baobart.test`, platformRole: "MODERATOR" },
    select: { id: true },
  });
}

async function categorie() {
  n += 1;
  return db.serviceCategory.create({
    data: { slug: `cat-${n}`, name: `C${n}`, position: n },
    select: { id: true },
  });
}

async function creerService(state: "SOUMIS" | "PUBLIE" | "REFUSE" = "SOUMIS") {
  const cat = await categorie();
  n += 1;
  const p = await db.user.create({
    data: { email: `creator-${n}@baobart.test` },
    select: { id: true },
  });
  return db.serviceOffer.create({
    data: {
      creatorId: p.id,
      categoryId: cat.id,
      title: `Service ${n}`,
      description: "Une prestation soignée, décrite avec assez de mots pour être exploitable.",
      startingPrice: 180_000,
      deliveryDays: 10,
      state,
    },
    select: { id: true, state: true, creatorId: true },
  });
}

beforeEach(() => {
  n = 0;
});

describe("trancher un service", () => {
  it("publie un service en attente", async () => {
    const mod = await moderateur();
    const svc = await creerService("SOUMIS");

    const suite = await trancher({
      offreId: svc.id,
      geste: "publier",
      moderateurId: mod.id,
    });

    expect(suite).toEqual({ ok: true, vers: "PUBLIE" });

    const apres = await db.serviceOffer.findUniqueOrThrow({
      where: { id: svc.id },
      select: { state: true, moderatedAt: true, moderatorId: true, refusedReason: true },
    });
    expect(apres.state).toBe("PUBLIE");
    expect(apres.moderatorId).toBe(mod.id);
    expect(apres.moderatedAt).not.toBeNull();
    expect(apres.refusedReason).toBeNull();

    const trace = await db.auditLog.findFirst({
      where: { actorId: mod.id, resource: `service:${svc.id}` },
    });
    expect(trace?.action).toBe("contenu.approuver");
  });

  it("refuse avec motif, garde le texte, marque REFUSE", async () => {
    const mod = await moderateur();
    const svc = await creerService("SOUMIS");

    const suite = await trancher({
      offreId: svc.id,
      geste: "refuser",
      moderateurId: mod.id,
      motif: "Prix suspect, description confuse — à retravailler.",
    });

    expect(suite).toEqual({ ok: true, vers: "REFUSE" });
    const apres = await db.serviceOffer.findUniqueOrThrow({
      where: { id: svc.id },
      select: { state: true, refusedReason: true },
    });
    expect(apres.state).toBe("REFUSE");
    expect(apres.refusedReason).toContain("suspect");
  });

  it("refuse un refus sans motif", async () => {
    const mod = await moderateur();
    const svc = await creerService("SOUMIS");

    const suite = await trancher({
      offreId: svc.id,
      geste: "refuser",
      moderateurId: mod.id,
      motif: "  ",
    });

    expect(suite).toEqual({ ok: false, motif: "MOTIF_REQUIS" });
    // Rien n'a bougé, et rien n'a été audité.
    const apres = await db.serviceOffer.findUniqueOrThrow({
      where: { id: svc.id },
      select: { state: true, moderatedAt: true },
    });
    expect(apres.state).toBe("SOUMIS");
    expect(apres.moderatedAt).toBeNull();
    expect(await db.auditLog.count()).toBe(0);
  });

  it("efface un ancien motif quand on rebascule vers publié", async () => {
    // Refusé, puis remis en SOUMIS par le module cycle, puis publié : le
    // motif ne doit pas traîner sur une fiche finalement publiée.
    const mod = await moderateur();
    const svc = await creerService("REFUSE");

    // Sur le cycle : REFUSE → SOUMIS par « remettre_en_relecture » ? Regardons
    // le geste « publier » directement depuis REFUSE :
    // On simule en remettant SOUMIS à la main pour tester la logique du motif.
    await db.serviceOffer.update({
      where: { id: svc.id },
      data: { state: "SOUMIS", refusedReason: "Vieux motif à effacer" },
    });

    await trancher({ offreId: svc.id, geste: "publier", moderateurId: mod.id });

    const apres = await db.serviceOffer.findUniqueOrThrow({
      where: { id: svc.id },
      select: { refusedReason: true },
    });
    expect(apres.refusedReason).toBeNull();
  });

  it("refuse une transition interdite", async () => {
    // On tente de publier une offre déjà publiée.
    const mod = await moderateur();
    const svc = await creerService("PUBLIE");

    const suite = await trancher({
      offreId: svc.id,
      geste: "publier",
      moderateurId: mod.id,
    });

    expect(suite).toEqual({ ok: false, motif: "TRANSITION_INTERDITE" });
  });

  it("refuse une fiche qui n'existe pas", async () => {
    const mod = await moderateur();
    const suite = await trancher({
      offreId: "cl00000000000000000000",
      geste: "publier",
      moderateurId: mod.id,
    });
    expect(suite).toEqual({ ok: false, motif: "INTROUVABLE" });
  });

  it("ne laisse pas deux modérateurs trancher la même fiche", async () => {
    // On simule la course : la première fiche a été publiée par quelqu'un,
    // la seconde `updateMany` ne trouvera pas la ligne dans l'état attendu.
    const mod = await moderateur();
    const svc = await creerService("SOUMIS");

    // Premier tranche.
    await trancher({ offreId: svc.id, geste: "publier", moderateurId: mod.id });

    // Un second modérateur ouvre son écran (donc voit encore SOUMIS chez lui)
    // et tranche.
    const suite = await trancher({
      offreId: svc.id,
      geste: "refuser",
      moderateurId: mod.id,
      motif: "Motif suffisamment long.",
    });

    expect(suite).toEqual({ ok: false, motif: "TRANSITION_INTERDITE" });
  });
});
