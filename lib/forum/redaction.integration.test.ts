/**
 * Écrire dans le forum — contre la vraie base.
 *
 * ─────────────────────────────────────────────────────────────────
 * QUATRE FAMILLES DE PROPRIÉTÉS
 *
 *   — les gardes : une écriture sans droit ne passe pas, et un identifiant
 *     emprunté à un autre espace non plus ;
 *   — les compteurs dénormalisés restent justes, y compris sur les chemins
 *     d'échec — c'est là qu'ils dérivent ;
 *   — verrouiller ferme la conversation à TOUT LE MONDE, modérateur compris ;
 *   — signaler ne masque rien.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { droitsSur, type Droits } from "@/lib/forum/acces";
import { contexteDe } from "@/lib/forum/queries";
import {
  basculerEpingle,
  basculerVerrou,
  ouvrirCommunaute,
  ouvrirSujet,
  quitter,
  rejoindre,
  repondre,
  retirerMessage,
  signalerMessage,
} from "@/lib/forum/redaction";

let n = 0;

async function personne() {
  n += 1;
  return db.user.create({
    data: {
      email: `ecrit-${n}@baobart.test`,
      profile: { create: { username: `ecrivain-${n}`, displayName: `Plume ${n}` } },
    },
    select: { id: true },
  });
}

/** Les droits d'une personne dans une communauté, calculés pour de vrai. */
async function droitsDe(slug: string, userId: string | null): Promise<Droits> {
  const ctx = await contexteDe(
    slug,
    userId ? { id: userId, role: "MEMBER" } : null,
  );
  if (!ctx) throw new Error("contexte attendu");
  return ctx.droits;
}

/** Une communauté ouverte pour de vrai, avec sa rubrique par défaut. */
async function espace(visibilite: "PUBLIC" | "PRIVATE" = "PUBLIC") {
  const createur = await personne();
  n += 1;

  const suite = await ouvrirCommunaute({
    createurId: createur.id,
    saisie: {
      nom: `Atelier sérigraphie ${n}`,
      description: "On y parle encres et écrans.",
      visibilite,
    },
  });
  if (!suite.ok) throw new Error("ouverture ratée");

  const communaute = await db.community.findUniqueOrThrow({
    where: { slug: suite.slug },
    select: { id: true, slug: true, categories: { select: { id: true } } },
  });

  return {
    createur,
    id: communaute.id,
    slug: communaute.slug,
    categorieId: communaute.categories[0]!.id,
  };
}

beforeEach(() => {
  n = 0;
});

describe("ouvrir une communauté", () => {
  it("fait de son créateur un membre ADMIN, et compte un", async () => {
    // Sans la ligne d'appartenance, il administrerait par `creatorId` — ce que
    // `droitsSur` prévoit — mais `memberCount` afficherait zéro sur un espace
    // qui en a un.
    const e = await espace();

    const c = await db.community.findUniqueOrThrow({
      where: { id: e.id },
      select: { memberCount: true, members: { select: { role: true, userId: true } } },
    });

    expect(c.memberCount).toBe(1);
    expect(c.members).toHaveLength(1);
    expect(c.members[0]).toEqual({ role: "ADMIN", userId: e.createur.id });
  });

  it("crée une rubrique par défaut", async () => {
    // Un forum sans rubrique n'accepte aucun sujet : son créateur se
    // retrouverait devant un espace où il ne peut rien faire.
    const e = await espace();

    const rubriques = await db.forumCategory.findMany({
      where: { communityId: e.id },
      select: { slug: true },
    });

    expect(rubriques).toEqual([{ slug: "general" }]);
  });

  it("ferme par défaut une visibilité qu'elle ne reconnaît pas", async () => {
    // La règle à ne pas inverser : un formulaire trafiqué, un champ renommé,
    // une valeur ajoutée à l'enum sans mettre la validation à jour — dans les
    // trois cas, l'erreur doit FERMER.
    const createur = await personne();

    const suite = await ouvrirCommunaute({
      createurId: createur.id,
      saisie: { nom: "Espace tordu", description: "", visibilite: "TOUT_LE_MONDE" },
    });
    if (!suite.ok) throw new Error("ouverture ratée");

    const c = await db.community.findUniqueOrThrow({
      where: { slug: suite.slug },
      select: { visibility: true },
    });
    expect(c.visibility).toBe("INVITE_ONLY");
  });

  it("cède l'adresse « nouvelle » à la route de création", async () => {
    // `app/communautes/nouvelle/` est un segment statique : Next.js le résout
    // avant `[slug]`. Sans cette réserve, la communauté se créerait sans
    // erreur et son adresse afficherait le formulaire de création — un succès
    // silencieux, celui qui ne se corrige jamais parce que personne ne le voit.
    const createur = await personne();

    const suite = await ouvrirCommunaute({
      createurId: createur.id,
      saisie: { nom: "Nouvelle", description: "", visibilite: "PUBLIC" },
    });

    if (!suite.ok) throw new Error("ouverture ratée");
    expect(suite.slug).toBe("nouvelle-2");
  });

  it("donne deux adresses distinctes à deux noms identiques", async () => {
    const a = await personne();
    const b = await personne();
    const saisie = { nom: "Sérigraphie", description: "", visibilite: "PUBLIC" };

    const un = await ouvrirCommunaute({ createurId: a.id, saisie });
    const deux = await ouvrirCommunaute({ createurId: b.id, saisie });

    if (!un.ok || !deux.ok) throw new Error("ouverture ratée");
    expect(un.slug).toBe("serigraphie");
    expect(deux.slug).toBe("serigraphie-2");
  });
});

describe("rejoindre et quitter", () => {
  it("fait entrer dans une publique, et compte", async () => {
    const e = await espace("PUBLIC");
    const arrivant = await personne();

    const suite = await rejoindre({
      communauteId: e.id,
      userId: arrivant.id,
      droits: await droitsDe(e.slug, arrivant.id),
      visibilite: "PUBLIC",
    });

    expect(suite.ok).toBe(true);
    const c = await db.community.findUniqueOrThrow({
      where: { id: e.id },
      select: { memberCount: true },
    });
    expect(c.memberCount).toBe(2);
  });

  it("refuse une privée, plutôt que d'y faire entrer sans validation", async () => {
    // Accorder automatiquement transformerait « privée » en « publique avec
    // une étape de plus », et viderait le réglage de son sens sans que
    // personne ne s'en aperçoive. Un manque visible vaut mieux.
    const e = await espace("PRIVATE");
    const arrivant = await personne();

    const suite = await rejoindre({
      communauteId: e.id,
      userId: arrivant.id,
      droits: await droitsDe(e.slug, arrivant.id),
      visibilite: "PRIVATE",
    });

    expect(suite).toEqual({ ok: false, motif: "INTERDIT" });
    expect(await db.communityMembership.count({ where: { communityId: e.id } })).toBe(1);
  });

  it("ne compte pas deux fois quand on entre deux fois", async () => {
    // Le compteur est dénormalisé : c'est sur les chemins d'échec qu'il dérive.
    const e = await espace("PUBLIC");
    const arrivant = await personne();
    const droits = await droitsDe(e.slug, arrivant.id);

    await rejoindre({ communauteId: e.id, userId: arrivant.id, droits, visibilite: "PUBLIC" });
    const second = await rejoindre({
      communauteId: e.id,
      userId: arrivant.id,
      droits,
      visibilite: "PUBLIC",
    });

    expect(second).toEqual({ ok: false, motif: "DEJA_MEMBRE" });
    const c = await db.community.findUniqueOrThrow({
      where: { id: e.id },
      select: { memberCount: true },
    });
    expect(c.memberCount).toBe(2);
  });

  it("laisse partir un membre et décompte", async () => {
    const e = await espace("PUBLIC");
    const arrivant = await personne();
    await rejoindre({
      communauteId: e.id,
      userId: arrivant.id,
      droits: await droitsDe(e.slug, arrivant.id),
      visibilite: "PUBLIC",
    });

    const suite = await quitter({
      communauteId: e.id,
      userId: arrivant.id,
      createurId: e.createur.id,
    });

    expect(suite.ok).toBe(true);
    const c = await db.community.findUniqueOrThrow({
      where: { id: e.id },
      select: { memberCount: true },
    });
    expect(c.memberCount).toBe(1);
  });

  it("empêche le créateur de partir de chez lui", async () => {
    // Il resterait administrateur par `creatorId` tout en étant absent de ses
    // propres membres. Fermer l'espace est le geste qui correspond.
    const e = await espace();

    const suite = await quitter({
      communauteId: e.id,
      userId: e.createur.id,
      createurId: e.createur.id,
    });

    expect(suite).toEqual({ ok: false, motif: "INTERDIT" });
  });
});

describe("ouvrir un sujet", () => {
  it("refuse à qui n'est pas membre, même sur une publique", async () => {
    // Écrire demande toujours d'être membre : c'est ce qui distingue une
    // communauté d'un fil de commentaires.
    const e = await espace("PUBLIC");
    const passant = await personne();

    const suite = await ouvrirSujet({
      communauteId: e.id,
      categorieId: e.categorieId,
      auteurId: passant.id,
      droits: await droitsDe(e.slug, passant.id),
      saisie: { titre: "Bonjour tout le monde", corps: "Content d'être là." },
    });

    expect(suite).toEqual({ ok: false, motif: "INTERDIT" });
  });

  it("refuse la rubrique d'un autre espace", async () => {
    // L'identifiant vient du formulaire : sans ce contrôle, on ouvrirait un
    // sujet chez le voisin.
    const chezMoi = await espace();
    const ailleurs = await espace();

    const suite = await ouvrirSujet({
      communauteId: chezMoi.id,
      categorieId: ailleurs.categorieId,
      auteurId: chezMoi.createur.id,
      droits: await droitsDe(chezMoi.slug, chezMoi.createur.id),
      saisie: { titre: "Un sujet égaré", corps: "Il ne devrait pas exister." },
    });

    expect(suite).toEqual({ ok: false, motif: "INTROUVABLE" });
  });

  it("laisse `repliesCount` à zéro", async () => {
    // Le premier message n'est pas une réponse, c'est le sujet lui-même. Le
    // compter ferait afficher « 1 réponse » sur un sujet sans réponse.
    const e = await espace();

    const suite = await ouvrirSujet({
      communauteId: e.id,
      categorieId: e.categorieId,
      auteurId: e.createur.id,
      droits: await droitsDe(e.slug, e.createur.id),
      saisie: { titre: "Quelle encre ?", corps: "Je cherche mieux que la plastisol." },
    });
    if (!suite.ok) throw new Error("ouverture ratée");

    const t = await db.forumTopic.findUniqueOrThrow({
      where: { id: suite.sujetId },
      select: { repliesCount: true, _count: { select: { posts: true } } },
    });

    expect(t.repliesCount).toBe(0);
    expect(t._count.posts).toBe(1);
  });
});

describe("répondre", () => {
  async function sujetOuvert() {
    const e = await espace();
    const droits = await droitsDe(e.slug, e.createur.id);
    const suite = await ouvrirSujet({
      communauteId: e.id,
      categorieId: e.categorieId,
      auteurId: e.createur.id,
      droits,
      saisie: { titre: "Quelle encre ?", corps: "Je cherche mieux." },
    });
    if (!suite.ok) throw new Error("ouverture ratée");
    return { ...e, sujetId: suite.sujetId, droits };
  }

  it("incrémente le compteur de réponses", async () => {
    const s = await sujetOuvert();

    await repondre({
      communauteId: s.id,
      sujetId: s.sujetId,
      auteurId: s.createur.id,
      droits: s.droits,
      saisie: { corps: "La sérigraphie à l'eau marche bien." },
    });

    const t = await db.forumTopic.findUniqueOrThrow({
      where: { id: s.sujetId },
      select: { repliesCount: true },
    });
    expect(t.repliesCount).toBe(1);
  });

  it("accepte un message de deux caractères", async () => {
    // « Merci ! » est un vrai message, et c'est même le plus fréquent dans une
    // conversation qui fonctionne. Un seuil qui le refuse apprend aux gens à
    // écrire trois phrases creuses, ou à se taire.
    const s = await sujetOuvert();

    const suite = await repondre({
      communauteId: s.id,
      sujetId: s.sujetId,
      auteurId: s.createur.id,
      droits: s.droits,
      saisie: { corps: "Ok" },
    });

    expect(suite.ok).toBe(true);
  });

  it("refuse un sujet verrouillé, même à un modérateur", async () => {
    // Verrouiller veut dire « la conversation est close ». Se réserver le
    // dernier mot transformerait le geste en avantage.
    const s = await sujetOuvert();

    await basculerVerrou({
      communauteId: s.id,
      sujetId: s.sujetId,
      droits: s.droits,
    });

    const suite = await repondre({
      communauteId: s.id,
      sujetId: s.sujetId,
      // Le créateur EST administrateur de son espace : il modère.
      auteurId: s.createur.id,
      droits: s.droits,
      saisie: { corps: "Le dernier mot." },
    });

    expect(suite).toEqual({ ok: false, motif: "VERROUILLE" });
  });

  it("refuse le sujet d'un autre espace", async () => {
    const s = await sujetOuvert();
    const ailleurs = await espace();

    const suite = await repondre({
      communauteId: ailleurs.id,
      sujetId: s.sujetId,
      auteurId: ailleurs.createur.id,
      droits: await droitsDe(ailleurs.slug, ailleurs.createur.id),
      saisie: { corps: "Je réponds chez le voisin." },
    });

    expect(suite).toEqual({ ok: false, motif: "INTROUVABLE" });
  });
});

describe("retirer un message", () => {
  async function conversation() {
    const e = await espace();
    const droitsAdmin = await droitsDe(e.slug, e.createur.id);

    const sujet = await ouvrirSujet({
      communauteId: e.id,
      categorieId: e.categorieId,
      auteurId: e.createur.id,
      droits: droitsAdmin,
      saisie: { titre: "Quelle encre ?", corps: "Je cherche mieux." },
    });
    if (!sujet.ok) throw new Error("ouverture ratée");

    const membre = await personne();
    await rejoindre({
      communauteId: e.id,
      userId: membre.id,
      droits: await droitsDe(e.slug, membre.id),
      visibilite: "PUBLIC",
    });
    const droitsMembre = await droitsDe(e.slug, membre.id);

    const reponse = await repondre({
      communauteId: e.id,
      sujetId: sujet.sujetId,
      auteurId: membre.id,
      droits: droitsMembre,
      saisie: { corps: "Essaie la sérigraphie à l'eau." },
    });
    if (!reponse.ok) throw new Error("réponse ratée");

    return { ...e, sujetId: sujet.sujetId, membre, droitsAdmin, droitsMembre, messageId: reponse.messageId };
  }

  it("laisse chacun retirer le sien", async () => {
    const c = await conversation();

    const suite = await retirerMessage({
      communauteId: c.id,
      messageId: c.messageId,
      parId: c.membre.id,
      droits: c.droitsMembre,
    });

    expect(suite.ok).toBe(true);
    const t = await db.forumTopic.findUniqueOrThrow({
      where: { id: c.sujetId },
      select: { repliesCount: true },
    });
    expect(t.repliesCount).toBe(0);
  });

  it("refuse celui d'un autre à un simple membre", async () => {
    const c = await conversation();
    const autre = await personne();
    await rejoindre({
      communauteId: c.id,
      userId: autre.id,
      droits: await droitsDe(c.slug, autre.id),
      visibilite: "PUBLIC",
    });

    const suite = await retirerMessage({
      communauteId: c.id,
      messageId: c.messageId,
      parId: autre.id,
      droits: await droitsDe(c.slug, autre.id),
    });

    expect(suite).toEqual({ ok: false, motif: "INTERDIT" });
  });

  it("laisse un modérateur retirer celui d'un autre, et le consigne", async () => {
    const c = await conversation();

    const suite = await retirerMessage({
      communauteId: c.id,
      messageId: c.messageId,
      parId: c.createur.id,
      droits: c.droitsAdmin,
    });

    expect(suite.ok).toBe(true);
    // Consigné seulement quand on retire le message d'un AUTRE : effacer le
    // sien n'engage personne, et noyer l'audit ferait perdre ce qui compte.
    const traces = await db.auditLog.findMany({ select: { action: true } });
    expect(traces).toHaveLength(1);
    expect(traces[0]?.action).toBe("contenu.retirer");
  });

  it("ne consigne rien quand on retire le sien", async () => {
    const c = await conversation();

    await retirerMessage({
      communauteId: c.id,
      messageId: c.messageId,
      parId: c.membre.id,
      droits: c.droitsMembre,
    });

    expect(await db.auditLog.count()).toBe(0);
  });
});

describe("épingler et verrouiller", () => {
  it("sont refusés à un simple membre", async () => {
    const e = await espace();
    const membre = await personne();
    await rejoindre({
      communauteId: e.id,
      userId: membre.id,
      droits: await droitsDe(e.slug, membre.id),
      visibilite: "PUBLIC",
    });

    const sujet = await ouvrirSujet({
      communauteId: e.id,
      categorieId: e.categorieId,
      auteurId: membre.id,
      droits: await droitsDe(e.slug, membre.id),
      saisie: { titre: "Mon sujet à moi", corps: "Bonjour." },
    });
    if (!sujet.ok) throw new Error("ouverture ratée");

    const droits = await droitsDe(e.slug, membre.id);

    expect(
      await basculerEpingle({ communauteId: e.id, sujetId: sujet.sujetId, droits }),
    ).toEqual({ ok: false, motif: "INTERDIT" });
    expect(
      await basculerVerrou({ communauteId: e.id, sujetId: sujet.sujetId, droits }),
    ).toEqual({ ok: false, motif: "INTERDIT" });
  });

  it("basculent dans les deux sens", async () => {
    const e = await espace();
    const droits = await droitsDe(e.slug, e.createur.id);
    const sujet = await ouvrirSujet({
      communauteId: e.id,
      categorieId: e.categorieId,
      auteurId: e.createur.id,
      droits,
      saisie: { titre: "Un sujet ordinaire", corps: "Rien de spécial." },
    });
    if (!sujet.ok) throw new Error("ouverture ratée");

    const pose = await basculerEpingle({ communauteId: e.id, sujetId: sujet.sujetId, droits });
    expect(pose).toEqual({ ok: true, epingle: true });

    const retire = await basculerEpingle({ communauteId: e.id, sujetId: sujet.sujetId, droits });
    expect(retire).toEqual({ ok: true, epingle: false });
  });
});

describe("signaler", () => {
  it("marque sans masquer", async () => {
    // Masquer ferait disparaître le contexte d'une conversation dont les
    // réponses citent souvent ce qu'on a signalé.
    const e = await espace();
    const droits = await droitsDe(e.slug, e.createur.id);
    const sujet = await ouvrirSujet({
      communauteId: e.id,
      categorieId: e.categorieId,
      auteurId: e.createur.id,
      droits,
      saisie: { titre: "Un sujet", corps: "Un message à signaler." },
    });
    if (!sujet.ok) throw new Error("ouverture ratée");

    const message = await db.forumPost.findFirstOrThrow({
      where: { topicId: sujet.sujetId },
      select: { id: true },
    });

    const suite = await signalerMessage({
      communauteId: e.id,
      messageId: message.id,
      parId: e.createur.id,
      droits,
    });

    expect(suite.ok).toBe(true);
    const lu = await db.forumPost.findUniqueOrThrow({
      where: { id: message.id },
      select: { isFlagged: true },
    });
    expect(lu.isFlagged).toBe(true);
  });

  it("ne se répète pas", async () => {
    // Le premier signalement suffit à le faire remonter : consigner chaque
    // clic ferait de l'audit un compteur de clics.
    const e = await espace();
    const droits = await droitsDe(e.slug, e.createur.id);
    const sujet = await ouvrirSujet({
      communauteId: e.id,
      categorieId: e.categorieId,
      auteurId: e.createur.id,
      droits,
      saisie: { titre: "Un sujet", corps: "Un message à signaler." },
    });
    if (!sujet.ok) throw new Error("ouverture ratée");

    const message = await db.forumPost.findFirstOrThrow({
      where: { topicId: sujet.sujetId },
      select: { id: true },
    });
    const avis = { communauteId: e.id, messageId: message.id, parId: e.createur.id, droits };

    await signalerMessage(avis);
    const second = await signalerMessage(avis);

    expect(second).toEqual({ ok: false, motif: "INTROUVABLE" });
    expect(await db.auditLog.count()).toBe(1);
  });

  it("exige de pouvoir lire", async () => {
    // Sinon on signalerait à l'aveugle le message d'une communauté qu'on ne
    // voit pas — un moyen commode d'apprendre qu'elle existe.
    const e = await espace("PRIVATE");
    const droits = await droitsDe(e.slug, e.createur.id);
    const sujet = await ouvrirSujet({
      communauteId: e.id,
      categorieId: e.categorieId,
      auteurId: e.createur.id,
      droits,
      saisie: { titre: "Un sujet privé", corps: "Entre nous." },
    });
    if (!sujet.ok) throw new Error("ouverture ratée");

    const message = await db.forumPost.findFirstOrThrow({
      where: { topicId: sujet.sujetId },
      select: { id: true },
    });

    const passant = await personne();
    const suite = await signalerMessage({
      communauteId: e.id,
      messageId: message.id,
      parId: passant.id,
      droits: await droitsDe(e.slug, passant.id),
    });

    expect(suite).toEqual({ ok: false, motif: "INTERDIT" });
  });
});

describe("la règle qui traverse tout", () => {
  it("n'accorde jamais d'écriture sans appartenance", async () => {
    // Formulé une fois pour toutes, sur les trois gestes d'écriture.
    const e = await espace("PUBLIC");
    const passant = await personne();
    const droits = droitsSur(
      { id: e.id, visibilite: "PUBLIC", createurId: e.createur.id, active: true },
      { id: passant.id, role: "MEMBER", appartenance: null },
    );

    expect(droits.lire).toBe(true);
    expect(droits.ecrire).toBe(false);
    expect(droits.moderer).toBe(false);
  });
});
