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
import { ecrireDansLeFil, signalerDansLeFil } from "@/lib/forum/fil";
import { contexteDe } from "@/lib/forum/queries";
import {
  ouvrirCommunaute,
  ouvrirSujet,
  repondre,
  signalerMessage,
} from "@/lib/forum/redaction";
import {
  basculerLaCommunaute,
  communautesPourLAdministration,
  indicateurs,
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
async function conversation(etat: "ouverte" | "fermee" = "ouverte") {
  const createur = await personne();
  n += 1;

  const ouverture = await ouvrirCommunaute({
    createurId: createur.id,
    saisie: { nom: `Atelier ${n}`, description: "" },
  });
  if (!ouverture.ok) throw new Error("ouverture ratée");

  // Fermer se fait après coup : on n'ouvre pas une communauté close. C'est
  // aussi l'ordre réel des choses — une communauté se ferme parce qu'il s'y
  // est passé quelque chose, jamais à la création.
  const communaute = await db.community.findUniqueOrThrow({
    where: { slug: ouverture.slug },
    select: { id: true, slug: true, categories: { select: { id: true } } },
  });

  // `active: true` même quand la communauté est close : ce montage écrit ses
  // messages AVANT la fermeture, comme dans la réalité. Les droits servent à
  // poser le contenu, pas à décrire l'état final.
  const droits = droitsSur(
    { id: communaute.id, visibilite: "PUBLIC", createurId: createur.id, active: true },
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

  // Fermer se fait à la fin : on n'écrit pas dans une communauté close. C'est
  // aussi l'ordre réel des choses — une communauté se ferme parce qu'il s'y
  // est passé quelque chose, jamais à la création.
  if (etat === "fermee") {
    await db.community.update({
      where: { id: communaute.id },
      data: { status: "closed" },
    });
  }

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
    // C'est la raison d'être de cette file. Une communauté fermée ne se lit
    // plus par personne — pas même son créateur. Sans la mention « fermée »,
    // l'écran proposerait un lien vers un fil qui rendrait « introuvable »,
    // et le modérateur croirait à une panne.
    const c = await conversation("fermee");

    await signalerMessage({
      communauteId: c.communaute.id,
      messageId: c.messageId,
      parId: c.createur.id,
      droits: c.droits,
    });

    const file = await messagesSignales();

    expect(file).toHaveLength(1);
    expect(file[0]?.communauteFermee).toBe(true);
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

    const suite = await leverLeSignalement({ messageId: c.messageId, origine: "forum", parId: modo.id });

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

    await leverLeSignalement({ messageId: c.messageId, origine: "forum", parId: modo.id });
    const second = await leverLeSignalement({ messageId: c.messageId, origine: "forum", parId: modo.id });

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

    const suite = await retirerParLaPlateforme({ messageId: c.messageId, origine: "forum", parId: modo.id });

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

    const suite = await retirerParLaPlateforme({ messageId: "cmxxxxxxxxxxxxxxxxxxxxxxx", origine: "forum", parId: modo.id });

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

    await retirerParLaPlateforme({ messageId: premier.id, origine: "forum", parId: modo.id  });

    const sujet = await db.forumTopic.findUniqueOrThrow({
      where: { id: c.sujetId },
      select: { authorId: true, _count: { select: { posts: true } } },
    });

    expect(sujet.authorId).toBe(c.createur.id);
    expect(sujet._count.posts).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════ le fil, et l'admin ══

/**
 * Le fil est l'autre moitié de cette file, et la plus fréquentée.
 *
 * Les messages de forum qu'on teste plus haut viennent d'un produit dont les
 * écrans ne sont plus servis. Ceux-là continuent d'arriver.
 */
describe("les messages de fil", () => {
  async function filAvecUnSignalement() {
    const createur = await personne();
    n += 1;

    const ouverture = await ouvrirCommunaute({
      createurId: createur.id,
      saisie: { nom: `Fil ${n}`, description: "" },
    });
    if (!ouverture.ok) throw new Error("ouverture ratée");

    const communaute = await db.community.findUniqueOrThrow({
      where: { slug: ouverture.slug },
      select: { id: true, slug: true, name: true },
    });

    const droits = droitsSur(
      { id: communaute.id, visibilite: "PUBLIC", createurId: createur.id, active: true },
      { id: createur.id, role: "MEMBER", appartenance: "ADMIN" },
    );

    const ecrit = await ecrireDansLeFil({
      communauteId: communaute.id,
      communauteNom: communaute.name,
      communauteSlug: communaute.slug,
      auteurId: createur.id,
      auteurNom: "Quelqu'un",
      droits,
      saisie: { corps: "Un message déplacé." },
    });
    if (!ecrit.ok) throw new Error("écriture ratée");

    await signalerDansLeFil({
      communauteId: communaute.id,
      messageId: ecrit.messageId,
      parId: createur.id,
      droits,
    });

    return { createur, communaute, messageId: ecrit.messageId };
  }

  it("arrivent dans la file, marqués « fil »", async () => {
    const f = await filAvecUnSignalement();

    const file = await messagesSignales();

    expect(file).toHaveLength(1);
    expect(file[0]?.origine).toBe("fil");
    expect(file[0]?.id).toBe(f.messageId);
    // Un message de fil n'a pas de sujet : les deux champs sont nuls, et
    // l'écran n'affiche donc pas de titre vide.
    expect(file[0]?.sujetId).toBeNull();
    expect(file[0]?.sujetTitre).toBeNull();
  });

  it("se lèvent et se retirent par leur propre origine", async () => {
    // L'origine voyage avec l'identifiant : deux tables, et rien ne garantit
    // que leurs identifiants ne se croiseront jamais.
    const f = await filAvecUnSignalement();
    const modo = await personne();

    const retire = await retirerParLaPlateforme({
      messageId: f.messageId,
      origine: "fil",
      parId: modo.id,
    });

    expect(retire.ok).toBe(true);
    expect(await db.communityChatMessage.count()).toBe(0);
    expect(await messagesSignales()).toEqual([]);
  });

  it("ne se retirent pas en se trompant d'origine", async () => {
    const f = await filAvecUnSignalement();
    const modo = await personne();

    const suite = await retirerParLaPlateforme({
      messageId: f.messageId,
      origine: "forum",
      parId: modo.id,
    });

    expect(suite.ok).toBe(false);
    expect(await db.communityChatMessage.count()).toBe(1);
  });
});

describe("fermer une communauté", () => {
  async function uneCommunaute() {
    const createur = await personne();
    n += 1;
    const ouverture = await ouvrirCommunaute({
      createurId: createur.id,
      saisie: { nom: `Espace ${n}`, description: "" },
    });
    if (!ouverture.ok) throw new Error("ouverture ratée");
    return db.community.findUniqueOrThrow({
      where: { slug: ouverture.slug },
      select: { id: true, slug: true },
    });
  }

  it("exige un motif écrit", async () => {
    // « Chaque geste exige un motif écrit avant validation, et laisse une ligne
    // que personne ne peut effacer » — Baobart Dashboard.dc.html,
    // écran `a_membres_risque`.
    const c = await uneCommunaute();
    const modo = await personne();

    const suite = await basculerLaCommunaute({
      communauteId: c.id,
      parId: modo.id,
      motif: "  spam  ",
    });

    expect(suite.ok).toBe(false);
    const apres = await db.community.findUniqueOrThrow({
      where: { id: c.id },
      select: { status: true },
    });
    expect(apres.status).toBe("active");
    expect(await db.auditLog.count()).toBe(0);
  });

  it("ferme, consigne le motif, et rend l'espace illisible", async () => {
    const c = await uneCommunaute();
    const modo = await personne();

    const suite = await basculerLaCommunaute({
      communauteId: c.id,
      parId: modo.id,
      motif: "Republication massive de ressources dont personne n'est l'auteur.",
    });

    expect(suite).toEqual({ ok: true, fermee: true });

    // Illisible pour tout le monde, y compris son créateur.
    expect(await contexteDe(c.slug, null)).toBeNull();

    const trace = await db.auditLog.findFirstOrThrow({
      select: { action: true, resource: true, details: true },
    });
    expect(trace.action).toBe("contenu.retirer");
    expect(trace.resource).toContain("communaute");
    expect(JSON.stringify(trace.details)).toContain("Republication massive");
  });

  it("rouvre ce qu'elle a fermé", async () => {
    // Fermer n'efface rien : c'est ce qui permet de rouvrir quand l'enquête ne
    // donne rien.
    const c = await uneCommunaute();
    const modo = await personne();

    await basculerLaCommunaute({
      communauteId: c.id,
      parId: modo.id,
      motif: "Le temps de l'instruction.",
    });
    const rouverte = await basculerLaCommunaute({
      communauteId: c.id,
      parId: modo.id,
      motif: "L'instruction n'a rien donné.",
    });

    expect(rouverte).toEqual({ ok: true, fermee: false });
    expect(await contexteDe(c.slug, null)).not.toBeNull();
    expect(await db.auditLog.count()).toBe(2);
  });

  it("compte les communautés ouvertes et fermées", async () => {
    const ouverte = await uneCommunaute();
    const fermee = await uneCommunaute();
    const modo = await personne();

    await basculerLaCommunaute({
      communauteId: fermee.id,
      parId: modo.id,
      motif: "Un motif suffisamment long.",
    });

    const chiffres = await indicateurs();

    expect(chiffres.communautesOuvertes).toBe(1);
    expect(chiffres.communautesFermees).toBe(1);
    expect(ouverte.id).not.toBe(fermee.id);
  });

  it("montre tout à l'administration, fermées comprises", async () => {
    // Une communauté que l'écran ne verrait pas serait une communauté qu'on ne
    // peut pas rouvrir.
    const c = await uneCommunaute();
    const modo = await personne();
    await basculerLaCommunaute({
      communauteId: c.id,
      parId: modo.id,
      motif: "Un motif suffisamment long.",
    });

    const liste = await communautesPourLAdministration();

    expect(liste).toHaveLength(1);
    expect(liste[0]?.fermee).toBe(true);
  });
});
