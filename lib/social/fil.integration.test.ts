import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { compteursDuFil, filDesSuivis, filVuJusquA, marquerFilVu, suivisRecents } from "@/lib/social/fil";

/**
 * Le fil « Suivre les détails » (lot 5b) et sa date de première publication,
 * contre la vraie base.
 *
 * La date est posée par un DÉCLENCHEUR (migration
 * `20261124100000_premiere_publication`) : ces tests passent par chacune des
 * façons d'écrire l'état — `create`, `update`, `updateMany`, et du SQL brut
 * comme en écrirait un script. Ce sont celles qu'emploient les huit chemins
 * relevés le 24/11 (publication, levée d'une sanction, levée d'un retrait
 * juridique, scripts et jeux de démonstration).
 */

const marque = () => randomBytes(4).toString("hex");

async function membre(m: string, nom: string, options: { suspendu?: boolean } = {}) {
  const u = await db.user.create({
    data: {
      email: `${m}-${nom.toLowerCase()}@fil.test`,
      suspendedAt: options.suspendu ? new Date() : null,
      profile: { create: { username: `${m}-${nom.toLowerCase()}`, displayName: nom } },
    },
    select: { id: true },
  });
  return u.id;
}

async function ressource(m: string, vendeurId: string, data: { status: "PUBLISHED" | "DRAFT"; firstPublishedAt?: Date; nom?: string; price?: number }) {
  const p = await db.product.create({
    data: {
      sellerId: vendeurId,
      slug: `${m}-${marque()}`,
      name: data.nom ?? "Pack",
      price: data.price ?? 2_000,
      currency: "XOF",
      family: "PACK",
      status: data.status,
      firstPublishedAt: data.firstPublishedAt,
    },
    select: { id: true },
  });
  return p.id;
}

const dateDe = async (id: string) =>
  (await db.product.findUniqueOrThrow({ where: { id }, select: { firstPublishedAt: true } })).firstPublishedAt;

describe("la date de première publication, posée par la base", () => {
  it("à la création : une ressource publiée reçoit sa date, un brouillon n'en a pas", async () => {
    const m = marque();
    const v = await membre(m, "Vendeur");
    const avant = Date.now() - 60_000;
    const publiee = await ressource(m, v, { status: "PUBLISHED" });
    const brouillon = await ressource(m, v, { status: "DRAFT" });
    expect((await dateDe(publiee))!.getTime()).toBeGreaterThan(avant);
    expect(await dateDe(brouillon)).toBeNull();
  });

  it("une date fournie à la création est respectée (un jeu de démonstration date ses ressources)", async () => {
    const m = marque();
    const v = await membre(m, "Vendeur");
    const passee = new Date(Date.UTC(2026, 0, 15));
    expect(await dateDe(await ressource(m, v, { status: "PUBLISHED", firstPublishedAt: passee }))).toEqual(passee);
  });

  it("publier un brouillon la pose ; dépublier puis republier ne la change pas", async () => {
    const m = marque();
    const v = await membre(m, "Vendeur");
    const id = await ressource(m, v, { status: "DRAFT" });

    await db.product.update({ where: { id }, data: { status: "PUBLISHED" } }); // le geste « Publier »
    const premiere = await dateDe(id);
    expect(premiere).not.toBeNull();

    await db.product.update({ where: { id }, data: { status: "DRAFT" } }); // « Dépublier »
    expect(await dateDe(id)).toEqual(premiere);
    await new Promise((r) => setTimeout(r, 20));
    await db.product.update({ where: { id }, data: { status: "PUBLISHED" } }); // republier
    expect(await dateDe(id)).toEqual(premiere); // pas réannoncée
  });

  it("une date posée ne s'efface pas et ne se réécrit pas", async () => {
    const m = marque();
    const v = await membre(m, "Vendeur");
    const id = await ressource(m, v, { status: "PUBLISHED" });
    const premiere = await dateDe(id);
    await db.product.update({ where: { id }, data: { firstPublishedAt: null } });
    expect(await dateDe(id)).toEqual(premiere);
    await db.product.update({ where: { id }, data: { firstPublishedAt: new Date(Date.UTC(2020, 0, 1)) } });
    expect(await dateDe(id)).toEqual(premiere);
  });

  it("une mise à jour groupée (la levée d'une sanction de risque) et du SQL brut (un script) la posent aussi", async () => {
    const m = marque();
    const v = await membre(m, "Vendeur");
    const archivee = await ressource(m, v, { status: "DRAFT" });
    await db.product.updateMany({ where: { id: archivee }, data: { status: "ARCHIVED" } });
    expect(await dateDe(archivee)).toBeNull(); // archivée sans avoir été publiée : toujours pas de date
    await db.product.updateMany({ where: { id: archivee }, data: { status: "PUBLISHED" } });
    expect(await dateDe(archivee)).not.toBeNull();

    const slug = `${m}-brut`;
    await db.$executeRaw`
      INSERT INTO "Product" ("id", "sellerId", "slug", "name", "price", "currency", "status", "updatedAt")
      VALUES (${`${m}brut`}, ${v}, ${slug}, 'Brut', 1000, 'XOF', 'PUBLISHED', now())
    `;
    expect(await dateDe(`${m}brut`)).not.toBeNull();
  });
});

describe("le fil des créateurs suivis", () => {
  it("ce que publient ceux qu'on suit, les plus récentes d'abord — ni brouillon, ni créateur suspendu, ni inconnu", async () => {
    const m = marque();
    const moi = await membre(m, "Moi");
    const kofi = await membre(m, "Kofi");
    const suspendue = await membre(m, "Suspendue", { suspendu: true });
    const inconnue = await membre(m, "Inconnue");
    for (const c of [kofi, suspendue]) await db.follow.create({ data: { followerId: moi, followingId: c } });

    const t = (j: number) => new Date(Date.UTC(2026, 10, j, 10));
    await ressource(m, kofi, { status: "PUBLISHED", firstPublishedAt: t(10), nom: "Ancienne" });
    await ressource(m, kofi, { status: "PUBLISHED", firstPublishedAt: t(20), nom: "Récente", price: 0 });
    await ressource(m, kofi, { status: "DRAFT", nom: "Brouillon" });
    await ressource(m, suspendue, { status: "PUBLISHED", firstPublishedAt: t(21), nom: "De la suspendue" });
    await ressource(m, inconnue, { status: "PUBLISHED", firstPublishedAt: t(22), nom: "D'une inconnue" });

    const fil = await filDesSuivis(moi, undefined, 10, null);
    expect(fil.total).toBe(2);
    expect(fil.publications.map((p) => p.titre)).toEqual(["Récente", "Ancienne"]);
    expect(fil.publications[0]).toMatchObject({ auteur: "Kofi", famille: "Pack", prix: "gratuit" });

    // Paginé en base : une par page, la seconde est l'ancienne.
    const page2 = await filDesSuivis(moi, "2", 1, null);
    expect(page2).toMatchObject({ page: 2, pages: 2 });
    expect(page2.publications.map((p) => p.titre)).toEqual(["Ancienne"]);
  });

  it("NOUVEAU depuis la dernière visite, VU avant ; jamais venu, tout est nouveau", async () => {
    const m = marque();
    const moi = await membre(m, "Moi");
    const kofi = await membre(m, "Kofi");
    await db.follow.create({ data: { followerId: moi, followingId: kofi } });
    await ressource(m, kofi, { status: "PUBLISHED", firstPublishedAt: new Date(Date.UTC(2026, 10, 10)), nom: "Vue" });
    await ressource(m, kofi, { status: "PUBLISHED", firstPublishedAt: new Date(Date.UTC(2026, 10, 20)), nom: "Nouvelle" });

    const jamais = await filDesSuivis(moi, undefined, 10, null);
    expect(jamais.publications.map((p) => p.etat)).toEqual(["NOUVEAU", "NOUVEAU"]);

    const etats = await filDesSuivis(moi, undefined, 10, new Date(Date.UTC(2026, 10, 15)));
    expect(etats.publications.map((p) => `${p.titre}:${p.etat}`)).toEqual(["Nouvelle:NOUVEAU", "Vue:VU"]);
  });

  it("les trois compteurs : abonnés et ceux du mois, abonnements, publications de la semaine", async () => {
    const m = marque();
    const moi = await membre(m, "Moi");
    const kofi = await membre(m, "Kofi");
    const ancien = await membre(m, "Ancien");
    const recent = await membre(m, "Recent");
    const maintenant = new Date(Date.UTC(2026, 10, 24, 12)); // mardi
    await db.follow.create({ data: { followerId: moi, followingId: kofi } });
    await db.follow.create({ data: { followerId: ancien, followingId: moi, createdAt: new Date(Date.UTC(2026, 9, 5)) } });
    await db.follow.create({ data: { followerId: recent, followingId: moi, createdAt: new Date(Date.UTC(2026, 10, 3)) } });
    await ressource(m, kofi, { status: "PUBLISHED", firstPublishedAt: new Date(Date.UTC(2026, 10, 23, 8)) }); // lundi : cette semaine
    await ressource(m, kofi, { status: "PUBLISHED", firstPublishedAt: new Date(Date.UTC(2026, 10, 22, 23)) }); // dimanche : la semaine d'avant

    expect(await compteursDuFil(moi, maintenant)).toEqual({ abonnes: 2, abonnesCeMois: 1, abonnements: 1, publicationsCetteSemaine: 1 });
  });

  it("les créateurs suivis récemment, présentés comme les abonnés : rien que ce que leur vitrine montre", async () => {
    const m = marque();
    const moi = await membre(m, "Moi");
    const avecVitrine = await membre(m, "Vitrine");
    const sansVitrine = await membre(m, "Sansvitrine");
    await db.profile.update({ where: { userId: avecVitrine }, data: { city: "Accra", speciality: "Motion" } });
    await db.profile.update({ where: { userId: sansVitrine }, data: { city: "Lomé" } });
    await ressource(m, avecVitrine, { status: "PUBLISHED" });
    await db.follow.create({ data: { followerId: moi, followingId: avecVitrine, createdAt: new Date(Date.UTC(2026, 10, 1)) } });
    await db.follow.create({ data: { followerId: moi, followingId: sansVitrine, createdAt: new Date(Date.UTC(2026, 10, 2)) } });

    const suivis = await suivisRecents(moi, 2);
    expect(suivis.map((s) => s.nom)).toEqual(["Sansvitrine", "Vitrine"]);
    expect(suivis[0]).toMatchObject({ presentation: null, vitrine: null });
    expect(suivis[1]).toMatchObject({ presentation: "Motion · Accra" });
  });
});

describe("la marque « fil vu »", () => {
  it("avance, ne recule jamais (deux onglets), et ne va pas dans le futur", async () => {
    const m = marque();
    const moi = await membre(m, "Moi");
    const maintenant = new Date(Date.UTC(2026, 10, 24, 12));
    const onze = new Date(Date.UTC(2026, 10, 24, 11));

    expect(await marquerFilVu(moi, onze, maintenant)).toBe(true);
    expect(await filVuJusquA(moi)).toEqual(onze);
    expect(await marquerFilVu(moi, new Date(Date.UTC(2026, 10, 24, 10)), maintenant)).toBe(false); // l'onglet plus ancien
    expect(await filVuJusquA(moi)).toEqual(onze);
    expect(await marquerFilVu(moi, new Date(Date.UTC(2030, 0, 1)), maintenant)).toBe(true);
    expect(await filVuJusquA(moi)).toEqual(maintenant);
  });
});
