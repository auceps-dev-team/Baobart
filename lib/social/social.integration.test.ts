import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { commentairesDe, elementsAimes, etatSocial } from "@/lib/social/queries";
import {
  basculerLikeDe,
  basculerSuiviDe,
  publierCommentaireDe,
  retirerCommentaireDe,
} from "@/lib/social/service";

/**
 * Le social confronté à la vraie base.
 *
 * Ce que les tests unitaires ne peuvent pas dire : ce que fait une contrainte
 * d'unicité sous un double-clic, si un compteur dénormalisé reste d'aplomb, et
 * si une suppression emporte bien ce qu'elle doit emporter.
 */

let vendeur: string;
let visiteur: string;
let produit: string;

async function compte(email: string, nom: string): Promise<string> {
  const u = await db.user.create({
    data: {
      email,
      defaultCurrency: "XOF",
      profile: { create: { displayName: nom, username: nom.toLowerCase() } },
    },
    select: { id: true },
  });
  return u.id;
}

beforeEach(async () => {
  vendeur = await compte("kofi@social.test", "Kofi");
  visiteur = await compte("ama@social.test", "Ama");

  const p = await db.product.create({
    data: {
      sellerId: vendeur,
      slug: `social-${Math.random().toString(36).slice(2, 9)}`,
      name: "Pack motifs",
      price: 6000,
      currency: "XOF",
      status: "PUBLISHED",
    },
    select: { id: true },
  });
  produit = p.id;
});

describe("j'aime", () => {
  it("bascule dans les deux sens et tient le compteur", async () => {
    const premier = await basculerLikeDe(visiteur, produit);
    expect(premier).toMatchObject({ ok: true, actif: true, total: 1 });

    let relu = await db.product.findUniqueOrThrow({ where: { id: produit } });
    expect(relu.likesCount).toBe(1);

    const second = await basculerLikeDe(visiteur, produit);
    expect(second).toMatchObject({ ok: true, actif: false, total: 0 });

    relu = await db.product.findUniqueOrThrow({ where: { id: produit } });
    expect(relu.likesCount).toBe(0);
  });

  it("survit à un double-clic sans afficher d'erreur", async () => {
    // Deux appels partis ensemble : l'un crée, l'autre trouve la ligne déjà
    // là. Le résultat voulu est atteint — rien à signaler à la personne.
    const [a, b] = await Promise.all([
      basculerLikeDe(visiteur, produit),
      basculerLikeDe(visiteur, produit),
    ]);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);

    // Un seul like en base, quoi qu'il arrive.
    expect(await db.like.count({ where: { productId: produit } })).toBeLessThanOrEqual(1);

    const relu = await db.product.findUniqueOrThrow({ where: { id: produit } });
    expect(relu.likesCount).toBe(
      await db.like.count({ where: { productId: produit } }),
    );
  });

  it("remet d'aplomb un compteur qui aurait dérivé", async () => {
    await db.product.update({
      where: { id: produit },
      data: { likesCount: 47 },
    });

    const r = await basculerLikeDe(visiteur, produit);
    expect(r).toMatchObject({ total: 1 });

    const relu = await db.product.findUniqueOrThrow({ where: { id: produit } });
    expect(relu.likesCount).toBe(1);
  });

  it("refuse d'aimer un brouillon", async () => {
    const brouillon = await db.product.create({
      data: {
        sellerId: vendeur,
        slug: `brouillon-${Math.random().toString(36).slice(2, 9)}`,
        name: "Pas encore publié",
        price: 1000,
        status: "DRAFT",
      },
      select: { id: true },
    });

    const r = await basculerLikeDe(visiteur, brouillon.id);
    expect(r.ok).toBe(false);
    expect(await db.like.count()).toBe(0);
  });

  it("la base refuse un like sans cible", async () => {
    // Contrainte CHECK posée par la migration : Prisma ne sait pas l'exprimer,
    // et sans elle un like orphelin ferait dériver les compteurs sans trace.
    await expect(
      db.like.create({ data: { userId: visiteur } }),
    ).rejects.toThrow();

    await expect(
      db.$executeRawUnsafe(
        `INSERT INTO "Like" ("id","userId","workItemId","productId","createdAt")
         VALUES ('l1', $1, 'w1', $2, now())`,
        visiteur,
        produit,
      ),
    ).rejects.toThrow();
  });

  it("disparaît de « éléments suivis » quand la ressource est dépubliée", async () => {
    await basculerLikeDe(visiteur, produit);
    expect(await elementsAimes(visiteur)).toHaveLength(1);

    await db.product.update({
      where: { id: produit },
      data: { status: "DRAFT" },
    });

    // Le like reste — le retirer serait décider à la place de la personne —
    // mais la liste ne montre que ce qui est encore en ligne.
    expect(await elementsAimes(visiteur)).toHaveLength(0);
    expect(await db.like.count()).toBe(1);
  });
});

describe("suivi", () => {
  it("bascule et tient les deux compteurs", async () => {
    const r = await basculerSuiviDe(visiteur, vendeur);
    expect(r).toMatchObject({ ok: true, actif: true, total: 1 });

    const suivi = await db.user.findUniqueOrThrow({ where: { id: vendeur } });
    const suiveur = await db.user.findUniqueOrThrow({ where: { id: visiteur } });
    expect(suivi.followersCount).toBe(1);
    expect(suiveur.followingCount).toBe(1);

    await basculerSuiviDe(visiteur, vendeur);
    const apres = await db.user.findUniqueOrThrow({ where: { id: vendeur } });
    expect(apres.followersCount).toBe(0);
  });

  it("refuse qu'on se suive soi-même, en base comme dans le code", async () => {
    const r = await basculerSuiviDe(visiteur, visiteur);
    expect(r).toMatchObject({ ok: false });

    await expect(
      db.follow.create({
        data: { followerId: visiteur, followingId: visiteur },
      }),
    ).rejects.toThrow();
  });

  it("survit à un double-clic", async () => {
    const [a, b] = await Promise.all([
      basculerSuiviDe(visiteur, vendeur),
      basculerSuiviDe(visiteur, vendeur),
    ]);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);

    const lignes = await db.follow.count({ where: { followerId: visiteur } });
    expect(lignes).toBeLessThanOrEqual(1);

    const relu = await db.user.findUniqueOrThrow({ where: { id: vendeur } });
    expect(relu.followersCount).toBe(lignes);
  });
});

describe("commentaires", () => {
  it("publie, compte, et rend le fil", async () => {
    const r = await publierCommentaireDe({
      userId: visiteur,
      produitId: produit,
      corps: "  Superbe travail.  ",
    });
    expect(r.ok).toBe(true);

    const relu = await db.product.findUniqueOrThrow({ where: { id: produit } });
    expect(relu.commentsCount).toBe(1);

    const fil = await commentairesDe(produit, visiteur, vendeur);
    expect(fil).toHaveLength(1);
    // Le corps est enregistré nettoyé, pas tel que saisi.
    expect(fil[0]).toMatchObject({
      corps: "Superbe travail.",
      auteur: "Ama",
      retirable: true,
    });
  });

  it("accepte une réponse et refuse une réponse à une réponse", async () => {
    const racine = await publierCommentaireDe({
      userId: visiteur,
      produitId: produit,
      corps: "Une question sur la licence ?",
    });
    if (!racine.ok) throw new Error("racine non créée");

    const reponse = await publierCommentaireDe({
      userId: vendeur,
      produitId: produit,
      corps: "Commerciale, oui.",
      parentId: racine.id,
    });
    expect(reponse.ok).toBe(true);
    if (!reponse.ok) return;

    // Un identifiant fabriqué à la main ne doit pas permettre d'enfiler les
    // réponses : la profondeur se relit en base.
    const troisieme = await publierCommentaireDe({
      userId: visiteur,
      produitId: produit,
      corps: "Merci !",
      parentId: reponse.id,
    });
    expect(troisieme.ok).toBe(false);

    const fil = await commentairesDe(produit, visiteur, vendeur);
    expect(fil).toHaveLength(1);
    expect(fil[0]?.reponses).toHaveLength(1);
  });

  it("refuse de commenter la ressource d'un autre produit par un parent étranger", async () => {
    const autre = await db.product.create({
      data: {
        sellerId: vendeur,
        slug: `autre-${Math.random().toString(36).slice(2, 9)}`,
        name: "Autre",
        price: 1000,
        status: "PUBLISHED",
      },
      select: { id: true },
    });

    const chezAutre = await publierCommentaireDe({
      userId: visiteur,
      produitId: autre.id,
      corps: "Chez le voisin.",
    });
    if (!chezAutre.ok) throw new Error("non créé");

    const detourne = await publierCommentaireDe({
      userId: visiteur,
      produitId: produit,
      corps: "Greffé ailleurs.",
      parentId: chezAutre.id,
    });
    expect(detourne.ok).toBe(false);
  });

  it("retire le commentaire ET ses réponses", async () => {
    // Reprise du `mark_subtree_deleted!` de Gumroad : laisser « tout à fait
    // d'accord » sous une insulte effacée conserve le propos qu'on retire.
    const racine = await publierCommentaireDe({
      userId: visiteur,
      produitId: produit,
      corps: "Un propos déplacé.",
    });
    if (!racine.ok) throw new Error("racine non créée");

    await publierCommentaireDe({
      userId: vendeur,
      produitId: produit,
      corps: "Tout à fait d'accord.",
      parentId: racine.id,
    });

    let relu = await db.product.findUniqueOrThrow({ where: { id: produit } });
    expect(relu.commentsCount).toBe(2);

    const retrait = await retirerCommentaireDe(vendeur, racine.id);
    expect(retrait).toMatchObject({ ok: true, retires: 2 });

    relu = await db.product.findUniqueOrThrow({ where: { id: produit } });
    expect(relu.commentsCount).toBe(0);

    // Le corps est vidé en base : retiré veut dire illisible, pas caché.
    const lignes = await db.comment.findMany({ where: { productId: produit } });
    expect(lignes).toHaveLength(2);
    expect(lignes.every((l) => l.body === "" && l.deletedAt !== null)).toBe(true);
  });

  it("laisse le créateur modérer sa vitrine, refuse à un tiers", async () => {
    const tiers = await compte("tiers@social.test", "Tiers");

    const c = await publierCommentaireDe({
      userId: visiteur,
      produitId: produit,
      corps: "Mon commentaire.",
    });
    if (!c.ok) throw new Error("non créé");

    expect(await retirerCommentaireDe(tiers, c.id)).toMatchObject({ ok: false });
    expect(await retirerCommentaireDe(vendeur, c.id)).toMatchObject({ ok: true });
    // Deux fois de suite : le second appel ne doit pas prétendre avoir agi.
    expect(await retirerCommentaireDe(vendeur, c.id)).toMatchObject({ ok: false });
  });

  it("refuse de répondre à un commentaire retiré", async () => {
    const racine = await publierCommentaireDe({
      userId: visiteur,
      produitId: produit,
      corps: "Fil fermé depuis.",
    });
    if (!racine.ok) throw new Error("non créé");

    await retirerCommentaireDe(visiteur, racine.id);

    const tardive = await publierCommentaireDe({
      userId: vendeur,
      produitId: produit,
      corps: "Trop tard.",
      parentId: racine.id,
    });
    expect(tardive.ok).toBe(false);
  });

  it("compte les réponses dans l'en-tête, pas seulement les racines", async () => {
    const racine = await publierCommentaireDe({
      userId: visiteur,
      produitId: produit,
      corps: "Question.",
    });
    if (!racine.ok) throw new Error("non créé");

    await publierCommentaireDe({
      userId: vendeur,
      produitId: produit,
      corps: "Réponse.",
      parentId: racine.id,
    });

    const etat = await etatSocial({
      produitId: produit,
      createurId: vendeur,
      userId: visiteur,
    });

    // Deux bulles à l'écran, deux au compteur.
    expect(etat.commentaires).toBe(2);
  });

  it("la base refuse un commentaire sans cible", async () => {
    await expect(
      db.comment.create({ data: { authorId: visiteur, body: "orphelin" } }),
    ).rejects.toThrow();
  });
});

describe("état social vu par la fiche", () => {
  it("dit ce que le visiteur a fait, et rien de personnel pour un anonyme", async () => {
    await basculerLikeDe(visiteur, produit);
    await basculerSuiviDe(visiteur, vendeur);

    const connecte = await etatSocial({
      produitId: produit,
      createurId: vendeur,
      userId: visiteur,
    });
    expect(connecte).toMatchObject({
      jaime: true,
      likes: 1,
      suit: true,
      abonnes: 1,
      chezSoi: false,
    });

    const anonyme = await etatSocial({
      produitId: produit,
      createurId: vendeur,
      userId: null,
    });
    expect(anonyme).toMatchObject({ jaime: false, suit: false, likes: 1 });

    const chezSoi = await etatSocial({
      produitId: produit,
      createurId: vendeur,
      userId: vendeur,
    });
    expect(chezSoi.chezSoi).toBe(true);
  });
});
