/**
 * Pagination du feed, contre la vraie base.
 *
 * C'est le seul endroit où un bug se voit vraiment : un curseur mal composé ne
 * plante pas, il duplique ou saute des cartes — et personne ne le remarque
 * avant que le feed soit long.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { compterRessources, listerAlaUne, listerFeed } from "@/lib/feed/queries";

async function creerCreateur() {
  return db.user.create({
    data: {
      email: `createur-${Math.random().toString(36).slice(2, 9)}@baobart.test`,
      profile: {
        create: {
          username: `u${Math.random().toString(36).slice(2, 9)}`,
          displayName: "Awa Diallo",
        },
      },
    },
  });
}

async function publier(
  sellerId: string,
  n: number,
  options: { createdAt?: Date; family?: "PHOTO" | "FONT"; staffPicked?: boolean } = {},
) {
  return db.product.create({
    data: {
      sellerId,
      slug: `ressource-${n}-${Math.random().toString(36).slice(2, 7)}`,
      name: `Ressource ${n}`,
      price: n * 1_000,
      currency: "XOF",
      status: "PUBLISHED",
      family: options.family ?? "PHOTO",
      isStaffPicked: options.staffPicked ?? false,
      staffPickedAt: options.staffPicked ? new Date() : null,
      createdAt: options.createdAt ?? new Date(),
    },
  });
}

describe("pagination par curseur", () => {
  let sellerId: string;

  beforeEach(async () => {
    sellerId = (await creerCreateur()).id;
  });

  it("parcourt tout le feed sans doublon ni oubli", async () => {
    const attendus = 10;
    for (let i = 0; i < attendus; i += 1) {
      await publier(sellerId, i, {
        createdAt: new Date(Date.UTC(2026, 6, 1 + i)),
      });
    }

    const vus: string[] = [];
    let cursor: string | null = null;
    let tours = 0;

    do {
      const page = await listerFeed({ cursor, limit: 3 });
      vus.push(...page.items.map((i) => i.id));
      cursor = page.nextCursor;
      tours += 1;
    } while (cursor && tours < 20);

    expect(vus).toHaveLength(attendus);
    expect(new Set(vus).size).toBe(attendus);
  });

  it("rend les cartes de la plus récente à la plus ancienne", async () => {
    for (let i = 0; i < 5; i += 1) {
      await publier(sellerId, i, {
        createdAt: new Date(Date.UTC(2026, 6, 1 + i)),
      });
    }

    const page = await listerFeed({ limit: 5 });
    const dates = page.items.map((i) => i.createdAt.getTime());

    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it("ne boucle pas quand plusieurs cartes partagent la même date", async () => {
    // Le piège classique : sans départage par identifiant, un curseur posé sur
    // une date partagée réaffiche éternellement le même groupe.
    const memeInstant = new Date(Date.UTC(2026, 6, 15, 12, 0, 0));
    for (let i = 0; i < 6; i += 1) {
      await publier(sellerId, i, { createdAt: memeInstant });
    }

    const vus: string[] = [];
    let cursor: string | null = null;
    let tours = 0;

    do {
      const page = await listerFeed({ cursor, limit: 2 });
      vus.push(...page.items.map((i) => i.id));
      cursor = page.nextCursor;
      tours += 1;
    } while (cursor && tours < 20);

    expect(new Set(vus).size).toBe(6);
    expect(tours).toBeLessThan(20);
  });

  it("annonce la fin du feed par un curseur nul", async () => {
    await publier(sellerId, 1);
    const page = await listerFeed({ limit: 10 });

    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  it("ignore un curseur illisible plutôt que d'échouer", async () => {
    await publier(sellerId, 1);
    const page = await listerFeed({ cursor: "pas-un-curseur" });

    expect(page.items).toHaveLength(1);
  });
});

describe("filtres et sélection éditoriale", () => {
  let sellerId: string;

  beforeEach(async () => {
    sellerId = (await creerCreateur()).id;
  });

  it("ne rend que la famille demandée", async () => {
    await publier(sellerId, 1, { family: "PHOTO" });
    await publier(sellerId, 2, { family: "FONT" });
    await publier(sellerId, 3, { family: "FONT" });

    expect((await listerFeed({ filtre: "Font" })).items).toHaveLength(2);
    expect((await listerFeed({ filtre: "Photo" })).items).toHaveLength(1);
    expect((await listerFeed({ filtre: "Tous" })).items).toHaveLength(3);
  });

  it("compte selon le même filtre", async () => {
    await publier(sellerId, 1, { family: "PHOTO" });
    await publier(sellerId, 2, { family: "FONT" });

    expect(await compterRessources("Tous")).toBe(2);
    expect(await compterRessources("Font")).toBe(1);
  });

  it("laisse les brouillons hors du feed", async () => {
    await publier(sellerId, 1);
    await db.product.create({
      data: {
        sellerId,
        slug: "brouillon",
        name: "Pas encore prêt",
        price: 0,
        status: "DRAFT",
      },
    });

    expect((await listerFeed()).items).toHaveLength(1);
  });

  it("ne met à la une que la sélection éditoriale", async () => {
    await publier(sellerId, 1);
    await publier(sellerId, 2, { staffPicked: true });

    const alaUne = await listerAlaUne();
    expect(alaUne).toHaveLength(1);
    expect(alaUne[0]!.isStaffPicked).toBe(true);
  });
});

describe("forme des cartes", () => {
  it("garde la même hauteur de visuel entre deux lectures", async () => {
    // Sinon le feed sauterait à chaque rechargement.
    const sellerId = (await creerCreateur()).id;
    await publier(sellerId, 1);

    const a = (await listerFeed()).items[0]!;
    const b = (await listerFeed()).items[0]!;

    expect(a.visualHeight).toBe(b.visualHeight);
  });

  it("nomme le créateur, avec un repli si le profil manque", async () => {
    const sansProfil = await db.user.create({
      data: { email: `nu-${Math.random().toString(36).slice(2, 9)}@baobart.test` },
    });
    await publier(sansProfil.id, 1);

    expect((await listerFeed()).items[0]!.author).toBe("Créateur Baobart");
  });
});

describe("le feed pendant qu'il bouge", () => {
  let sellerId: string;

  beforeEach(async () => {
    sellerId = (await creerCreateur()).id;
  });

  it("ne saute pas de carte quand une ressource est dépubliée en cours de parcours", async () => {
    // Le cas que la pagination par curseur rend possible : entre deux pages, le
    // créateur retire une ressource. Avec un OFFSET, toutes les cartes suivantes
    // glisseraient d'un rang et une passerait à la trappe.
    for (let i = 0; i < 9; i += 1) {
      await publier(sellerId, i, { createdAt: new Date(Date.UTC(2026, 6, 1 + i)) });
    }

    const page1 = await listerFeed({ limit: 3 });
    expect(page1.items).toHaveLength(3);

    const dejaVus = page1.items.map((i) => i.slug);

    // On dépublie une ressource que le parcours n'a pas encore atteinte.
    const suivante = await db.product.findFirst({
      where: { status: "PUBLISHED", slug: { notIn: dejaVus } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, slug: true },
    });
    await db.product.update({
      where: { id: suivante!.id },
      data: { status: "DRAFT" },
    });

    const page2 = await listerFeed({ limit: 3, cursor: page1.nextCursor });

    // La dépubliée n'apparaît pas…
    expect(page2.items.map((i) => i.slug)).not.toContain(suivante!.slug);
    // …et aucune de celles déjà vues ne revient.
    for (const item of page2.items) {
      expect(dejaVus).not.toContain(item.slug);
    }
  });

  it("ne renvoie jamais deux fois la même carte, même en publiant pendant le parcours", async () => {
    for (let i = 0; i < 6; i += 1) {
      await publier(sellerId, i, { createdAt: new Date(Date.UTC(2026, 6, 1 + i)) });
    }

    const vus = new Set<string>();
    let curseur: string | null = null;
    let pages = 0;

    do {
      const page = await listerFeed({ limit: 2, cursor: curseur });
      for (const item of page.items) {
        // Une carte vue deux fois est le symptôme classique d'un curseur sans
        // départage : deux ressources publiées la même milliseconde.
        expect(vus.has(item.slug), item.slug).toBe(false);
        vus.add(item.slug);
      }

      // On publie une nouveauté au milieu du parcours : plus récente que le
      // curseur, elle ne doit pas s'insérer dans les pages restantes.
      if (pages === 0) {
        await publier(sellerId, 100, { createdAt: new Date(Date.UTC(2026, 7, 1)) });
      }

      curseur = page.nextCursor;
      pages += 1;
    } while (curseur && pages < 10);

    expect(vus.size).toBe(6);
  });
});
