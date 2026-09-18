/**
 * La file des signalements — contre la vraie base.
 *
 * ─────────────────────────────────────────────────────────────────
 * CE QUE CE FICHIER TIENT
 *
 * C'est le seul chemin par lequel un modérateur de plateforme voit le message
 * d'une communauté fermée. Trois choses doivent rester vraies :
 *
 *   — seuls les messages **signalés** y figurent, jamais le fil autour ;
 *   — lever un signalement et retirer un message se consignent tous les deux ;
 *   — le compteur de réponses suit le retrait.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { droitsSur } from "@/lib/forum/acces";
import {
  ouvrirCommunaute,
  ouvrirSujet,
  repondre,
  signalerMessage,
} from "@/lib/forum/redaction";
import {
  leverLeSignalement,
  messagesSignales,
  retirerParLaPlateforme,
} from "@/lib/forum/signalements";

let n = 0;

async function personne() {
  n += 1;
  return db.user.create({
    data: {
      email: `signal-${n}@baobart.test`,
      profile: { create: { username: `signaleur-${n}`, displayName: `Vigie ${n}` } },
    },
    select: { id: true },
  });
}

/** Une communauté, un sujet, une réponse — le tout par les vrais chemins. */
async function conversation(visibilite: "PUBLIC" | "PRIVATE" = "PUBLIC") {
  const createur = await personne();
  n += 1;

  const ouverture = await ouvrirCommunaute({
    createurId: createur.id,
    saisie: { nom: `Atelier ${n}`, description: "", visibilite },
  });
  if (!ouverture.ok) throw new Error("ouverture ratée");

  const communaute = await db.community.findUniqueOrThrow({
    where: { slug: ouverture.slug },
    select: { id: true, slug: true, categories: { select: { id: true } } },
  });

  const droits = droitsSur(
    { id: communaute.id, visibilite, createurId: createur.id, active: true },
    { id: createur.id, role: "MEMBER", appartenance: "ADMIN" },
  );

  const sujet = await ouvrirSujet({
    communauteId: communaute.id,
    categorieId: communaute.categories[0]!.id,
    auteurId: createur.id,
    droits,
    saisie: { titre: "Quelle encre pour du wax ?", corps: "Le premier message." },
  });
  if (!sujet.ok) throw new Error("sujet raté");

  const reponse = await repondre({
    communauteId: communaute.id,
    sujetId: sujet.sujetId,
    auteurId: createur.id,
    droits,
    saisie: { corps: "Une réponse déplacée." },
  });
  if (!reponse.ok) throw new Error("réponse ratée");

  return {
    createur,
    communaute,
    droits,
    sujetId: sujet.sujetId,
    messageId: reponse.messageId,
  };
}

beforeEach(() => {
  n = 0;
});

describe("la file", () => {
  it("ne contient que ce qui est signalé", async () => {
    // Le fil compte deux messages ; un seul est signalé. Rapporter les deux
    // ferait lire au modérateur une conversation qu'il n'a pas à lire.
    const c = await conversation();

    await signalerMessage({
      communauteId: c.communaute.id,
      messageId: c.messageId,
      parId: c.createur.id,
      droits: c.droits,
    });

    const file = await messagesSignales();

    expect(file).toHaveLength(1);
    expect(file[0]?.id).toBe(c.messageId);
    expect(file[0]?.corps).toBe("Une réponse déplacée.");
  });

  it("rend le message d'une communauté fermée, et dit qu'elle l'est", async () => {
    // C'est la raison d'être de cette file. Sans la mention « fermée »,
    // l'écran proposerait un lien vers un fil qui rendrait « introuvable ».
    const c = await conversation("PRIVATE");

    await signalerMessage({
      communauteId: c.communaute.id,
      messageId: c.messageId,
      parId: c.createur.id,
      droits: c.droits,
    });

    const file = await messagesSignales();

    expect(file).toHaveLength(1);
    expect(file[0]?.communautePrivee).toBe(true);
    expect(file[0]?.sujetTitre).toBe("Quelle encre pour du wax ?");
  });

  it("est vide quand rien n'est signalé", async () => {
    await conversation();
    expect(await messagesSignales()).toEqual([]);
  });

  it("sert le plus ancien en premier", async () => {
    // Une file se vide du plus ancien : trier à l'envers ferait vieillir
    // indéfiniment ceux du bas.
    const c = await conversation();

    const second = await repondre({
      communauteId: c.communaute.id,
      sujetId: c.sujetId,
      auteurId: c.createur.id,
      droits: c.droits,
      saisie: { corps: "Une seconde réponse, venue après." },
    });
    if (!second.ok) throw new Error("réponse ratée");

    for (const id of [second.messageId, c.messageId]) {
      await signalerMessage({
        communauteId: c.communaute.id,
        messageId: id,
        parId: c.createur.id,
        droits: c.droits,
      });
    }

    const file = await messagesSignales();

    // Signalés dans l'ordre inverse, rendus dans l'ordre d'écriture.
    expect(file.map((m) => m.id)).toEqual([c.messageId, second.messageId]);
  });
});

describe("lever un signalement", () => {
  it("laisse le message et consigne la décision", async () => {
    // Un signalement écarté est une décision autant qu'un message retiré.
    // C'est celle qu'on cherchera le jour où quelqu'un demandera pourquoi
    // rien n'a été fait.
    const c = await conversation();
    const modo = await personne();

    await signalerMessage({
      communauteId: c.communaute.id,
      messageId: c.messageId,
      parId: c.createur.id,
      droits: c.droits,
    });

    const suite = await leverLeSignalement({ messageId: c.messageId, parId: modo.id });

    expect(suite.ok).toBe(true);
    expect(await messagesSignales()).toEqual([]);

    const message = await db.forumPost.findUnique({
      where: { id: c.messageId },
      select: { isFlagged: true },
    });
    expect(message?.isFlagged).toBe(false);

    const traces = await db.auditLog.findMany({
      where: { actorId: modo.id },
      select: { action: true },
    });
    expect(traces).toEqual([{ action: "contenu.approuver" }]);
  });

  it("ne lève pas deux fois", async () => {
    const c = await conversation();
    const modo = await personne();

    await signalerMessage({
      communauteId: c.communaute.id,
      messageId: c.messageId,
      parId: c.createur.id,
      droits: c.droits,
    });

    await leverLeSignalement({ messageId: c.messageId, parId: modo.id });
    const second = await leverLeSignalement({ messageId: c.messageId, parId: modo.id });

    expect(second.ok).toBe(false);
    expect(
      await db.auditLog.count({ where: { actorId: modo.id } }),
    ).toBe(1);
  });
});

describe("retirer par la plateforme", () => {
  it("supprime le message, décompte, et consigne", async () => {
    // Supprimé, pas masqué : un message « caché » qui reste en base finit par
    // ressortir d'une requête qu'on n'avait pas prévue.
    const c = await conversation();
    const modo = await personne();

    await signalerMessage({
      communauteId: c.communaute.id,
      messageId: c.messageId,
      parId: c.createur.id,
      droits: c.droits,
    });

    const suite = await retirerParLaPlateforme({
      messageId: c.messageId,
      parId: modo.id,
    });

    expect(suite.ok).toBe(true);
    expect(
      await db.forumPost.findUnique({ where: { id: c.messageId } }),
    ).toBeNull();

    const sujet = await db.forumTopic.findUniqueOrThrow({
      where: { id: c.sujetId },
      select: { repliesCount: true },
    });
    expect(sujet.repliesCount).toBe(0);

    const traces = await db.auditLog.findMany({
      where: { actorId: modo.id },
      select: { action: true, resource: true },
    });
    expect(traces).toHaveLength(1);
    expect(traces[0]?.action).toBe("contenu.retirer");
    expect(traces[0]?.resource).toContain(c.messageId);
  });

  it("refuse un message qui n'existe plus", async () => {
    const modo = await personne();

    const suite = await retirerParLaPlateforme({
      messageId: "cmxxxxxxxxxxxxxxxxxxxxxxx",
      parId: modo.id,
    });

    expect(suite.ok).toBe(false);
    expect(await db.auditLog.count()).toBe(0);
  });

  it("laisse le sujet debout quand c'est son premier message qui part", async () => {
    // Le sujet garde son auteur : c'est lui, et non le rang, qui dit qui l'a
    // ouvert. Sans ça, le deuxième message porterait « a ouvert le sujet ».
    const c = await conversation();

    const premier = await db.forumPost.findFirstOrThrow({
      where: { topicId: c.sujetId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    const modo = await personne();

    await retirerParLaPlateforme({ messageId: premier.id, parId: modo.id });

    const sujet = await db.forumTopic.findUniqueOrThrow({
      where: { id: c.sujetId },
      select: { authorId: true, _count: { select: { posts: true } } },
    });

    expect(sujet.authorId).toBe(c.createur.id);
    expect(sujet._count.posts).toBe(1);
  });
});
