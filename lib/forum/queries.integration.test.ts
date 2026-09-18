/**
 * Les lectures du forum — contre la vraie base.
 *
 * ─────────────────────────────────────────────────────────────────
 * CE FICHIER NE TESTE PAS LA RÈGLE, IL TESTE QUE LA REQUÊTE L'APPLIQUE
 *
 * `acces.test.ts` éprouve la règle : qui a le droit de quoi. Ce fichier
 * éprouve autre chose, et c'est là que les fuites se logent — une règle juste
 * appliquée par une requête qui l'oublie ne protège rien.
 *
 * Les deux niveaux sont nécessaires. Un module pur parfait avec un `where`
 * incomplet rend exactement le même service qu'aucune règle du tout.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  categoriesDe,
  contexteDe,
  listerCommunautes,
  sujetAvecMessages,
  sujetsDe,
} from "@/lib/forum/queries";

let n = 0;

async function personne(role: "MEMBER" | "MODERATOR" = "MEMBER") {
  n += 1;
  return db.user.create({
    data: {
      email: `forum-${n}@baobart.test`,
      platformRole: role,
      profile: {
        create: { username: `forumeur-${n}`, displayName: `Forumeur ${n}` },
      },
    },
    select: { id: true, platformRole: true },
  });
}

/** Une communauté avec une rubrique, un sujet et un message. */
async function espace(
  visibilite: "PUBLIC" | "PRIVATE" | "INVITE_ONLY",
  options: { active?: boolean } = {},
) {
  const createur = await personne();
  n += 1;

  const communaute = await db.community.create({
    data: {
      creatorId: createur.id,
      name: `Espace ${n}`,
      slug: `espace-${n}`,
      description: "Un endroit pour parler de sérigraphie.",
      visibility: visibilite,
      status: options.active === false ? "closed" : "active",
    },
    select: { id: true, slug: true },
  });

  const categorie = await db.forumCategory.create({
    data: { communityId: communaute.id, name: "Général", slug: "general" },
    select: { id: true },
  });

  const sujet = await db.forumTopic.create({
    data: {
      categoryId: categorie.id,
      authorId: createur.id,
      title: "Quelle encre pour du wax ?",
    },
    select: { id: true },
  });

  await db.forumPost.create({
    data: {
      topicId: sujet.id,
      authorId: createur.id,
      body: "J'utilise de la plastisol, mais je cherche mieux.",
    },
  });

  return { communaute, categorie, sujet, createur };
}

async function adherer(communauteId: string, userId: string, role: "MEMBER" | "MODERATOR" | "ADMIN" = "MEMBER") {
  await db.communityMembership.create({
    data: { communityId: communauteId, userId, role },
  });
}

/** Ce que `contexteDe` attend : un identifiant et un rôle de plateforme. */
function visiteurDe(u: { id: string; platformRole: string }) {
  return { id: u.id, role: u.platformRole as "MEMBER" | "MODERATOR" };
}

beforeEach(() => {
  n = 0;
});

describe("l'annuaire", () => {
  it("montre les publiques et les privées à un inconnu", async () => {
    await espace("PUBLIC");
    await espace("PRIVATE");

    const liste = await listerCommunautes(null);

    expect(liste).toHaveLength(2);
    expect(liste.map((c) => c.visibilite).sort()).toEqual(["PRIVATE", "PUBLIC"]);
  });

  it("cache les espaces sur invitation à qui n'en est pas", async () => {
    // Leur existence même est une information.
    await espace("INVITE_ONLY");
    const passant = await personne();

    expect(await listerCommunautes(null)).toHaveLength(0);
    expect(await listerCommunautes(passant.id)).toHaveLength(0);
  });

  it("les montre à leurs membres", async () => {
    const e = await espace("INVITE_ONLY");
    const membre = await personne();
    await adherer(e.communaute.id, membre.id);

    const liste = await listerCommunautes(membre.id);

    expect(liste).toHaveLength(1);
    expect(liste[0]?.chezMoi).toBe(true);
  });

  it("les montre à leur créateur, sans ligne d'appartenance", async () => {
    const e = await espace("INVITE_ONLY");

    const liste = await listerCommunautes(e.createur.id);

    expect(liste).toHaveLength(1);
    expect(liste[0]?.chezMoi).toBe(true);
  });

  it("n'affiche jamais une communauté close", async () => {
    const e = await espace("PUBLIC", { active: false });
    const membre = await personne();
    await adherer(e.communaute.id, membre.id, "ADMIN");

    expect(await listerCommunautes(null)).toHaveLength(0);
    expect(await listerCommunautes(membre.id)).toHaveLength(0);
    expect(await listerCommunautes(e.createur.id)).toHaveLength(0);
  });
});

describe("le contexte d'une communauté", () => {
  it("rend `null` pour un espace sur invitation qu'on ne connaît pas", async () => {
    // « Introuvable » et « pas pour vous » se confondent volontairement :
    // distinguer les deux apprendrait l'existence de l'espace.
    const e = await espace("INVITE_ONLY");
    const passant = await personne();

    expect(await contexteDe(e.communaute.slug, null)).toBeNull();
    expect(
      await contexteDe(e.communaute.slug, visiteurDe(passant)),
    ).toBeNull();
  });

  it("laisse voir une privée sans la laisser lire", async () => {
    const e = await espace("PRIVATE");
    const passant = await personne();

    const ctx = await contexteDe(e.communaute.slug, visiteurDe(passant));

    expect(ctx).not.toBeNull();
    expect(ctx?.droits.voir).toBe(true);
    expect(ctx?.droits.lire).toBe(false);
    expect(ctx?.droits.demanderAAdherer).toBe(true);
  });

  it("rend le rôle du membre dans l'espace", async () => {
    const e = await espace("PRIVATE");
    const modo = await personne();
    await adherer(e.communaute.id, modo.id, "MODERATOR");

    const ctx = await contexteDe(e.communaute.slug, visiteurDe(modo));

    expect(ctx?.communaute.monRole).toBe("MODERATOR");
    expect(ctx?.droits.moderer).toBe(true);
    expect(ctx?.droits.administrer).toBe(false);
  });
});

describe("le contenu d'une privée", () => {
  it("ne sort pas pour qui n'est pas membre", async () => {
    // LE test de ce fichier. La règle dit non ; il faut que la requête aussi.
    const e = await espace("PRIVATE");
    const passant = await personne();

    const ctx = await contexteDe(e.communaute.slug, visiteurDe(passant));
    if (!ctx) throw new Error("contexte attendu");

    expect(await categoriesDe(ctx)).toEqual([]);
    expect(await sujetsDe(ctx, e.categorie.id)).toEqual([]);
    expect(await sujetAvecMessages(ctx, e.sujet.id)).toBeNull();
  });

  it("sort pour un membre", async () => {
    const e = await espace("PRIVATE");
    const membre = await personne();
    await adherer(e.communaute.id, membre.id);

    const ctx = await contexteDe(e.communaute.slug, visiteurDe(membre));
    if (!ctx) throw new Error("contexte attendu");

    expect(await categoriesDe(ctx)).toHaveLength(1);

    const sujets = await sujetsDe(ctx, e.categorie.id);
    expect(sujets).toHaveLength(1);
    expect(sujets[0]?.titre).toBe("Quelle encre pour du wax ?");

    const lu = await sujetAvecMessages(ctx, e.sujet.id);
    expect(lu?.messages).toHaveLength(1);
    expect(lu?.messages[0]?.corps).toContain("plastisol");
  });

  it("ne sort pas davantage pour un modérateur de la plateforme", async () => {
    // Il ne se promène pas. Son chemin passera par le signalement, qui porte
    // son propre droit d'accès.
    const e = await espace("PRIVATE");
    const modo = await personne("MODERATOR");

    const ctx = await contexteDe(e.communaute.slug, visiteurDe(modo));
    if (!ctx) throw new Error("contexte attendu");

    expect(ctx.droits.lire).toBe(false);
    expect(await sujetAvecMessages(ctx, e.sujet.id)).toBeNull();
  });
});

describe("le cloisonnement entre communautés", () => {
  it("refuse la rubrique d'un autre espace", async () => {
    // L'identifiant vient de l'URL : sans le rattachement dans le `WHERE`,
    // celui d'une rubrique voisine rendrait ses sujets à qui le devine.
    const chezMoi = await espace("PUBLIC");
    const ailleurs = await espace("PRIVATE");

    const ctx = await contexteDe(chezMoi.communaute.slug, null);
    if (!ctx) throw new Error("contexte attendu");

    expect(await sujetsDe(ctx, ailleurs.categorie.id)).toEqual([]);
  });

  it("refuse le sujet d'un autre espace", async () => {
    const chezMoi = await espace("PUBLIC");
    const ailleurs = await espace("PRIVATE");

    const ctx = await contexteDe(chezMoi.communaute.slug, null);
    if (!ctx) throw new Error("contexte attendu");

    expect(await sujetAvecMessages(ctx, ailleurs.sujet.id)).toBeNull();
  });
});

describe("une communauté close", () => {
  it("ne rend rien, pas même à son créateur", async () => {
    const e = await espace("PUBLIC", { active: false });

    expect(
      await contexteDe(e.communaute.slug, visiteurDe(e.createur)),
    ).toBeNull();
  });
});

describe("l'ordre des sujets", () => {
  it("met les épinglés en tête, puis les plus récents", async () => {
    const e = await espace("PUBLIC");

    const ancien = await db.forumTopic.create({
      data: {
        categoryId: e.categorie.id,
        authorId: e.createur.id,
        title: "Un vieux sujet",
        createdAt: new Date("2026-01-01"),
      },
      select: { id: true },
    });
    const epingle = await db.forumTopic.create({
      data: {
        categoryId: e.categorie.id,
        authorId: e.createur.id,
        title: "À lire d'abord",
        isPinned: true,
        createdAt: new Date("2025-06-01"),
      },
      select: { id: true },
    });

    const ctx = await contexteDe(e.communaute.slug, null);
    if (!ctx) throw new Error("contexte attendu");

    const sujets = await sujetsDe(ctx, e.categorie.id);

    // L'épinglé passe devant, malgré sa date la plus ancienne des trois.
    expect(sujets[0]?.id).toBe(epingle.id);
    // Puis le plus récent des non épinglés — celui créé par le montage.
    expect(sujets[1]?.id).toBe(e.sujet.id);
    expect(sujets[2]?.id).toBe(ancien.id);
  });
});

describe("les messages", () => {
  it("se lisent du plus ancien au plus récent", async () => {
    // C'est l'ordre d'une conversation : lire à l'envers demande de remonter
    // pour comprendre chaque réponse.
    const e = await espace("PUBLIC");

    await db.forumPost.create({
      data: {
        topicId: e.sujet.id,
        authorId: e.createur.id,
        body: "Une réponse, venue après.",
      },
    });

    const ctx = await contexteDe(e.communaute.slug, null);
    if (!ctx) throw new Error("contexte attendu");

    const lu = await sujetAvecMessages(ctx, e.sujet.id);

    expect(lu?.messages.map((m) => m.corps.slice(0, 12))).toEqual([
      "J'utilise de",
      "Une réponse,",
    ]);
  });

  it("gardent un message signalé visible et marqué", async () => {
    // Le masquer ferait disparaître le contexte d'une conversation dont les
    // réponses citent souvent ce qu'on a signalé.
    const e = await espace("PUBLIC");
    await db.forumPost.updateMany({
      where: { topicId: e.sujet.id },
      data: { isFlagged: true },
    });

    const ctx = await contexteDe(e.communaute.slug, null);
    if (!ctx) throw new Error("contexte attendu");

    const lu = await sujetAvecMessages(ctx, e.sujet.id);

    expect(lu?.messages).toHaveLength(1);
    expect(lu?.messages[0]?.signale).toBe(true);
  });
});
