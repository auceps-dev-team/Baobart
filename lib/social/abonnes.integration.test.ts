import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { abonnesDe } from "@/lib/social/queries";
import { basculerSuiviDe } from "@/lib/social/service";

/**
 * La liste des abonnés (lot 5a) confrontée à la vraie base.
 *
 * Ce que les tests purs de `presenterAbonne` ne peuvent pas dire : que la page
 * est découpée en base et dans un ordre total, que le total est celui que tient
 * le compteur, qu'une liste ne mêle pas deux créateurs, et que la règle de la
 * vitrine lit les bonnes colonnes.
 */

const marque = () => randomBytes(4).toString("hex");

async function membre(m: string, nom: string, options: { suspendu?: boolean; ville?: string; specialite?: string } = {}) {
  const u = await db.user.create({
    data: {
      email: `${m}-${nom.toLowerCase()}@abonnes.test`,
      suspendedAt: options.suspendu ? new Date() : null,
      profile: {
        create: {
          username: `${m}-${nom.toLowerCase()}`,
          displayName: nom,
          city: options.ville ?? null,
          speciality: options.specialite ?? null,
        },
      },
    },
    select: { id: true },
  });
  return u.id;
}

async function ressource(m: string, vendeurId: string, status: "PUBLISHED" | "DRAFT") {
  await db.product.create({
    data: { sellerId: vendeurId, slug: `${m}-${status}-${marque()}`, name: "Pack", price: 1_000, currency: "XOF", status },
  });
}

describe("abonnesDe — la liste de ceux qui suivent (lot 5a)", () => {
  it("découpe en base, les plus récents d'abord, et ramène une page hors bornes", async () => {
    const m = marque();
    const createur = await membre(m, "Createur");
    const t0 = Date.UTC(2026, 10, 1);
    const suiveurs: string[] = [];
    for (let i = 0; i < 7; i++) {
      const s = await membre(m, `Suiveur${i}`);
      suiveurs.push(s);
      await db.follow.create({ data: { followerId: s, followingId: createur, createdAt: new Date(t0 + i * 60_000) } });
    }

    const p1 = await abonnesDe(createur, undefined, 3);
    expect(p1).toMatchObject({ total: 7, page: 1, pages: 3 });
    expect(p1.abonnes.map((a) => a.nom)).toEqual(["Suiveur6", "Suiveur5", "Suiveur4"]);

    const p3 = await abonnesDe(createur, "3", 3);
    expect(p3.abonnes.map((a) => a.nom)).toEqual(["Suiveur0"]);

    // Une page qui n'existe pas tombe sur la dernière, une page illisible sur la première.
    expect((await abonnesDe(createur, "99", 3)).page).toBe(3);
    expect((await abonnesDe(createur, "abc", 3)).page).toBe(1);
  });

  it("deux suivis de la même milliseconde ne changent pas de page d'une lecture à l'autre", async () => {
    const m = marque();
    const createur = await membre(m, "Createur");
    const meme = new Date(Date.UTC(2026, 10, 2));
    for (let i = 0; i < 5; i++) {
      const s = await membre(m, `Ex${i}`);
      await db.follow.create({ data: { followerId: s, followingId: createur, createdAt: meme } });
    }
    const lire = async () =>
      [...(await abonnesDe(createur, "1", 2)).abonnes, ...(await abonnesDe(createur, "2", 2)).abonnes, ...(await abonnesDe(createur, "3", 2)).abonnes].map((a) => a.userId);

    const premiere = await lire();
    expect(new Set(premiere).size).toBe(5); // chacun une fois, aucun en double, aucun perdu
    expect(await lire()).toEqual(premiere);
  });

  it("le total est celui du compteur, et la liste ne mêle pas deux créateurs", async () => {
    const m = marque();
    const createur = await membre(m, "Createur");
    const autre = await membre(m, "Autre");
    const a = await membre(m, "Ama");
    const b = await membre(m, "Bintou");

    // Par le vrai geste « Suivre », qui tient le compteur.
    await basculerSuiviDe(a, createur);
    await basculerSuiviDe(b, createur);
    await basculerSuiviDe(a, autre);

    const page = await abonnesDe(createur, undefined, 10);
    const compteur = await db.user.findUniqueOrThrow({ where: { id: createur }, select: { followersCount: true } });
    expect(page.total).toBe(2);
    expect(page.total).toBe(compteur.followersCount);
    expect(page.abonnes.map((x) => x.nom).sort()).toEqual(["Ama", "Bintou"]);

    // Ne plus suivre retire de la liste.
    await basculerSuiviDe(a, createur);
    expect((await abonnesDe(createur, undefined, 10)).abonnes.map((x) => x.nom)).toEqual(["Bintou"]);
  });

  it("la vitrine se lit en base : publiée oui ; brouillon seul ou compte suspendu, non", async () => {
    const m = marque();
    const createur = await membre(m, "Createur");
    const publie = await membre(m, "Publie", { ville: "Dakar", specialite: "Illustration" });
    const brouillon = await membre(m, "Brouillon", { ville: "Lomé", specialite: "Photo" });
    const suspendu = await membre(m, "Suspendu", { suspendu: true, ville: "Accra" });
    await ressource(m, publie, "PUBLISHED");
    await ressource(m, brouillon, "DRAFT");
    await ressource(m, suspendu, "PUBLISHED");
    for (const s of [publie, brouillon, suspendu]) await db.follow.create({ data: { followerId: s, followingId: createur } });

    const parNom = new Map((await abonnesDe(createur, undefined, 10)).abonnes.map((a) => [a.nom, a]));
    expect(parNom.get("Publie")).toMatchObject({ presentation: "Illustration · Dakar", vitrine: `/@${m}-publie`, ecrire: `/@${m}-publie#contact` });
    // La ville que l'abonné a remplie sans vitrine reste chez lui.
    expect(parNom.get("Brouillon")).toMatchObject({ presentation: null, vitrine: null, ecrire: null, avatarUrl: null });
    expect(parNom.get("Suspendu")).toMatchObject({ presentation: null, vitrine: null, ecrire: null });
  });

  it("la notification « Nouvel abonné » mène à la liste, plus à la boutique", async () => {
    const m = marque();
    const createur = await membre(m, "Createur");
    const a = await membre(m, "Ama");
    await basculerSuiviDe(a, createur);
    const avis = await db.notification.findFirstOrThrow({ where: { userId: createur, cle: `in-app:abonne-${a}-${createur}` } });
    expect(avis.lien).toBe("/dashboard/abonnes");
  });
});
