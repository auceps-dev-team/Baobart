/**
 * Les avis notés, contre une vraie base. Lot 4, 09/11/2026.
 *
 * Ce qu'on éprouve, d'après les quatre réponses et les décisions du 09/11 :
 *   - qui peut noter (obtenu, gratuit compris ; jamais le vendeur) ;
 *   - un avis par compte et par ressource ;
 *   - les compteurs rangés égalent le recompte, quoi qu'il arrive ;
 *   - un remboursement intégral, un litige, un accès retiré sortent l'avis des
 *     comptes AU MOMENT où ils arrivent — par les vraies fonctions d'argent ;
 *   - la règle SQL égale la règle TypeScript (fast-check) ;
 *   - le balayage nocturne répare un compteur faussé.
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { avisDeLaRessource } from "@/lib/avis/lecture";
import { recompterTousLesAvis } from "@/lib/avis/recompte";
import { aObtenu, type LigneObtenue } from "@/lib/avis/regles";
import { laisserUnAvis, repondreAUnAvis, retirerSonAvis } from "@/lib/avis/service";
import { BON_PUBLIC_AVIS } from "@/lib/badges/merites";
import { mesuresDe } from "@/lib/badges/mesures";
import { db } from "@/lib/db";
import { rendreAcces, retirerAcces } from "@/lib/domain/acces";
import { enregistrerLitige, litigeGagne } from "@/lib/domain/litiges";
import { encaisserLigne, rembourserLigne } from "@/lib/domain/orders";

let n = 0;

async function compte(prefixe: string) {
  n += 1;
  const marque = `${prefixe}-av-${n}-${Math.random().toString(36).slice(2, 7)}`;
  return db.user.create({
    data: { email: `${marque}@baobart.test`, profile: { create: { username: marque, displayName: `Nom ${marque}` } } },
    select: { id: true },
  });
}

async function ressource(vendeurId: string, prix = 2_000) {
  n += 1;
  return db.product.create({
    data: { sellerId: vendeurId, name: `Ressource ${n}`, slug: `r-av-${n}-${Math.random().toString(36).slice(2, 6)}`, price: prix, currency: "XOF", status: "PUBLISHED" },
    select: { id: true, slug: true },
  });
}

/** Un achat encaissé par la vraie fonction, pour que remboursement et litige puissent suivre. */
async function acheter(acheteurId: string, produitId: string, prix = 2_000) {
  const commande = await db.order.create({
    data: { buyerId: acheteurId, total: prix, currency: "XOF", items: { create: { productId: produitId, quantity: 1, price: prix } } },
    select: { items: { select: { id: true } } },
  });
  const ligneId = commande.items[0]!.id;
  await encaisserLigne({ orderItemId: ligneId });
  return ligneId;
}

/** Une ressource gratuite reçue : livrée sans encaissement. */
async function recevoirGratuit(acheteurId: string, produitId: string) {
  await db.order.create({
    data: { buyerId: acheteurId, total: 0, currency: "XOF", items: { create: { productId: produitId, quantity: 1, price: 0, state: "NOT_CHARGED" } } },
  });
}

const stats = (id: string) =>
  db.product.findUniqueOrThrow({ where: { id }, select: { ratingStars: true, ratingCount: true, ratingAvg: true } });

describe("qui peut noter", () => {
  it("refuse qui n'a pas obtenu la ressource, et le vendeur sur la sienne", async () => {
    const vendeur = await compte("v");
    const passant = await compte("p");
    const p = await ressource(vendeur.id);

    expect(await laisserUnAvis({ auteurId: passant.id, produitId: p.id, note: 5, texte: "" })).toEqual({ ok: false, motif: "NON_OBTENU" });
    expect(await laisserUnAvis({ auteurId: vendeur.id, produitId: p.id, note: 5, texte: "" })).toEqual({ ok: false, motif: "SA_RESSOURCE" });
    expect((await stats(p.id)).ratingCount).toBe(0);
  });

  it("accepte un acheteur, et quiconque a reçu une ressource gratuite (décision du 09/11)", async () => {
    const vendeur = await compte("v");
    const p = await ressource(vendeur.id);
    const gratuite = await ressource(vendeur.id, 0);
    const acheteur = await compte("a");
    const curieux = await compte("c");
    await acheter(acheteur.id, p.id);
    await recevoirGratuit(curieux.id, gratuite.id);

    expect(await laisserUnAvis({ auteurId: acheteur.id, produitId: p.id, note: 4, texte: "Bien" })).toMatchObject({ ok: true, nouveau: true });
    expect(await laisserUnAvis({ auteurId: curieux.id, produitId: gratuite.id, note: 3, texte: "" })).toMatchObject({ ok: true });
  });

  it("refuse une note hors de 1 à 5, même si le code la laissait passer (contrainte CHECK)", async () => {
    const vendeur = await compte("v");
    const p = await ressource(vendeur.id);
    const acheteur = await compte("a");
    await acheter(acheteur.id, p.id);

    expect(await laisserUnAvis({ auteurId: acheteur.id, produitId: p.id, note: "6", texte: "" })).toEqual({ ok: false, motif: "NOTE_INVALIDE" });
    await expect(db.productReview.create({ data: { authorId: acheteur.id, productId: p.id, rating: 9 } })).rejects.toThrow();
  });
});

describe("un avis par compte, et des compteurs justes", () => {
  it("modifie l'avis existant au lieu d'en empiler un second", async () => {
    const vendeur = await compte("v");
    const p = await ressource(vendeur.id);
    const acheteur = await compte("a");
    await acheter(acheteur.id, p.id);

    await laisserUnAvis({ auteurId: acheteur.id, produitId: p.id, note: 2, texte: "Moyen" });
    expect(await laisserUnAvis({ auteurId: acheteur.id, produitId: p.id, note: 5, texte: "Finalement parfait" })).toMatchObject({ ok: true, nouveau: false });

    expect(await db.productReview.count({ where: { productId: p.id } })).toBe(1);
    expect(await stats(p.id)).toMatchObject({ ratingStars: [0, 0, 0, 0, 1], ratingCount: 1 });
  });

  it("tient la note de la ressource et celle du créateur", async () => {
    const vendeur = await compte("v");
    const p1 = await ressource(vendeur.id);
    const p2 = await ressource(vendeur.id);
    for (const [produit, note] of [[p1.id, 5], [p1.id, 4], [p2.id, 3]] as const) {
      const a = await compte("a");
      await acheter(a.id, produit);
      await laisserUnAvis({ auteurId: a.id, produitId: produit, note, texte: "" });
    }

    expect(await stats(p1.id)).toMatchObject({ ratingStars: [0, 0, 0, 1, 1], ratingCount: 2 });
    expect(Number((await stats(p1.id)).ratingAvg)).toBe(4.5);
    const profil = await db.profile.findUniqueOrThrow({ where: { userId: vendeur.id }, select: { ratingAvg: true, ratingCount: true } });
    expect(profil.ratingCount).toBe(3);
    expect(Number(profil.ratingAvg)).toBe(4);
  });

  it("garde les compteurs égaux au recompte sur une suite d'avis tirée au hasard (fast-check)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ qui: fc.integer({ min: 0, max: 2 }), geste: fc.oneof(fc.integer({ min: 1, max: 5 }), fc.constant("retirer" as const)) }), { minLength: 1, maxLength: 8 }),
        async (gestes) => {
          const vendeur = await compte("fc-v");
          const p = await ressource(vendeur.id);
          const auteurs = await Promise.all([0, 1, 2].map(() => compte("fc-a")));
          for (const a of auteurs) await acheter(a.id, p.id);

          const derniere = new Map<number, number>();
          for (const g of gestes) {
            if (g.geste === "retirer") {
              await retirerSonAvis({ auteurId: auteurs[g.qui]!.id, produitId: p.id });
              derniere.delete(g.qui);
            } else {
              await laisserUnAvis({ auteurId: auteurs[g.qui]!.id, produitId: p.id, note: g.geste, texte: "" });
              derniere.set(g.qui, g.geste);
            }
          }
          const attendu = [0, 0, 0, 0, 0];
          for (const note of derniere.values()) attendu[note - 1]! += 1;
          expect((await stats(p.id)).ratingStars).toEqual(attendu);
        },
      ),
      { numRuns: 15 },
    );
  });
});

describe("l'argent fait sortir un avis des comptes, au moment où il bouge", () => {
  async function avisPose() {
    const vendeur = await compte("v");
    const p = await ressource(vendeur.id);
    const acheteur = await compte("a");
    const ligne = await acheter(acheteur.id, p.id);
    await laisserUnAvis({ auteurId: acheteur.id, produitId: p.id, note: 5, texte: "Superbe" });
    expect((await stats(p.id)).ratingCount).toBe(1);
    return { vendeur, p, acheteur, ligne };
  }

  it("un remboursement intégral le retire, un remboursement partiel le laisse", async () => {
    const { p, ligne } = await avisPose();
    await rembourserLigne({ orderItemId: ligne, amount: 500 });
    expect((await stats(p.id)).ratingCount).toBe(1);
    await rembourserLigne({ orderItemId: ligne, amount: 1_500 });
    expect((await stats(p.id)).ratingCount).toBe(0);
  });

  it("un litige le retire, un litige gagné le rend", async () => {
    const { p, ligne } = await avisPose();
    await enregistrerLitige({ orderItemId: ligne });
    expect((await stats(p.id)).ratingCount).toBe(0);
    await litigeGagne({ orderItemId: ligne });
    expect((await stats(p.id)).ratingCount).toBe(1);
  });

  it("un accès retiré le retire, un accès rendu le rend", async () => {
    const { vendeur, p, ligne } = await avisPose();
    await retirerAcces({ orderItemId: ligne, vendeurId: vendeur.id });
    expect((await stats(p.id)).ratingCount).toBe(0);
    await rendreAcces({ orderItemId: ligne, vendeurId: vendeur.id });
    expect((await stats(p.id)).ratingCount).toBe(1);
  });

  it("l'auteur revoit son avis sorti des comptes, la fiche ne le montre plus", async () => {
    const { p, acheteur, ligne } = await avisPose();
    await rembourserLigne({ orderItemId: ligne, amount: 2_000 });

    const pourLui = await avisDeLaRessource(p.id, acheteur.id);
    expect(pourLui!.monAvis).toMatchObject({ note: 5, compte: false });
    expect(pourLui!.avis).toHaveLength(0);
    // Remboursé en entier : il ne peut plus le modifier (règle de Gumroad).
    expect(await laisserUnAvis({ auteurId: acheteur.id, produitId: p.id, note: 1, texte: "" })).toEqual({ ok: false, motif: "NON_OBTENU" });
  });
});

describe("la réponse du créateur", () => {
  it("n'est permise qu'au créateur, une seule, et prévient l'auteur", async () => {
    const vendeur = await compte("v");
    const p = await ressource(vendeur.id);
    const acheteur = await compte("a");
    const intrus = await compte("i");
    await acheter(acheteur.id, p.id);
    await laisserUnAvis({ auteurId: acheteur.id, produitId: p.id, note: 3, texte: "J'aurais aimé un SVG" });
    const avis = await db.productReview.findFirstOrThrow({ where: { productId: p.id }, select: { id: true } });

    expect(await repondreAUnAvis({ vendeurId: intrus.id, avisId: avis.id, texte: "Moi aussi" })).toEqual({ ok: false, motif: "PAS_LE_CREATEUR" });
    expect(await repondreAUnAvis({ vendeurId: vendeur.id, avisId: avis.id, texte: "  " })).toEqual({ ok: false, motif: "TEXTE_VIDE" });
    expect(await repondreAUnAvis({ vendeurId: vendeur.id, avisId: avis.id, texte: "Il arrive" })).toMatchObject({ ok: true });
    expect(await repondreAUnAvis({ vendeurId: vendeur.id, avisId: avis.id, texte: "Il est en ligne" })).toMatchObject({ ok: true });

    expect(await db.productReviewResponse.count({ where: { reviewId: avis.id } })).toBe(1);
    expect(await db.notification.count({ where: { userId: acheteur.id, type: "REPONSE_AVIS" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: vendeur.id, type: "AVIS_RECU" } })).toBe(1);
  });
});

describe("la règle « l'avis compte », SQL contre TypeScript (fast-check)", () => {
  const ligneAleatoire = fc.record({
    state: fc.constantFrom("SUCCESSFUL", "NOT_CHARGED", "FAILED", "IN_PROGRESS"),
    tipAmount: fc.constantFrom(0, 300),
    rembourse: fc.constantFrom("rien", "partiel", "prix", "entier"),
    litige: fc.constantFrom("aucun", "ouvert", "gagne"),
    revoque: fc.boolean(),
  });

  it("compte exactement les avis que `aObtenu` accepte", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.array(ligneAleatoire, { minLength: 1, maxLength: 2 }), { minLength: 1, maxLength: 4 }), async (parAuteur) => {
        const vendeur = await compte("fc-v");
        const p = await ressource(vendeur.id);
        let attendus = 0;
        for (const lignes of parAuteur) {
          const auteur = await compte("fc-a");
          const obtenues: LigneObtenue[] = [];
          for (const t of lignes) {
            const prix = t.state === "NOT_CHARGED" ? 0 : 2_000;
            const du = prix + (t.state === "NOT_CHARGED" ? 0 : t.tipAmount);
            const ligne = {
              state: t.state,
              price: prix,
              quantity: 1,
              tipAmount: t.state === "NOT_CHARGED" ? 0 : t.tipAmount,
              refundedAmount: { rien: 0, partiel: 500, prix, entier: du }[t.rembourse],
              chargebackAt: t.litige === "aucun" ? null : new Date("2026-10-10T00:00:00Z"),
              chargebackReversedAt: t.litige === "gagne" ? new Date("2026-10-20T00:00:00Z") : null,
              accessRevokedAt: t.revoque ? new Date("2026-10-15T00:00:00Z") : null,
            };
            await db.order.create({ data: { buyerId: auteur.id, total: du, currency: "XOF", items: { create: { productId: p.id, ...ligne } } } });
            obtenues.push(ligne);
          }
          // L'avis est posé directement : on éprouve le COMPTE, pas le droit d'écrire.
          await db.productReview.create({ data: { authorId: auteur.id, productId: p.id, rating: 4 } });
          if (aObtenu(obtenues)) attendus += 1;
        }
        await recompterTousLesAvis();
        expect((await stats(p.id)).ratingCount).toBe(attendus);
      }),
      {
        numRuns: 20,
        // Les cas que le hasard rate trop souvent, joués d'abord — la leçon du lot 2.
        examples: [
          [[[{ state: "NOT_CHARGED", tipAmount: 0, rembourse: "rien", litige: "aucun", revoque: false }]]],
          [[[{ state: "SUCCESSFUL", tipAmount: 300, rembourse: "prix", litige: "aucun", revoque: false }]]],
          [[[{ state: "SUCCESSFUL", tipAmount: 0, rembourse: "entier", litige: "aucun", revoque: false }, { state: "SUCCESSFUL", tipAmount: 0, rembourse: "rien", litige: "aucun", revoque: false }]]],
          [[[{ state: "SUCCESSFUL", tipAmount: 0, rembourse: "rien", litige: "gagne", revoque: true }]]],
        ],
      },
    );
  });
});

describe("le balayage nocturne", () => {
  it("répare un compteur faussé à la main", async () => {
    const vendeur = await compte("v");
    const p = await ressource(vendeur.id);
    const acheteur = await compte("a");
    await acheter(acheteur.id, p.id);
    await laisserUnAvis({ auteurId: acheteur.id, produitId: p.id, note: 4, texte: "" });
    await db.product.update({ where: { id: p.id }, data: { ratingStars: [9, 9, 9, 9, 9], ratingCount: 45 } });

    expect(await recompterTousLesAvis()).toBeGreaterThanOrEqual(1);
    expect(await stats(p.id)).toMatchObject({ ratingStars: [0, 0, 0, 1, 0], ratingCount: 1 });
  });
});

describe("« Bon public » à côté d'un avis", () => {
  // La pastille de la carte (`lib/avis/lecture.ts`) et le mérite du profil
  // (`lib/badges/mesures.ts`) comptent chacun de leur côté. Rien ne les liait :
  // ce test les fait parler du même auteur, au bord exact (13/11/2026).
  it("s'allume au 25e avis qui COMPTE, pas au 25e avis écrit — et dit la même chose que le mérite", async () => {
    const vendeur = await compte("v");
    const auteur = await compte("a");
    const produits: Array<{ id: string; slug: string }> = [];
    for (let i = 0; i < BON_PUBLIC_AVIS; i++) produits.push(await ressource(vendeur.id, 0));

    // Vingt-cinq avis écrits, vingt-quatre qui comptent : la dernière ressource
    // n'a jamais été obtenue.
    for (const p of produits.slice(0, -1)) await recevoirGratuit(auteur.id, p.id);
    await db.productReview.createMany({ data: produits.map((p) => ({ authorId: auteur.id, productId: p.id, rating: 4 })) });

    const pastille = async () => (await avisDeLaRessource(produits[0]!.id, null))!.avis[0]!.auteur.bonPublic;
    const merite = async () => (await mesuresDe(auteur.id))!.avisRediges >= BON_PUBLIC_AVIS;

    expect((await mesuresDe(auteur.id))!.avisRediges).toBe(BON_PUBLIC_AVIS - 1);
    expect(await pastille()).toBe(false);
    expect(await merite()).toBe(false);

    // La dernière ressource est obtenue : le vingt-cinquième avis compte.
    await recevoirGratuit(auteur.id, produits.at(-1)!.id);
    expect(await pastille()).toBe(true);
    expect(await merite()).toBe(true);
  });
});
