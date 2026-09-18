/**
 * Les collections partagées — contre la vraie base.
 *
 * ─────────────────────────────────────────────────────────────────
 * LA PROPRIÉTÉ QUI COMPTE EST CELLE DU PROPRIÉTAIRE
 *
 * Une collection peut être privée. L'attacher à une communauté la rend lisible
 * par tous ses membres — c'est tout l'intérêt, et c'est aussi ce qui rend le
 * geste dangereux s'il peut être posé par quelqu'un d'autre que son auteur.
 *
 * Le reste (double partage, détachement, communauté supprimée) protège des
 * disparitions silencieuses : une collection qui change d'espace sans que
 * personne ne le voie, ou qui s'efface avec la communauté.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  attacher,
  collectionsDe,
  detacher,
  mesCollectionsDetachees,
} from "@/lib/forum/collections";
import { contexteDe } from "@/lib/forum/queries";
import { ouvrirCommunaute, rejoindre } from "@/lib/forum/redaction";

let n = 0;

async function personne() {
  n += 1;
  return db.user.create({
    data: {
      email: `collec-${n}@baobart.test`,
      profile: { create: { username: `rangeur-${n}`, displayName: `Rangeur ${n}` } },
    },
    select: { id: true },
  });
}

async function contexteDeQui(slug: string, userId: string | null) {
  const ctx = await contexteDe(
    slug,
    userId ? { id: userId, role: "MEMBER" } : null,
  );
  if (!ctx) throw new Error("contexte attendu");
  return ctx;
}

async function espace() {
  const createur = await personne();
  n += 1;

  const suite = await ouvrirCommunaute({
    createurId: createur.id,
    saisie: { nom: `Atelier ${n}`, description: "" },
  });
  if (!suite.ok) throw new Error("ouverture ratée");

  const communaute = await db.community.findUniqueOrThrow({
    where: { slug: suite.slug },
    select: { id: true, slug: true },
  });
  return { createur, ...communaute };
}

async function membreDe(e: { id: string; slug: string }) {
  const arrivant = await personne();
  const ctx = await contexteDeQui(e.slug, arrivant.id);
  const suite = await rejoindre({
    communauteId: e.id,
    userId: arrivant.id,
    droits: ctx.droits,
    visibilite: "PUBLIC",
  });
  if (!suite.ok) throw new Error("adhésion ratée");

  const apres = await contexteDeQui(e.slug, arrivant.id);
  return { id: arrivant.id, droits: apres.droits };
}

async function collection(ownerId: string, options: { publique?: boolean } = {}) {
  n += 1;
  return db.board.create({
    data: {
      ownerId,
      title: `Campagne Dakar ${n}`,
      isPublic: options.publique ?? true,
    },
    select: { id: true, title: true },
  });
}

beforeEach(() => {
  n = 0;
});

describe("partager une collection", () => {
  it("laisse son propriétaire la partager là où il est membre", async () => {
    const e = await espace();
    const membre = await membreDe(e);
    const c = await collection(membre.id);

    const suite = await attacher({
      boardId: c.id,
      communauteId: e.id,
      parId: membre.id,
      droits: membre.droits,
    });

    expect(suite).toEqual({ ok: true });

    const ctx = await contexteDeQui(e.slug, membre.id);
    const partagees = await collectionsDe(ctx);
    expect(partagees).toHaveLength(1);
    expect(partagees[0]?.titre).toBe(c.title);
  });

  it("refuse à qui n'est pas membre", async () => {
    // Sinon un passant meublerait un espace où il n'a jamais mis les pieds.
    const e = await espace();
    const passant = await personne();
    const c = await collection(passant.id);
    const ctx = await contexteDeQui(e.slug, passant.id);

    const suite = await attacher({
      boardId: c.id,
      communauteId: e.id,
      parId: passant.id,
      droits: ctx.droits,
    });

    expect(suite).toEqual({ ok: false, motif: "INTERDIT" });
  });

  it("refuse la collection de quelqu'un d'autre, même à un administrateur", async () => {
    // LE test de ce fichier. Une collection peut être privée ; l'attacher la
    // rend lisible par tous les membres. Laisser un administrateur le faire
    // exposerait le rangement de quelqu'un sans qu'il le sache.
    const e = await espace();
    const membre = await membreDe(e);
    const c = await collection(membre.id, { publique: false });

    const ctxAdmin = await contexteDeQui(e.slug, e.createur.id);
    expect(ctxAdmin.droits.moderer).toBe(true);

    const suite = await attacher({
      boardId: c.id,
      communauteId: e.id,
      parId: e.createur.id,
      droits: ctxAdmin.droits,
    });

    expect(suite).toEqual({ ok: false, motif: "INTERDIT" });
    const restee = await db.board.findUniqueOrThrow({
      where: { id: c.id },
      select: { communityId: true },
    });
    expect(restee.communityId).toBeNull();
  });

  it("refuse une collection déjà partagée ailleurs", async () => {
    // Sinon elle disparaîtrait d'une communauté sans que personne n'y soit
    // prévenu : le partage est un fait visible, son retrait doit l'être aussi.
    const premier = await espace();
    const second = await espace();
    const membre = await membreDe(premier);
    await rejoindre({
      communauteId: second.id,
      userId: membre.id,
      droits: (await contexteDeQui(second.slug, membre.id)).droits,
      visibilite: "PUBLIC",
    });

    const c = await collection(membre.id);
    await attacher({
      boardId: c.id,
      communauteId: premier.id,
      parId: membre.id,
      droits: membre.droits,
    });

    const ailleurs = await contexteDeQui(second.slug, membre.id);
    const suite = await attacher({
      boardId: c.id,
      communauteId: second.id,
      parId: membre.id,
      droits: ailleurs.droits,
    });

    expect(suite).toEqual({ ok: false, motif: "AILLEURS" });
  });

  it("dit « déjà attachée » quand c'est ici", async () => {
    // Message distinct d'« ailleurs » : la personne a sous les yeux sa
    // collection dans cet espace, lui répondre « elle est ailleurs » ne
    // l'aiderait pas.
    const e = await espace();
    const membre = await membreDe(e);
    const c = await collection(membre.id);
    const avis = {
      boardId: c.id,
      communauteId: e.id,
      parId: membre.id,
      droits: membre.droits,
    };

    await attacher(avis);
    expect(await attacher(avis)).toEqual({ ok: false, motif: "DEJA_ATTACHEE" });
  });

  it("ne change pas `isPublic`", async () => {
    // `isPublic` répond à « le monde entier peut-il la voir ? ».
    // `communityId` répond à « ces membres-là peuvent-ils la voir ? ».
    // Les fusionner ferait qu'un partage entre douze personnes ouvrirait la
    // collection à tout Internet.
    const e = await espace();
    const membre = await membreDe(e);
    const c = await collection(membre.id, { publique: false });

    await attacher({
      boardId: c.id,
      communauteId: e.id,
      parId: membre.id,
      droits: membre.droits,
    });

    const apres = await db.board.findUniqueOrThrow({
      where: { id: c.id },
      select: { isPublic: true },
    });
    expect(apres.isPublic).toBe(false);
  });
});

describe("lire les collections d'un espace", () => {
  it("rend une collection privée à ses membres", async () => {
    // C'est tout l'intérêt du partage : le droit de lire vient de la
    // communauté, pas de `isPublic`.
    const e = await espace();
    const membre = await membreDe(e);
    const c = await collection(membre.id, { publique: false });
    await attacher({
      boardId: c.id,
      communauteId: e.id,
      parId: membre.id,
      droits: membre.droits,
    });

    const autre = await membreDe(e);
    const ctx = await contexteDeQui(e.slug, autre.id);

    const vues = await collectionsDe(ctx);
    expect(vues).toHaveLength(1);
    expect(vues[0]?.privee).toBe(true);
  });

  it("ne rend rien quand on n'a pas le droit de lire", async () => {
    const e = await espace();
    const membre = await membreDe(e);
    const c = await collection(membre.id);
    await attacher({
      boardId: c.id,
      communauteId: e.id,
      parId: membre.id,
      droits: membre.droits,
    });

    const ctx = await contexteDeQui(e.slug, null);
    const sansLecture = { ...ctx, droits: { ...ctx.droits, lire: false } };

    expect(await collectionsDe(sansLecture)).toEqual([]);
  });

  it("ne propose au partage que ses propres collections libres", async () => {
    const e = await espace();
    const membre = await membreDe(e);
    const sienneLibre = await collection(membre.id);
    const sienneAttachee = await collection(membre.id);
    const duVoisin = await collection((await personne()).id);

    await attacher({
      boardId: sienneAttachee.id,
      communauteId: e.id,
      parId: membre.id,
      droits: membre.droits,
    });

    const proposables = await mesCollectionsDetachees(membre.id);

    expect(proposables.map((c) => c.id)).toEqual([sienneLibre.id]);
    expect(proposables.map((c) => c.id)).not.toContain(duVoisin.id);
  });
});

describe("retirer une collection", () => {
  async function partagee() {
    const e = await espace();
    const membre = await membreDe(e);
    const c = await collection(membre.id);
    await attacher({
      boardId: c.id,
      communauteId: e.id,
      parId: membre.id,
      droits: membre.droits,
    });
    return { e, membre, boardId: c.id };
  }

  it("laisse son propriétaire la reprendre", async () => {
    const p = await partagee();

    const suite = await detacher({
      boardId: p.boardId,
      communauteId: p.e.id,
      parId: p.membre.id,
      droits: p.membre.droits,
    });

    expect(suite).toEqual({ ok: true });
    const apres = await db.board.findUniqueOrThrow({
      where: { id: p.boardId },
      select: { communityId: true },
    });
    expect(apres.communityId).toBeNull();
  });

  it("laisse un modérateur la retirer de chez lui", async () => {
    // Détacher est de la modération, et ne détruit rien : la collection
    // redevient personnelle, exactement ce qu'elle était avant.
    const p = await partagee();
    const ctxAdmin = await contexteDeQui(p.e.slug, p.e.createur.id);

    const suite = await detacher({
      boardId: p.boardId,
      communauteId: p.e.id,
      parId: p.e.createur.id,
      droits: ctxAdmin.droits,
    });

    expect(suite).toEqual({ ok: true });
    // Rien au journal : le geste est réversible d'un clic.
    expect(await db.auditLog.count()).toBe(0);
  });

  it("refuse à un simple membre celle d'un autre", async () => {
    const p = await partagee();
    const autre = await membreDe(p.e);

    const suite = await detacher({
      boardId: p.boardId,
      communauteId: p.e.id,
      parId: autre.id,
      droits: autre.droits,
    });

    expect(suite).toEqual({ ok: false, motif: "INTERDIT" });
  });

  it("refuse la collection d'une autre communauté", async () => {
    const p = await partagee();
    const ailleurs = await espace();
    const ctx = await contexteDeQui(ailleurs.slug, ailleurs.createur.id);

    const suite = await detacher({
      boardId: p.boardId,
      communauteId: ailleurs.id,
      parId: ailleurs.createur.id,
      droits: ctx.droits,
    });

    expect(suite).toEqual({ ok: false, motif: "INTROUVABLE" });
  });
});

describe("quand la communauté disparaît", () => {
  it("rend la collection à son propriétaire au lieu de l'emporter", async () => {
    // `onDelete: SetNull`, et non `Cascade`. Supprimer une communauté ne doit
    // pas détruire le travail de rangement de quelqu'un : la collection
    // redevient personnelle.
    const e = await espace();
    const membre = await membreDe(e);
    const c = await collection(membre.id);
    await attacher({
      boardId: c.id,
      communauteId: e.id,
      parId: membre.id,
      droits: membre.droits,
    });

    await db.community.delete({ where: { id: e.id } });

    const survivante = await db.board.findUnique({
      where: { id: c.id },
      select: { communityId: true, ownerId: true },
    });

    expect(survivante).not.toBeNull();
    expect(survivante?.communityId).toBeNull();
    expect(survivante?.ownerId).toBe(membre.id);
  });
});
