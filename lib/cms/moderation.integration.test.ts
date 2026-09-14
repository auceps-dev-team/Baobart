/**
 * La file de modération, avec ses trois sources qui se mélangent.
 *
 * ─────────────────────────────────────────────────────────────────
 * TROIS PROPRIÉTÉS QUI COMPTENT
 *
 *   — offres, services et événements se mélangent dans la même file : un
 *     modérateur ne travaille pas par type ;
 *   — le plus ancien d'abord, sans exception. Trier à l'envers ferait
 *     vieillir indéfiniment les fiches du bas ;
 *   — chacun n'y voit que ce qu'il peut trancher. Les trois n'exigent pas le
 *     même pouvoir, et montrer une fiche dont les boutons échoueront est la
 *     même faute qu'une entrée de menu qui mène à un 404 (v1.48.8).
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

async function evenement(soumis: Date) {
  const org = await personne();
  n += 1;
  return db.event.create({
    data: {
      organizerId: org.id,
      title: `Atelier ${n}`,
      description: "Deux jours pour apprendre la sérigraphie sur tissu.",
      kind: "WORKSHOP",
      startsAt: new Date("2026-10-10T14:00:00Z"),
      endsAt: new Date("2026-10-11T18:00:00Z"),
      location: "Abidjan, Cocody",
      capacity: 12,
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
  it("mélange les trois sources, du plus ancien au plus récent", async () => {
    const j1 = await offreEmploi(new Date("2026-08-01"));
    const s1 = await service(new Date("2026-08-02"));
    const e1 = await evenement(new Date("2026-08-03"));
    const j2 = await offreEmploi(new Date("2026-08-04"));

    const file = await fileDeModeration("ADMIN");
    expect(file.map((e) => e.id)).toEqual([j1.id, s1.id, e1.id, j2.id]);
    expect(file.map((e) => e.type)).toEqual([
      "job",
      "service",
      "evenement",
      "job",
    ]);
  });

  it("porte les faits utiles pour un service (catégorie, prix, délai)", async () => {
    const s = await service(new Date("2026-08-01"));
    const [item] = await fileDeModeration("ADMIN");
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

    expect(await fileDeModeration("ADMIN")).toHaveLength(0);
    expect(await combienAttendent("ADMIN")).toBe(0);
  });

  it("compte les trois sources ensemble", async () => {
    await offreEmploi(new Date());
    await service(new Date());
    await evenement(new Date());
    expect(await combienAttendent("ADMIN")).toBe(3);
  });

  it("porte les faits utiles pour un événement (quand, où, combien)", async () => {
    // Une date passée ou un lieu absent sont les deux motifs de refus les plus
    // fréquents : ils doivent se voir sans ouvrir la fiche.
    const e = await evenement(new Date("2026-08-01"));
    const [item] = await fileDeModeration("ADMIN");

    expect(item?.id).toBe(e.id);
    expect(item?.type).toBe("evenement");
    expect(item?.meta).toContain("Abidjan, Cocody");
    expect(item?.meta).toContain("12 places");
    expect(item?.meta).toMatch(/10 oct/);
    // Pas d'URL externe : on s'inscrit sur Baobart, pas ailleurs.
    expect(item?.urlExterne).toBeNull();
    expect(item?.verifie).toBe(false);
  });
});

describe("ce que chacun voit", () => {
  it("cache les événements au modérateur", async () => {
    // Il ne peut pas les publier — `publier_du_contenu` ne lui appartient pas.
    // Les lui montrer promettrait des boutons qui répondraient non.
    await offreEmploi(new Date("2026-08-01"));
    await service(new Date("2026-08-02"));
    await evenement(new Date("2026-08-03"));

    const file = await fileDeModeration("MODERATOR");
    expect(file.map((e) => e.type)).toEqual(["job", "service"]);
    expect(await combienAttendent("MODERATOR")).toBe(2);
  });

  it("ne montre à l'éditorial que les événements", async () => {
    await offreEmploi(new Date("2026-08-01"));
    await service(new Date("2026-08-02"));
    const e = await evenement(new Date("2026-08-03"));

    const file = await fileDeModeration("CONTENT_MANAGER");
    expect(file.map((e) => e.id)).toEqual([e.id]);
    expect(await combienAttendent("CONTENT_MANAGER")).toBe(1);
  });

  it("ne montre rien à qui ne relit rien", async () => {
    // La file et la garde de la page doivent s'accorder : un comptable reçoit
    // un 404 sur l'écran, et zéro ligne ici. Si les deux divergeaient un jour,
    // ce serait la file qui aurait tort.
    await offreEmploi(new Date("2026-08-01"));
    await evenement(new Date("2026-08-02"));

    expect(await fileDeModeration("ACCOUNTANT")).toHaveLength(0);
    expect(await combienAttendent("ACCOUNTANT")).toBe(0);
    expect(await fileDeModeration("MEMBER")).toHaveLength(0);
  });
});
