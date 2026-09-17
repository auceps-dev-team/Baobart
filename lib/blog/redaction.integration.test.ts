/**
 * Écrire un article — contre la vraie base.
 *
 * ─────────────────────────────────────────────────────────────────
 * CINQ PROPRIÉTÉS QUI DOIVENT TENIR
 *
 *   — un article naît en `BROUILLON`, jamais publié ;
 *   — deux titres identiques donnent deux adresses distinctes ;
 *   — l'adresse se fige à la PREMIÈRE publication et ne bouge plus : un lien
 *     partagé ne doit pas mourir parce qu'on a corrigé une faute ;
 *   — `publishedAt` se pose une fois. Republier un archivé ne le rend pas
 *     neuf, et ne doit pas le remonter en tête de liste ;
 *   — un refus sans motif est refusé.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  compterUneLecture,
  creer,
  modifier,
  publierLesArticlesDus,
  trancher,
} from "@/lib/blog/redaction";
import { articlePublic, listerPublics } from "@/lib/blog/queries";
import type { Saisie } from "@/lib/blog/validation";
import { db } from "@/lib/db";

const CORPS =
  "Le wax n'est pas né en Afrique de l'Ouest, et c'est une histoire que peu " +
  "de gens racontent en entier. Il arrive par les Pays-Bas, au XIXe siècle, " +
  "après un détour par l'Indonésie — et il devient ici quelque chose que " +
  "personne n'avait prévu. Voici comment.";

let n = 0;

async function redacteur() {
  n += 1;
  return db.user.create({
    data: { email: `plume-${n}@baobart.test`, platformRole: "CONTENT_MANAGER" },
    select: { id: true },
  });
}

function saisie(over: Partial<Saisie> = {}): Saisie {
  return {
    titre: "D'où vient vraiment le wax",
    corps: CORPS,
    extrait: "",
    categorieId: "",
    couvertureUrl: "",
    seoTitre: "",
    seoDescription: "",
    urlCanonique: "",
    aLaUne: "",
    parutionPrevue: "",
    ...over,
  };
}

/** Crée un article et le laisse dans l'état demandé. */
async function article(over: Partial<Saisie> = {}) {
  const auteur = await redacteur();
  const suite = await creer({ auteurId: auteur.id, saisie: saisie(over) });
  if (!suite.ok) throw new Error("création ratée dans le montage du test");
  return { id: suite.articleId, auteurId: auteur.id };
}

beforeEach(() => {
  n = 0;
});

describe("créer", () => {
  it("naît en BROUILLON, jamais publié", async () => {
    const a = await article();

    const lu = await db.blogPost.findUniqueOrThrow({
      where: { id: a.id },
      select: { state: true, slug: true, publishedAt: true, excerpt: true },
    });

    expect(lu.state).toBe("BROUILLON");
    expect(lu.publishedAt).toBeNull();
    expect(lu.slug).toBe("d-ou-vient-vraiment-le-wax");
    // L'extrait a été déduit du corps : la validation le range, l'affichage ne
    // le recalcule pas.
    expect(lu.excerpt).toContain("Le wax n'est pas né");
  });

  it("donne deux adresses distinctes à deux titres identiques", async () => {
    const un = await article();
    const deux = await article();

    const [a, b] = await Promise.all([
      db.blogPost.findUniqueOrThrow({ where: { id: un.id }, select: { slug: true } }),
      db.blogPost.findUniqueOrThrow({ where: { id: deux.id }, select: { slug: true } }),
    ]);

    expect(a.slug).not.toBe(b.slug);
    expect(b.slug).toBe("d-ou-vient-vraiment-le-wax-2");
  });

  it("refuse une saisie invalide et n'écrit rien", async () => {
    const auteur = await redacteur();
    const suite = await creer({
      auteurId: auteur.id,
      saisie: saisie({ corps: "trop court" }),
    });

    expect(suite.ok).toBe(false);
    if (suite.ok) return;
    expect(suite.motif).toBe("REFUS");
    expect(await db.blogPost.count()).toBe(0);
  });
});

describe("l'adresse", () => {
  it("suit le titre tant que l'article n'a pas paru", async () => {
    // Personne ne l'a encore : la changer ne casse aucun lien.
    const a = await article();

    await modifier({
      articleId: a.id,
      saisie: saisie({ titre: "Le wax, une histoire hollandaise" }),
    });

    const lu = await db.blogPost.findUniqueOrThrow({
      where: { id: a.id },
      select: { slug: true },
    });
    expect(lu.slug).toBe("le-wax-une-histoire-hollandaise");
  });

  it("se fige à la première publication", async () => {
    // LE test de ce fichier. Un lien partagé ne doit pas mourir parce que
    // quelqu'un a corrigé une faute dans un titre.
    const a = await article();
    await trancher({ articleId: a.id, geste: "publier", acteurId: a.auteurId });

    await modifier({
      articleId: a.id,
      saisie: saisie({ titre: "Titre entièrement différent" }),
    });

    const lu = await db.blogPost.findUniqueOrThrow({
      where: { id: a.id },
      select: { slug: true, title: true },
    });

    // Le titre change, l'adresse non.
    expect(lu.title).toBe("Titre entièrement différent");
    expect(lu.slug).toBe("d-ou-vient-vraiment-le-wax");
  });

  it("reste figée même après archivage", async () => {
    // C'est `publishedAt` qui tranche, pas l'état — et la raison est que
    // l'archivage est réversible : si l'adresse dérivait pendant, republier
    // ferait revenir l'article ailleurs.
    const a = await article();
    await trancher({ articleId: a.id, geste: "publier", acteurId: a.auteurId });
    await trancher({ articleId: a.id, geste: "retirer", acteurId: a.auteurId });

    await modifier({
      articleId: a.id,
      saisie: saisie({ titre: "Encore un autre titre" }),
    });

    const lu = await db.blogPost.findUniqueOrThrow({
      where: { id: a.id },
      select: { slug: true },
    });
    expect(lu.slug).toBe("d-ou-vient-vraiment-le-wax");
  });
});

describe("trancher", () => {
  it("publie un brouillon sans passer par une file", async () => {
    // §18.1 : l'auteur porte déjà le droit de publier. Lui faire traverser une
    // file l'obligerait à s'auto-approuver.
    const a = await article();

    const suite = await trancher({
      articleId: a.id,
      geste: "publier",
      acteurId: a.auteurId,
    });

    expect(suite).toEqual({ ok: true, vers: "PUBLIE" });

    const lu = await db.blogPost.findUniqueOrThrow({
      where: { id: a.id },
      select: { publishedAt: true, moderatedAt: true, moderatorId: true },
    });
    expect(lu.publishedAt).not.toBeNull();
    expect(lu.moderatorId).toBe(a.auteurId);
  });

  it("offre aussi la relecture, sans l'imposer", async () => {
    // §4.3 la voulait obligatoire, §18.1 l'interdit comme obligation. Les deux
    // se rejoignent : le chemin existe, on ne le force pas.
    const a = await article();

    const suite = await trancher({
      articleId: a.id,
      geste: "soumettre",
      acteurId: a.auteurId,
    });

    expect(suite).toEqual({ ok: true, vers: "SOUMIS" });

    // Soumettre n'est pas relire : pas de trace de relecture.
    const lu = await db.blogPost.findUniqueOrThrow({
      where: { id: a.id },
      select: { moderatedAt: true, moderatorId: true },
    });
    expect(lu.moderatedAt).toBeNull();
    expect(lu.moderatorId).toBeNull();
  });

  it("ne pose `publishedAt` qu'une fois", async () => {
    // Republier un archivé ne le rend pas neuf. Remonter sa date le ferait
    // repasser en tête de liste, et tromperait le lecteur.
    const a = await article();
    await trancher({ articleId: a.id, geste: "publier", acteurId: a.auteurId });

    const premier = await db.blogPost.findUniqueOrThrow({
      where: { id: a.id },
      select: { publishedAt: true },
    });

    await trancher({ articleId: a.id, geste: "retirer", acteurId: a.auteurId });
    await trancher({ articleId: a.id, geste: "publier", acteurId: a.auteurId });

    const second = await db.blogPost.findUniqueOrThrow({
      where: { id: a.id },
      select: { publishedAt: true },
    });

    expect(second.publishedAt?.toISOString()).toBe(
      premier.publishedAt?.toISOString(),
    );
  });

  it("exige un motif pour refuser, et n'écrit rien sans lui", async () => {
    const a = await article();
    await trancher({ articleId: a.id, geste: "soumettre", acteurId: a.auteurId });

    const relecteur = await redacteur();
    const suite = await trancher({
      articleId: a.id,
      geste: "refuser",
      acteurId: relecteur.id,
      motif: "court",
    });

    expect(suite).toEqual({ ok: false, motif: "MOTIF_REQUIS" });

    const lu = await db.blogPost.findUniqueOrThrow({
      where: { id: a.id },
      select: { state: true, refusedReason: true },
    });
    expect(lu.state).toBe("SOUMIS");
    expect(lu.refusedReason).toBeNull();
  });

  it("efface le motif dès qu'une autre décision est prise", async () => {
    const a = await article();
    await trancher({ articleId: a.id, geste: "soumettre", acteurId: a.auteurId });

    const relecteur = await redacteur();
    await trancher({
      articleId: a.id,
      geste: "refuser",
      acteurId: relecteur.id,
      motif: "Le titre promet une histoire que le texte ne raconte pas.",
    });

    await trancher({ articleId: a.id, geste: "reprendre", acteurId: a.auteurId });

    const lu = await db.blogPost.findUniqueOrThrow({
      where: { id: a.id },
      select: { state: true, refusedReason: true },
    });
    expect(lu.state).toBe("BROUILLON");
    expect(lu.refusedReason).toBeNull();
  });

  it("ne laisse pas deux personnes trancher la même fiche", async () => {
    const a = await article();

    const [un, deux] = await Promise.all([
      trancher({ articleId: a.id, geste: "publier", acteurId: a.auteurId }),
      trancher({ articleId: a.id, geste: "publier", acteurId: a.auteurId }),
    ]);

    // L'une passe, l'autre repart sans rien casser.
    expect([un.ok, deux.ok].filter(Boolean)).toHaveLength(1);
  });
});

describe("la lecture publique", () => {
  it("ne montre que ce qui est publié", async () => {
    const brouillon = await article();
    const publie = await article({ titre: "Un article bien en ligne" });
    await trancher({
      articleId: publie.id,
      geste: "publier",
      acteurId: publie.auteurId,
    });

    const liste = await listerPublics();

    expect(liste.map((a) => a.id)).toEqual([publie.id]);
    expect(await articlePublic("d-ou-vient-vraiment-le-wax")).toBeNull();
    expect(brouillon.id).not.toBe(publie.id);
  });

  it("cesse de servir un article archivé", async () => {
    // Le comportement était juste et NON TESTÉ, pendant qu'un commentaire de
    // `redaction.ts` affirmait le contraire — « son adresse doit continuer de
    // répondre ». Ce test existe pour que les deux ne puissent plus diverger.
    const a = await article();
    await trancher({ articleId: a.id, geste: "publier", acteurId: a.auteurId });

    expect(await articlePublic("d-ou-vient-vraiment-le-wax")).not.toBeNull();

    await trancher({ articleId: a.id, geste: "retirer", acteurId: a.auteurId });

    expect(await articlePublic("d-ou-vient-vraiment-le-wax")).toBeNull();
    expect(await listerPublics()).toHaveLength(0);
  });

  it("le remet à la même adresse s'il est republié", async () => {
    // La vraie raison de figer le slug : archiver est réversible. Si l'adresse
    // dérivait pendant l'archivage, republier ferait revenir l'article
    // ailleurs, et les liens partagés pendant qu'il était en ligne tomberaient.
    const a = await article();
    await trancher({ articleId: a.id, geste: "publier", acteurId: a.auteurId });
    await trancher({ articleId: a.id, geste: "retirer", acteurId: a.auteurId });

    // Quelqu'un corrige le titre pendant que l'article est hors ligne.
    await modifier({
      articleId: a.id,
      saisie: saisie({ titre: "Un titre repensé de fond en comble" }),
    });

    await trancher({ articleId: a.id, geste: "publier", acteurId: a.auteurId });

    const revenu = await articlePublic("d-ou-vient-vraiment-le-wax");
    expect(revenu?.id).toBe(a.id);
    expect(revenu?.titre).toBe("Un titre repensé de fond en comble");
  });

  it("rend l'article par son adresse", async () => {
    const a = await article();
    await trancher({ articleId: a.id, geste: "publier", acteurId: a.auteurId });

    const lu = await articlePublic("d-ou-vient-vraiment-le-wax");

    expect(lu?.id).toBe(a.id);
    expect(lu?.corps).toContain("Pays-Bas");
  });
});

describe("le compteur de vues", () => {
  it("s'incrémente sans lecture préalable", async () => {
    // `{ increment: 1 }` laisse PostgreSQL faire l'addition. Lire puis écrire
    // perdrait des vues dès que deux lecteurs arrivent en même temps — et
    // c'est quand un article marche que le compteur compterait mal.
    const a = await article();

    await Promise.all(
      Array.from({ length: 10 }, () => compterUneLecture(a.id)),
    );

    const lu = await db.blogPost.findUniqueOrThrow({
      where: { id: a.id },
      select: { viewsCount: true },
    });
    expect(lu.viewsCount).toBe(10);
  });

  it("ne lève pas sur un article qui n'existe plus", async () => {
    // Un compteur qui rate ne doit pas faire échouer l'affichage.
    await expect(
      compterUneLecture("cl00000000000000000000"),
    ).resolves.toBeUndefined();
  });
});

describe("la publication planifiée", () => {
  /** Un brouillon dont l'heure est passée. */
  async function planifie(quand: Date, titre = "Un article planifié") {
    const a = await article({
      titre,
      parutionPrevue: quand.toISOString().slice(0, 16),
    });
    return a;
  }

  it("publie ce dont l'heure est venue", async () => {
    const a = await planifie(new Date("2026-09-01T08:00:00Z"));

    const bilan = await publierLesArticlesDus(new Date("2026-09-01T09:00:00Z"));

    expect(bilan).toEqual({ vus: 1, publies: 1 });

    const lu = await db.blogPost.findUniqueOrThrow({
      where: { id: a.id },
      select: { state: true, publishedAt: true, scheduledAt: true },
    });
    expect(lu.state).toBe("PUBLIE");
    expect(lu.publishedAt).not.toBeNull();
    // La date s'efface : sinon elle resterait affichée sur un article en ligne
    // et laisserait croire qu'une seconde parution est prévue.
    expect(lu.scheduledAt).toBeNull();
  });

  it("laisse tranquille ce dont l'heure n'est pas venue", async () => {
    await planifie(new Date("2026-09-10T08:00:00Z"));

    const bilan = await publierLesArticlesDus(new Date("2026-09-01T09:00:00Z"));

    expect(bilan).toEqual({ vus: 0, publies: 0 });
    expect(await listerPublics()).toHaveLength(0);
  });

  it("rattrape une heure tombée pendant une panne", async () => {
    // La condition est « l'heure est passée », jamais « l'heure est celle-ci ».
    // Chercher l'égalité ferait perdre définitivement tout article dont
    // l'heure serait tombée pendant un passage sauté.
    await planifie(new Date("2026-08-01T08:00:00Z"));

    const bilan = await publierLesArticlesDus(new Date("2026-09-15T09:00:00Z"));

    expect(bilan.publies).toBe(1);
  });

  it("ne republie jamais un article archivé", async () => {
    // Le cas qui justifie `state: BROUILLON` dans la condition : une date
    // oubliée sur un article qu'on a retiré entre-temps ne doit pas le
    // remettre en ligne dans le dos de qui l'a retiré.
    const a = await planifie(new Date("2026-09-01T08:00:00Z"));

    await trancher({ articleId: a.id, geste: "publier", acteurId: a.auteurId });
    await trancher({ articleId: a.id, geste: "retirer", acteurId: a.auteurId });

    // On repose une date à la main, comme le ferait une donnée oubliée.
    await db.blogPost.update({
      where: { id: a.id },
      data: { scheduledAt: new Date("2026-09-01T08:00:00Z") },
    });

    const bilan = await publierLesArticlesDus(new Date("2026-09-02T09:00:00Z"));

    expect(bilan.publies).toBe(0);
    const lu = await db.blogPost.findUniqueOrThrow({
      where: { id: a.id },
      select: { state: true },
    });
    expect(lu.state).toBe("RETIRE");
  });

  it("annule la planification dès qu'on tranche à la main", async () => {
    // Publier la réalise, retirer l'annule. La laisser ferait republier
    // l'article tout seul au passage suivant.
    const a = await planifie(new Date("2026-09-10T08:00:00Z"));

    await trancher({ articleId: a.id, geste: "publier", acteurId: a.auteurId });

    const lu = await db.blogPost.findUniqueOrThrow({
      where: { id: a.id },
      select: { scheduledAt: true },
    });
    expect(lu.scheduledAt).toBeNull();
  });

  it("ne publie pas deux fois quand deux passages se croisent", async () => {
    const a = await planifie(new Date("2026-09-01T08:00:00Z"));

    const [un, deux] = await Promise.all([
      publierLesArticlesDus(new Date("2026-09-01T09:00:00Z")),
      publierLesArticlesDus(new Date("2026-09-01T09:00:00Z")),
    ]);

    expect(un.publies + deux.publies).toBe(1);
    expect(a.id).toBeTruthy();
  });
});
