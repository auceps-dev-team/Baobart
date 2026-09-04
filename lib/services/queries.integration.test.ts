/**
 * Ce que le public voit des services.
 *
 * ─────────────────────────────────────────────────────────────────
 * TROIS INVARIANTS
 *
 *   — seul l'état `PUBLIE` sort ; le reste (SOUMIS, REFUSE, RETIRE) ne fuite
 *     jamais, quel que soit le chemin d'accès ;
 *   — la mise en avant passe devant, mais à égalité c'est la fraîcheur qui
 *     décide — un annuaire où l'argent seul ordonne cesse d'être consulté ;
 *   — un slug de catégorie inconnue rend `null` — jamais un service
 *     appartenant à une autre catégorie par confusion.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  categorieParSlug,
  categoriesPourChoix,
  listerOffres,
  offrePublique,
} from "@/lib/services/queries";

let n = 0;

async function personne() {
  n += 1;
  return db.user.create({
    data: {
      email: `q-${n}@baobart.test`,
      profile: { create: { username: `q-${n}`, displayName: `Awa ${n}` } },
    },
    select: { id: true },
  });
}

async function categorie(input?: { active?: boolean; position?: number; slug?: string }) {
  n += 1;
  return db.serviceCategory.create({
    data: {
      slug: input?.slug ?? `catq-${n}`,
      name: `C${n}`,
      position: input?.position ?? n,
      isActive: input?.active ?? true,
    },
    select: { id: true, slug: true, name: true, position: true },
  });
}

async function service(input: {
  creatorId: string;
  categoryId: string;
  state?: "SOUMIS" | "PUBLIE" | "REFUSE" | "RETIRE";
  featured?: boolean;
  createdAt?: Date;
  titre?: string;
}) {
  n += 1;
  return db.serviceOffer.create({
    data: {
      creatorId: input.creatorId,
      categoryId: input.categoryId,
      title: input.titre ?? `Service ${n}`,
      description: "Prestation sérieusement décrite.",
      startingPrice: 180_000,
      deliveryDays: 10,
      state: input.state ?? "PUBLIE",
      isFeatured: input.featured ?? false,
      createdAt: input.createdAt,
    },
    select: { id: true },
  });
}

beforeEach(() => {
  n = 0;
});

describe("les catégories pour le choix", () => {
  it("liste les actives dans l'ordre de position", async () => {
    const a = await categorie({ position: 30 });
    const b = await categorie({ position: 10 });
    const c = await categorie({ position: 20 });
    // Une catégorie cachée : elle ne sort jamais.
    await categorie({ active: false, position: 5 });

    const liste = await categoriesPourChoix();
    expect(liste.map((c) => c.id)).toEqual([b.id, c.id, a.id]);
  });
});

describe("categorieParSlug", () => {
  it("rend la catégorie active", async () => {
    await categorie({ slug: "test-active", active: true });
    const c = await categorieParSlug("test-active");
    expect(c?.slug).toBe("test-active");
  });

  it("rend null pour une catégorie cachée", async () => {
    // Même règle que « inconnue » : un slug retiré ne doit pas continuer de
    // renvoyer des fiches. On rebascule sur « Tous » à l'écran, on ne 404 pas.
    await categorie({ slug: "test-cachee", active: false });
    expect(await categorieParSlug("test-cachee")).toBeNull();
  });

  it("rend null pour un slug inconnu", async () => {
    expect(await categorieParSlug("nexiste-pas")).toBeNull();
  });
});

describe("listerOffres", () => {
  it("ne renvoie que ce qui est publié", async () => {
    const cat = await categorie();
    const p = await personne();

    await service({ creatorId: p.id, categoryId: cat.id, state: "SOUMIS" });
    await service({ creatorId: p.id, categoryId: cat.id, state: "REFUSE" });
    await service({ creatorId: p.id, categoryId: cat.id, state: "RETIRE" });
    const publiee = await service({
      creatorId: p.id,
      categoryId: cat.id,
      state: "PUBLIE",
    });

    const liste = await listerOffres();
    expect(liste.map((o) => o.id)).toEqual([publiee.id]);
  });

  it("mise en avant devant, puis fraîcheur", async () => {
    const cat = await categorie();
    const p = await personne();

    // Ancienne mais mise en avant : elle passe devant.
    const vieilleMEA = await service({
      creatorId: p.id,
      categoryId: cat.id,
      featured: true,
      createdAt: new Date("2026-01-01"),
    });
    const recente = await service({
      creatorId: p.id,
      categoryId: cat.id,
      createdAt: new Date("2026-08-01"),
    });
    const encoreRecente = await service({
      creatorId: p.id,
      categoryId: cat.id,
      createdAt: new Date("2026-08-15"),
    });

    const liste = await listerOffres();
    expect(liste.map((o) => o.id)).toEqual([
      vieilleMEA.id,
      encoreRecente.id,
      recente.id,
    ]);
  });

  it("filtre par catégorie sans laisser fuir les autres", async () => {
    const catA = await categorie();
    const catB = await categorie();
    const p = await personne();

    const enA = await service({ creatorId: p.id, categoryId: catA.id });
    await service({ creatorId: p.id, categoryId: catB.id });

    const liste = await listerOffres({ categoryId: catA.id });
    expect(liste.map((o) => o.id)).toEqual([enA.id]);
  });
});

describe("offrePublique", () => {
  it("rend une fiche publiée avec créateur, catégorie et description", async () => {
    const cat = await categorie();
    const p = await personne();
    const svc = await service({ creatorId: p.id, categoryId: cat.id, titre: "Charte 10 jours" });

    const fiche = await offrePublique(svc.id);
    expect(fiche?.titre).toBe("Charte 10 jours");
    expect(fiche?.categorie.id).toBe(cat.id);
    expect(fiche?.description).toContain("Prestation");
    expect(fiche?.createurId).toBe(p.id);
    expect(fiche?.createurUsername).toMatch(/^q-/);
  });

  it("ne rend PAS une fiche en relecture, refusée ou retirée", async () => {
    const cat = await categorie();
    const p = await personne();

    for (const state of ["SOUMIS", "REFUSE", "RETIRE"] as const) {
      const svc = await service({ creatorId: p.id, categoryId: cat.id, state });
      expect(await offrePublique(svc.id)).toBeNull();
    }
  });

  it("rend null pour un identifiant qui n'existe pas", async () => {
    expect(await offrePublique("cl00000000000000000000")).toBeNull();
  });
});
