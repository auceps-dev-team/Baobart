/**
 * Le fil d'une communauté — contre la vraie base.
 *
 * ─────────────────────────────────────────────────────────────────
 * TROIS FAMILLES DE PROPRIÉTÉS
 *
 *   — l'ordre : un fil se lit du plus ancien au plus récent, et la limite
 *     porte sur les messages les plus RÉCENTS ;
 *   — les gardes : écrire demande l'appartenance, retirer celui d'un autre
 *     demande la modération ;
 *   — l'avis : une fois par jour et par personne, jamais à l'auteur.
 *
 * La dernière est celle qui se casse en silence. Un limiteur qui ne limite
 * plus ne lève aucune erreur : il remplit des cloches.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { droitsSur, type Droits } from "@/lib/forum/acces";
import {
  ecrireDansLeFil,
  filDe,
  prevenirDUneAdhesion,
  retirerDuFil,
  signalerDansLeFil,
} from "@/lib/forum/fil";
import { contexteDe } from "@/lib/forum/queries";
import { ouvrirCommunaute, rejoindre } from "@/lib/forum/redaction";

let n = 0;

async function personne() {
  n += 1;
  return db.user.create({
    data: {
      email: `fil-${n}@baobart.test`,
      profile: { create: { username: `bavard-${n}`, displayName: `Bavard ${n}` } },
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

/** Une communauté ouverte par les vrais chemins, avec son créateur membre. */
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
    select: { id: true, slug: true, name: true },
  });

  return { createur, ...communaute };
}

/** Fait entrer quelqu'un, et rend ses droits réels. */
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

async function ecrire(
  e: { id: string; slug: string; name: string },
  auteur: { id: string; droits: Droits },
  corps: string,
) {
  return ecrireDansLeFil({
    communauteId: e.id,
    communauteNom: e.name,
    communauteSlug: e.slug,
    auteurId: auteur.id,
    auteurNom: "Quelqu'un",
    droits: auteur.droits,
    saisie: { corps },
  });
}

beforeEach(() => {
  n = 0;
});

describe("écrire dans le fil", () => {
  it("refuse à qui n'est pas membre, même sur une communauté ouverte", async () => {
    // C'est ce qui distingue une communauté d'un espace de commentaires : on y
    // entre, et l'on peut en sortir quelqu'un. Sans appartenance, il n'y a
    // rien à retirer à qui se comporte mal.
    const e = await espace();
    const passant = await personne();
    const ctx = await contexteDeQui(e.slug, passant.id);

    expect(ctx.droits.lire).toBe(true);
    const suite = await ecrire(e, { id: passant.id, droits: ctx.droits }, "Bonjour.");

    expect(suite).toEqual({ ok: false, motif: "INTERDIT" });
    expect(await db.communityChatMessage.count()).toBe(0);
  });

  it("accepte un message de deux caractères", async () => {
    // « Ok » est un vrai message, et le plus fréquent d'une conversation qui
    // fonctionne. Un seuil qui le refuse apprend à écrire trois phrases
    // creuses, ou à se taire.
    const e = await espace();
    const ctx = await contexteDeQui(e.slug, e.createur.id);

    const suite = await ecrire(e, { id: e.createur.id, droits: ctx.droits }, "Ok");

    expect(suite.ok).toBe(true);
  });

  it("refuse le vide", async () => {
    const e = await espace();
    const ctx = await contexteDeQui(e.slug, e.createur.id);

    const suite = await ecrire(e, { id: e.createur.id, droits: ctx.droits }, "   ");

    expect(suite.ok).toBe(false);
    if (suite.ok) return;
    expect(suite.motif).toBe("REFUS");
  });
});

describe("lire le fil", () => {
  it("rend les messages du plus ancien au plus récent", async () => {
    // C'est l'ordre d'une conversation, et celui de la maquette : la dernière
    // ligne est en bas, là où la zone de saisie l'attend.
    const e = await espace();
    const ctx = await contexteDeQui(e.slug, e.createur.id);
    const auteur = { id: e.createur.id, droits: ctx.droits };

    await ecrire(e, auteur, "Le premier.");
    await ecrire(e, auteur, "Le deuxième.");
    await ecrire(e, auteur, "Le troisième.");

    const fil = await filDe(ctx);

    expect(fil.map((m) => m.corps)).toEqual([
      "Le premier.",
      "Le deuxième.",
      "Le troisième.",
    ]);
  });

  it("garde les messages les plus RÉCENTS quand il tronque", async () => {
    // Le piège : `take` avec un tri ascendant rendrait les plus ANCIENS, et
    // l'on afficherait le début d'une conversation de trois ans. Personne ne
    // le remarquerait — la page serait pleine, simplement fausse.
    const e = await espace();
    const ctx = await contexteDeQui(e.slug, e.createur.id);
    const auteur = { id: e.createur.id, droits: ctx.droits };

    for (const mot of ["un", "deux", "trois", "quatre", "cinq"]) {
      await ecrire(e, auteur, `Message ${mot}`);
    }

    const fil = await filDe(ctx, 2);

    expect(fil.map((m) => m.corps)).toEqual(["Message quatre", "Message cinq"]);
  });

  it("ne sort pas d'une communauté fermée", async () => {
    // Fermer veut dire fermer, y compris pour le créateur : `contexteDe` rend
    // `null`, et il n'y a donc même pas de contexte avec lequel appeler `filDe`.
    const e = await espace();
    const ctx = await contexteDeQui(e.slug, e.createur.id);
    await ecrire(e, { id: e.createur.id, droits: ctx.droits }, "Avant la fermeture.");

    await db.community.update({
      where: { id: e.id },
      data: { status: "closed" },
    });

    expect(
      await contexteDe(e.slug, { id: e.createur.id, role: "MEMBER" }),
    ).toBeNull();
  });

  it("rend une liste vide quand on n'a pas le droit de lire", async () => {
    // Vide, et non « caché par l'écran ». L'écran ne peut pas laisser fuir ce
    // qu'il n'a jamais reçu.
    const e = await espace();
    const ctx = await contexteDeQui(e.slug, e.createur.id);
    await ecrire(e, { id: e.createur.id, droits: ctx.droits }, "Un message.");

    const sansDroits = {
      ...ctx,
      droits: droitsSur(
        { id: e.id, visibilite: "PRIVATE", createurId: e.createur.id, active: true },
        null,
      ),
    };

    expect(await filDe(sansDroits)).toEqual([]);
  });
});

describe("retirer un message du fil", () => {
  it("laisse chacun retirer le sien", async () => {
    const e = await espace();
    const membre = await membreDe(e);
    const ecrit = await ecrire(e, membre, "Je vais me raviser.");
    if (!ecrit.ok) throw new Error("écriture ratée");

    const suite = await retirerDuFil({
      communauteId: e.id,
      messageId: ecrit.messageId,
      parId: membre.id,
      droits: membre.droits,
    });

    expect(suite.ok).toBe(true);
    expect(await db.communityChatMessage.count()).toBe(0);
    // Effacer le sien n'engage personne : rien au journal.
    expect(await db.auditLog.count()).toBe(0);
  });

  it("refuse celui d'un autre à un simple membre", async () => {
    const e = await espace();
    const auteur = await membreDe(e);
    const autre = await membreDe(e);

    const ecrit = await ecrire(e, auteur, "Mon message.");
    if (!ecrit.ok) throw new Error("écriture ratée");

    const suite = await retirerDuFil({
      communauteId: e.id,
      messageId: ecrit.messageId,
      parId: autre.id,
      droits: autre.droits,
    });

    expect(suite).toEqual({ ok: false, motif: "INTERDIT" });
    expect(await db.communityChatMessage.count()).toBe(1);
  });

  it("laisse un modérateur retirer celui d'un autre, et le consigne", async () => {
    const e = await espace();
    const membre = await membreDe(e);
    const ecrit = await ecrire(e, membre, "Un message déplacé.");
    if (!ecrit.ok) throw new Error("écriture ratée");

    const ctxAdmin = await contexteDeQui(e.slug, e.createur.id);
    const suite = await retirerDuFil({
      communauteId: e.id,
      messageId: ecrit.messageId,
      parId: e.createur.id,
      droits: ctxAdmin.droits,
    });

    expect(suite.ok).toBe(true);
    const traces = await db.auditLog.findMany({ select: { action: true, resource: true } });
    expect(traces).toHaveLength(1);
    expect(traces[0]?.action).toBe("contenu.retirer");
    expect(traces[0]?.resource).toContain("fil-message");
  });

  it("refuse le message d'une autre communauté", async () => {
    // L'identifiant vient du formulaire : sans le rattachement dans le `WHERE`,
    // un modérateur effacerait chez le voisin.
    const chezMoi = await espace();
    const ailleurs = await espace();

    const ctx = await contexteDeQui(ailleurs.slug, ailleurs.createur.id);
    const ecrit = await ecrire(
      ailleurs,
      { id: ailleurs.createur.id, droits: ctx.droits },
      "Chez le voisin.",
    );
    if (!ecrit.ok) throw new Error("écriture ratée");

    const ctxMoi = await contexteDeQui(chezMoi.slug, chezMoi.createur.id);
    const suite = await retirerDuFil({
      communauteId: chezMoi.id,
      messageId: ecrit.messageId,
      parId: chezMoi.createur.id,
      droits: ctxMoi.droits,
    });

    expect(suite).toEqual({ ok: false, motif: "INTROUVABLE" });
    expect(await db.communityChatMessage.count()).toBe(1);
  });
});

describe("signaler dans le fil", () => {
  it("marque sans masquer", async () => {
    const e = await espace();
    const membre = await membreDe(e);
    const ecrit = await ecrire(e, membre, "Un message à signaler.");
    if (!ecrit.ok) throw new Error("écriture ratée");

    const ctx = await contexteDeQui(e.slug, e.createur.id);
    const suite = await signalerDansLeFil({
      communauteId: e.id,
      messageId: ecrit.messageId,
      parId: e.createur.id,
      droits: ctx.droits,
    });

    expect(suite.ok).toBe(true);

    const fil = await filDe(ctx);
    expect(fil).toHaveLength(1);
    expect(fil[0]?.signale).toBe(true);
  });

  it("ne se répète pas", async () => {
    const e = await espace();
    const membre = await membreDe(e);
    const ecrit = await ecrire(e, membre, "Un message à signaler.");
    if (!ecrit.ok) throw new Error("écriture ratée");

    const ctx = await contexteDeQui(e.slug, e.createur.id);
    const avis = {
      communauteId: e.id,
      messageId: ecrit.messageId,
      parId: e.createur.id,
      droits: ctx.droits,
    };

    await signalerDansLeFil(avis);
    const second = await signalerDansLeFil(avis);

    expect(second).toEqual({ ok: false, motif: "INTROUVABLE" });
    expect(await db.auditLog.count()).toBe(1);
  });
});

describe("l'avis aux membres", () => {
  it("prévient les autres, jamais l'auteur", async () => {
    const e = await espace();
    const membre = await membreDe(e);

    await ecrire(e, membre, "Quelqu'un a testé l'encre à l'eau ?");

    const avis = await db.notification.findMany({
      where: { type: "COMMUNAUTE_NOUVEAU_MESSAGE" },
      select: { userId: true },
    });

    // Le créateur est prévenu ; l'auteur du message ne l'est pas.
    expect(avis.map((a) => a.userId)).toEqual([e.createur.id]);
  });

  it("n'en pose qu'un par jour et par personne", async () => {
    // LE test de ce fichier. La clé d'idempotence sert de limiteur : le second
    // message du jour retombe dessus et l'unicité le refuse. Sans ça, dix
    // personnes qui discutent un après-midi font quarante lignes, et une
    // cloche qu'on n'ouvre plus ne prévient de rien — y compris d'un versement.
    const e = await espace();
    const membre = await membreDe(e);

    for (const mot of ["un", "deux", "trois", "quatre"]) {
      await ecrire(e, membre, `Message ${mot}`);
    }

    expect(
      await db.notification.count({ where: { type: "COMMUNAUTE_NOUVEAU_MESSAGE" } }),
    ).toBe(1);
  });

  it("ne dit pas ce qu'on a écrit, parce qu'il ne parlerait que du premier", async () => {
    const e = await espace();
    const membre = await membreDe(e);

    await ecrire(e, membre, "Un secret qui ne doit pas sortir du fil.");

    const avis = await db.notification.findFirstOrThrow({
      where: { type: "COMMUNAUTE_NOUVEAU_MESSAGE" },
      select: { titre: true, corps: true, lien: true },
    });

    expect(avis.titre).toContain(e.name);
    expect(avis.corps).not.toContain("secret");
    expect(avis.lien).toBe(`/communautes/${e.slug}`);
  });
});

describe("l'avis d'adhésion", () => {
  it("va aux administrateurs, pas à tous les membres", async () => {
    // Prévenir deux cents membres que le deux cent unième est arrivé n'apprend
    // rien à personne.
    const e = await espace();
    const ancien = await membreDe(e);
    const arrivant = await membreDe(e);

    await prevenirDUneAdhesion({
      communauteId: e.id,
      communauteNom: e.name,
      communauteSlug: e.slug,
      createurId: e.createur.id,
      arrivantId: arrivant.id,
      arrivantNom: "Awa",
    });

    const avis = await db.notification.findMany({
      where: { type: "COMMUNAUTE_NOUVEAU_MEMBRE" },
      select: { userId: true },
    });

    expect(avis.map((a) => a.userId)).toEqual([e.createur.id]);
    expect(avis.map((a) => a.userId)).not.toContain(ancien.id);
  });

  it("ne prévient le créateur qu'une fois, même s'il a une ligne d'appartenance", async () => {
    // Le créateur administre par `creatorId` ET porte une ligne ADMIN posée à
    // l'ouverture. Sans le `Set`, il recevrait deux avis — ou plutôt un seul,
    // le second étant refusé par l'unicité de la clé, ce qui masquerait le
    // défaut jusqu'au jour où la clé changerait.
    const e = await espace();
    const arrivant = await membreDe(e);

    await prevenirDUneAdhesion({
      communauteId: e.id,
      communauteNom: e.name,
      communauteSlug: e.slug,
      createurId: e.createur.id,
      arrivantId: arrivant.id,
      arrivantNom: "Awa",
    });

    expect(
      await db.notification.count({ where: { type: "COMMUNAUTE_NOUVEAU_MEMBRE" } }),
    ).toBe(1);
  });
});
