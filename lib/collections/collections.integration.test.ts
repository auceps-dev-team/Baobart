/**
 * Les collections et les espaces d'équipe contre une vraie base : ce qui se
 * range, qui le voit, et ce que l'accueil montre au visiteur.
 */

import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { createursASuivre, espaceDuVisiteur } from "@/lib/collections/espace";
import { collectionAVoir, creer, epingler, epinglesParmi, mesCollections, supprimer } from "@/lib/collections/service";

let n = 0;
async function membre() {
  n += 1;
  const s = `${n}-${Math.random().toString(36).slice(2, 7)}`;
  const nom = `Membre ${s}`;
  const u = await db.user.create({
    data: { email: `col-${s}@baobart.test`, profile: { create: { username: `col-${s}`, displayName: nom } } },
    select: { id: true },
  });
  return { ...u, nom };
}
async function ressource(vendeurId: string, status: "PUBLISHED" | "DRAFT" = "PUBLISHED") {
  n += 1;
  return db.product.create({
    data: { sellerId: vendeurId, name: `Ressource ${n}`, slug: `col-res-${n}-${Math.random().toString(36).slice(2, 7)}`, price: 0, currency: "XOF", status, coverUrl: `/img/${n}.png` },
    select: { id: true, slug: true },
  });
}
async function communaute(createurId: string, membres: string[]) {
  n += 1;
  const c = await db.community.create({
    data: { creatorId: createurId, name: `Espace ${n}`, slug: `espace-${n}-${Math.random().toString(36).slice(2, 7)}`, memberCount: membres.length },
    select: { id: true, slug: true },
  });
  for (const userId of membres) await db.communityMembership.create({ data: { communityId: c.id, userId } });
  return c;
}

describe("épingler", () => {
  it("range une ressource publiée, une fois, et la retire", async () => {
    // Avant le 04/10, l'épingle changeait de couleur sans rien enregistrer.
    const awa = await membre();
    const vendeur = await membre();
    const r = await ressource(vendeur.id);
    const id = await creer(awa.id, { title: "Inspiration wax", description: null, isPublic: false });

    expect(await epingler(awa.id, id, r.id, true)).toEqual({ ok: true, epinglee: true });
    expect(await epingler(awa.id, id, r.id, true)).toEqual({ ok: true, epinglee: true }); // double clic
    expect(await db.save.count({ where: { boardId: id } })).toBe(1);
    expect(await epinglesParmi(awa.id, [r.id])).toEqual([r.id]);
    expect((await mesCollections(awa.id))[0]).toMatchObject({ titre: "Inspiration wax", ressources: 1, apercu: [expect.stringMatching(/\.png$/)] });

    expect(await epingler(awa.id, id, r.id, false)).toEqual({ ok: true, epinglee: false });
    expect(await epinglesParmi(awa.id, [r.id])).toEqual([]);
  });

  it("refuse une ressource non publiée, et la collection d'un autre", async () => {
    const awa = await membre();
    const kofi = await membre();
    const brouillon = await ressource(awa.id, "DRAFT");
    const publiee = await ressource(awa.id);
    const id = await creer(awa.id, { title: "À moi", description: null, isPublic: false });

    expect(await epingler(awa.id, id, brouillon.id, true)).toEqual({ ok: false, motif: "RESSOURCE" });
    expect(await epingler(kofi.id, id, publiee.id, true)).toEqual({ ok: false, motif: "INTERDIT" });
    expect(await supprimer(kofi.id, id)).toBe(false);
  });
});

describe("voir une collection", () => {
  it("suit le propriétaire, la communauté et la visibilité", async () => {
    const awa = await membre();
    const kofi = await membre();
    const yao = await membre();
    const c = await communaute(awa.id, [awa.id, kofi.id]);
    const privee = await creer(awa.id, { title: "Privée", description: null, isPublic: false });
    const publique = await creer(awa.id, { title: "Publique", description: null, isPublic: true });
    await db.board.update({ where: { id: privee }, data: { communityId: c.id } });

    expect((await collectionAVoir(awa.id, privee))?.modifiable).toBe(true);
    expect((await collectionAVoir(kofi.id, privee))?.modifiable).toBe(false); // membre : voit, ne modifie pas
    expect(await collectionAVoir(yao.id, privee)).toBeNull();
    expect(await collectionAVoir(yao.id, publique)).not.toBeNull();
  });
});

describe("l'espace du visiteur, sur l'accueil", () => {
  it("est le plus actif de ses espaces, avec ses vrais messages et ses ressources partagées", async () => {
    const awa = await membre();
    const kofi = await membre();
    const calme = await communaute(awa.id, [awa.id]);
    const actif = await communaute(awa.id, [awa.id, kofi.id]);
    await db.communityChatMessage.create({ data: { communityId: actif.id, authorId: kofi.id, body: "J'ai ajouté deux variantes." } });
    const r = await ressource(kofi.id);
    const id = await creer(awa.id, { title: "Campagne", description: null, isPublic: false });
    await epingler(awa.id, id, r.id, true);
    await db.board.update({ where: { id }, data: { communityId: actif.id } });

    const e = await espaceDuVisiteur(awa.id);
    expect(e).toMatchObject({ slug: actif.slug, membres: 2, collections: 1, ressources: 1 });
    expect(e?.messages).toEqual([{ auteur: kofi.nom, texte: "J'ai ajouté deux variantes.", quand: "à l'instant" }]);
    expect(calme.slug).not.toBe(e?.slug);
  });

  it("n'existe pas pour qui n'est membre d'aucun espace", async () => {
    const seul = await membre();
    expect(await espaceDuVisiteur(seul.id)).toBeNull();
  });
});

describe("les créatifs à suivre", () => {
  it("publient, ne sont ni le visiteur ni déjà suivis, ni suspendus", async () => {
    // Le bloc listait tous les profils : comptes de test et acheteurs compris.
    const visiteur = await membre();
    const suivi = await membre();
    const aSuivre = await membre();
    const acheteur = await membre();
    const suspendu = await membre();
    for (const u of [visiteur, suivi, aSuivre, suspendu]) await ressource(u.id);
    await db.follow.create({ data: { followerId: visiteur.id, followingId: suivi.id } });
    await db.user.update({ where: { id: suspendu.id }, data: { suspendedAt: new Date() } });

    expect((await createursASuivre(visiteur.id, 10)).map((c) => c.id)).toEqual([aSuivre.id]);
    expect((await createursASuivre(null, 10)).map((c) => c.id).sort()).toEqual([visiteur.id, suivi.id, aSuivre.id].sort());
    expect(acheteur).toBeTruthy();
  });
});
