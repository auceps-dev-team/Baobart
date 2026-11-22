import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { anonymiser } from "@/lib/rgpd/effacement";
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

describe("« Nouvel abonné » nomme le suiveur, et l'effacement l'en retire (décision du 21/11)", () => {
  /** Un créateur qui a ALLUMÉ le courriel de cet avis (éteint par défaut) : l'avis existe alors sur les deux canaux. */
  async function createurAvecCourriel(m: string) {
    const id = await membre(m, "Createur");
    await db.notificationPreference.create({ data: { userId: id, evenement: "NOUVEL_ABONNE", canal: "COURRIEL", actif: true } });
    return id;
  }

  it("l'avis dit le nom affiché du suiveur, en cloche et en courriel — jamais son adresse", async () => {
    const m = marque();
    const createur = await createurAvecCourriel(m);
    const ama = await membre(m, "Ama");
    await basculerSuiviDe(ama, createur);

    const avis = await db.notification.findFirstOrThrow({ where: { cle: `in-app:abonne-${ama}-${createur}` } });
    expect(avis.corps).toBe("Ama suit désormais ta boutique.");
    expect(avis.corps).not.toContain("@");
    const courriel = await db.emailOutbox.findUniqueOrThrow({ where: { idempotencyKey: `courriel:abonne-${ama}-${createur}` } });
    expect(courriel.payload).toMatchObject({ suiveur: "Ama" });
  });

  it("effacer le suiveur retire son nom chez le créateur, cloche et courriel ; l'avis d'un autre reste", async () => {
    const m = marque();
    const createur = await createurAvecCourriel(m);
    const efface = await membre(m, "Efface");
    const reste = await membre(m, "Reste");
    await basculerSuiviDe(efface, createur);
    await basculerSuiviDe(reste, createur);

    await anonymiser(efface);

    const avis = await db.notification.findMany({ where: { userId: createur }, select: { corps: true } });
    const courriels = await db.emailOutbox.findMany({ where: { idempotencyKey: { contains: createur } }, select: { payload: true } });
    // Le nom de l'effacé n'est plus nulle part chez le créateur…
    expect(JSON.stringify([avis, courriels])).not.toContain("Efface");
    // …et l'avis de l'autre suiveur est toujours là, sur les deux canaux.
    expect(avis.map((a) => a.corps)).toEqual(["Reste suit désormais ta boutique."]);
    expect(courriels).toHaveLength(1);
  });

  it("les courriels adressés à la personne effacée partent avec elle, ceux des autres restent", async () => {
    const m = marque();
    const efface = await membre(m, "Destinataire");
    const autre = await membre(m, "Autre");
    const adresse = (id: string) => db.user.findUniqueOrThrow({ where: { id }, select: { email: true } }).then((u) => u.email);
    const poser = async (id: string, n: string, majuscules = false) =>
      db.emailOutbox.create({
        data: {
          idempotencyKey: `test-${m}-${n}`,
          recipient: majuscules ? (await adresse(id)).toUpperCase() : await adresse(id),
          template: "BIENVENUE",
          payload: { nom: n },
        },
      });
    await poser(efface, "en-attente");
    await poser(efface, "casse-differente", true);
    await poser(autre, "autre");

    await anonymiser(efface);

    const restants = await db.emailOutbox.findMany({ where: { idempotencyKey: { startsWith: `test-${m}-` } }, select: { idempotencyKey: true } });
    expect(restants.map((r) => r.idempotencyKey)).toEqual([`test-${m}-autre`]);
  });
});

describe("l'effacement remet les compteurs de suivi d'aplomb, des deux côtés", () => {
  it("effacer un suiveur recompte le créateur ; effacer un créateur recompte ceux qui le suivaient", async () => {
    const m = marque();
    const createur = await membre(m, "Createur");
    const autreCreateur = await membre(m, "Autre");
    const suiveur = await membre(m, "Suiveur");
    const fidele = await membre(m, "Fidele");
    // Par le vrai geste : les compteurs partent justes.
    await basculerSuiviDe(suiveur, createur);
    await basculerSuiviDe(fidele, createur);
    await basculerSuiviDe(fidele, autreCreateur);

    await anonymiser(suiveur);
    const apres = await db.user.findUniqueOrThrow({ where: { id: createur }, select: { followersCount: true, profile: { select: { followerCount: true } } } });
    expect(apres.followersCount).toBe(1);
    expect(apres.profile?.followerCount).toBe(1);
    expect((await abonnesDe(createur, undefined, 10)).total).toBe(apres.followersCount);

    // L'autre sens : le créateur effacé, celle qui le suivait ne suit plus qu'un créateur.
    await anonymiser(createur);
    const fideleApres = await db.user.findUniqueOrThrow({ where: { id: fidele }, select: { followingCount: true } });
    expect(fideleApres.followingCount).toBe(1);
  });
});
