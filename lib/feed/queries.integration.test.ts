/**
 * Pagination du feed, contre la vraie base.
 *
 * C'est le seul endroit où un bug se voit vraiment : un curseur mal composé ne
 * plante pas, il duplique ou saute des cartes — et personne ne le remarque
 * avant que le feed soit long.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  compterCommunaute,
  compterRessources,
  listerAlaUne,
  listerFeed,
  rayonsDeLaBibliotheque,
  rechercher,
  vitrineDuHero,
} from "@/lib/feed/queries";

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

describe("les chiffres de l'accueil", () => {
  it("rangent la bibliothèque par famille, avec des comptes et des couvertures réels", async () => {
    // La maquette annonçait « Wax 18 pièces, Portraits 24 pièces » : aucune de
    // ces collections n'existait (relevé le 04/10).
    const c = await creerCreateur();
    await publier(c.id, 1, { family: "PHOTO" });
    await publier(c.id, 2, { family: "PHOTO" });
    const police = await publier(c.id, 3, { family: "FONT" });
    await db.product.update({ where: { id: police.id }, data: { coverUrl: "/img/demo/neon-02.png" } });

    expect(await rayonsDeLaBibliotheque()).toEqual([
      { famille: "Photo", total: 2, couverture: null },
      { famille: "Font", total: 1, couverture: "/img/demo/neon-02.png" },
    ]);
  });

  it("montrent en vitrine trois vraies ressources, chacune choisie sur son vrai chiffre", async () => {
    // La maquette y posait « Ankara Editorial · 24 visuels » et « 2 340 dl ».
    const c = await creerCreateur();
    const avec = (n: number, data: Record<string, unknown>) =>
      publier(c.id, n).then((p) => db.product.update({ where: { id: p.id }, data: { coverUrl: `/img/${n}.png`, ...data } }));
    const choisie = await avec(1, { price: 5_000, isStaffPicked: true, staffPickedAt: new Date() });
    await avec(2, { price: 0, downloadsCount: 4 });
    const offerte = await avec(3, { price: 0, downloadsCount: 40 });
    const vendue = await avec(4, { price: 8_000, salesCount: 9 });
    await avec(5, { price: 9_000, salesCount: 2 });
    await publier(c.id, 6); // sans couverture : jamais en vitrine

    const v = await vitrineDuHero();
    expect(v.principale?.slug).toBe(choisie.slug);
    expect(v.gratuite).toMatchObject({ slug: offerte.slug, detail: "gratuit · 40 téléchargements" });
    expect(v.payante?.slug).toBe(vendue.slug);
    expect(v.payante?.detail).toMatch(/· 9 ventes$/);
  });

  it("laissent la vitrine vide plutôt que d'inventer", async () => {
    expect(await vitrineDuHero()).toEqual({ principale: null, gratuite: null, payante: null });
  });

  it("ne comptent comme créatifs que ceux qui publient", async () => {
    // Le compteur prenait tous les profils : 20 « créatifs » pour 8 qui publiaient.
    const actif = await creerCreateur();
    await publier(actif.id, 1);
    await creerCreateur(); // un acheteur, sans rien de publié
    const suspendu = await creerCreateur();
    await publier(suspendu.id, 2);
    await db.user.update({ where: { id: suspendu.id }, data: { suspendedAt: new Date() } });

    expect((await compterCommunaute()).createurs).toBe(1);
  });
});

describe("la recherche", () => {
  it("ne casse pas sur un octet nul, et cherche quand même le reste", async () => {
    // Mesuré le 25/09 (Qualitytest R79b) : « ?q=%00 » → HTTP 500.
    const c = await creerCreateur();
    await publier(c.id, 7);

    await expect(rechercher("\u0000")).resolves.toEqual([]);
    const trouves = await rechercher("Resso\u0000urce 7");
    expect(trouves.map((t) => t.title)).toEqual(["Ressource 7"]);
  });

  it("trouve aussi par mot-clé, accents et casse ignorés, le titre d'abord", async () => {
    // Les mots-clés étaient saisis et lus nulle part (relevé le 04/10).
    const c = await creerCreateur();
    const s = Math.random().toString(36).slice(2, 7);
    const parMot = await publier(c.id, 8);
    await db.product.update({
      where: { id: parMot.id },
      data: { name: `Pack graphique ${s}`, tags: { create: [{ tag: { create: { slug: `bogolan-${s}`, name: `Bogolan ${s}` } } }] } },
    });
    const parTitre = await publier(c.id, 9);
    await db.product.update({ where: { id: parTitre.id }, data: { name: `Motifs Bogolan ${s}` } });

    expect((await rechercher(`bogolan ${s}`)).map((t) => t.slug)).toEqual([parTitre.slug, parMot.slug]);
    // Le mot-clé se compare par son slug : l'accent et la casse tombent. Le
    // titre, lui, est comparé tel quel (ILIKE) — « Á » n'y trouve pas « a ».
    expect((await rechercher(`BOGOLÁN ${s}`)).map((t) => t.slug)).toEqual([parMot.slug]);
  });
});

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
