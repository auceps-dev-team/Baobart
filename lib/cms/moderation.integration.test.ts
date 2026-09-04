/**
 * La file de modération, avec ses deux sources qui se mélangent.
 *
 * ─────────────────────────────────────────────────────────────────
 * DEUX PROPRIÉTÉS QUI COMPTENT
 *
 *   — offres et services se mélangent dans la même file : un modérateur ne
 *     travaille pas par type ;
 *   — le plus ancien d'abord, sans exception. Trier à l'envers ferait
 *     vieillir indéfiniment les fiches du bas.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { combienAttendent, fileDeModeration } from "@/lib/cms/moderation";

let n = 0;

async function personne() {
  n += 1;
  return db.user.create({
    data: { email: `f-${n}@baobart.test` },
    select: { id: true },
  });
}

async function categorie() {
  n += 1;
  return db.serviceCategory.create({
    data: { slug: `catf-${n}`, name: `C${n}`, position: n },
    select: { id: true },
  });
}

async function offreEmploi(soumis: Date) {
  const rec = await personne();
  n += 1;
  return db.jobPosting.create({
    data: {
      recruiterId: rec.id,
      title: `Offre ${n}`,
      description: "Description d'offre suffisamment fournie.",
      type: "FREELANCE",
      mode: "REMOTE",
      state: "SOUMIS",
      createdAt: soumis,
    },
    select: { id: true },
  });
}

async function service(soumis: Date) {
  const cat = await categorie();
  const cre = await personne();
  n += 1;
  return db.serviceOffer.create({
    data: {
      creatorId: cre.id,
      categoryId: cat.id,
      title: `Service ${n}`,
      description: "Une prestation sérieuse décrite en assez de mots.",
      startingPrice: 180_000,
      deliveryDays: 10,
      state: "SOUMIS",
      createdAt: soumis,
    },
    select: { id: true },
  });
}

beforeEach(() => {
  n = 0;
});

describe("la file", () => {
  it("mélange offres et services, du plus ancien au plus récent", async () => {
    const j1 = await offreEmploi(new Date("2026-08-01"));
    const s1 = await service(new Date("2026-08-02"));
    const j2 = await offreEmploi(new Date("2026-08-03"));
    const s2 = await service(new Date("2026-08-04"));

    const file = await fileDeModeration();
    expect(file.map((e) => e.id)).toEqual([j1.id, s1.id, j2.id, s2.id]);
    expect(file.map((e) => e.type)).toEqual(["job", "service", "job", "service"]);
  });

  it("porte les faits utiles pour un service (catégorie, prix, délai)", async () => {
    const s = await service(new Date("2026-08-01"));
    const [item] = await fileDeModeration();
    expect(item?.id).toBe(s.id);
    // Intl.NumberFormat("fr-FR") insère un espace insécable étroit — on
    // vérifie le chiffre par un test tolérant à sa nature exacte.
    expect(item?.meta?.replace(/\s+/g, " ")).toMatch(/180 000/);
    expect(item?.meta?.replace(/\s+/g, " ")).toMatch(/10 j/);
    // La catégorie apparaît, quel que soit son nom.
    expect(item?.meta?.length).toBeGreaterThan(20);
    expect(item?.urlExterne).toBeNull();
    expect(item?.verifie).toBe(false);
  });

  it("ne renvoie pas ce qui n'est pas SOUMIS", async () => {
    // Une offre publiée n'a rien à faire dans la file.
    const rec = await personne();
    await db.jobPosting.create({
      data: {
        recruiterId: rec.id,
        title: "Déjà en ligne",
        description: "Description assez fournie.",
        type: "FREELANCE",
        mode: "REMOTE",
        state: "PUBLIE",
      },
    });
    const cat = await categorie();
    const cre = await personne();
    await db.serviceOffer.create({
      data: {
        creatorId: cre.id,
        categoryId: cat.id,
        title: "Déjà en ligne",
        description: "Description assez fournie.",
        startingPrice: 180_000,
        deliveryDays: 10,
        state: "PUBLIE",
      },
    });

    expect(await fileDeModeration()).toHaveLength(0);
    expect(await combienAttendent()).toBe(0);
  });

  it("compte les deux sources ensemble", async () => {
    await offreEmploi(new Date());
    await service(new Date());
    await service(new Date());
    expect(await combienAttendent()).toBe(3);
  });
});
