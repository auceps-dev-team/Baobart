/**
 * Déposer un service — contre la vraie base.
 *
 * ─────────────────────────────────────────────────────────────────
 * QUATRE PROPRIÉTÉS QUI TIENNENT
 *
 *   — l'offre naît en `SOUMIS`, JAMAIS en `PUBLIE`. C'est ce qui garantit qu'une
 *     prestation ne paraisse pas sans avoir été relue ;
 *   — la validation refuse ce qui n'est pas propre — mais elle est éprouvée
 *     ailleurs, on ne redémontre pas ici, on vérifie juste que le module
 *     s'appuie dessus (pas de doublement d'écriture) ;
 *   — une catégorie retirée n'accepte pas d'offre : `RESTRICT` refuserait de
 *     toute façon, mais le message serait celui d'une erreur SQL ;
 *   — la fenêtre de doublon (une heure) empêche deux envois par impatience de
 *     produire deux lignes à relire.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { deposerUnService } from "@/lib/services/depot";
import type { Saisie } from "@/lib/services/validation";

let n = 0;

async function personne() {
  n += 1;
  return db.user.create({
    data: {
      email: `s-${n}@baobart.test`,
      profile: { create: { username: `s-${n}`, displayName: `Awa ${n}` } },
    },
    select: { id: true },
  });
}

async function categorie(input?: { active?: boolean }) {
  n += 1;
  return db.serviceCategory.create({
    data: {
      slug: `cat-${n}`,
      name: `Catégorie ${n}`,
      position: n,
      isActive: input?.active ?? true,
    },
    select: { id: true },
  });
}

function saisie(over: Partial<Saisie> = {}): Saisie {
  return {
    titre: "Charte graphique complète en 10 jours",
    description:
      "Livraison en dix jours ouvrés. Comprend l'atelier de cadrage, trois pistes, deux allers-retours et un manuel d'usage PDF.",
    categoryId: "sera écrasé",
    startingPrice: "180000",
    deliveryDays: "10",
    ...over,
  };
}

beforeEach(() => {
  n = 0;
});

describe("déposer un service", () => {
  it("naît SOUMIS et se rattache correctement", async () => {
    const cat = await categorie();
    const p = await personne();

    const suite = await deposerUnService({
      creatorId: p.id,
      saisie: saisie({ categoryId: cat.id }),
    });

    expect(suite.ok).toBe(true);

    const ligne = await db.serviceOffer.findFirstOrThrow({
      where: { creatorId: p.id },
      select: {
        state: true,
        title: true,
        categoryId: true,
        startingPrice: true,
        deliveryDays: true,
      },
    });

    expect(ligne.state).toBe("SOUMIS");
    expect(ligne.categoryId).toBe(cat.id);
    expect(ligne.startingPrice).toBe(180_000);
    expect(ligne.deliveryDays).toBe(10);
  });

  it("refait la validation et renvoie le refus tel quel", async () => {
    const cat = await categorie();
    const p = await personne();

    const suite = await deposerUnService({
      creatorId: p.id,
      saisie: saisie({ categoryId: cat.id, startingPrice: "500" }),
    });

    expect(suite.ok).toBe(false);
    if (suite.ok) return;
    expect(suite.motif).toBe("REFUS");
    expect(await db.serviceOffer.count()).toBe(0);
  });

  it("refuse une catégorie cachée", async () => {
    // La catégorie a été retirée par l'administration : un formulaire ouvert
    // depuis plusieurs jours pourrait encore la référencer.
    const cat = await categorie({ active: false });
    const p = await personne();

    const suite = await deposerUnService({
      creatorId: p.id,
      saisie: saisie({ categoryId: cat.id }),
    });

    expect(suite).toEqual({ ok: false, motif: "CATEGORIE_INTROUVABLE" });
    expect(await db.serviceOffer.count()).toBe(0);
  });

  it("refuse une catégorie inexistante", async () => {
    const p = await personne();
    const suite = await deposerUnService({
      creatorId: p.id,
      saisie: saisie({ categoryId: "cat_inexistante" }),
    });
    expect(suite).toEqual({ ok: false, motif: "CATEGORIE_INTROUVABLE" });
  });

  it("bloque un deuxième envoi au même titre dans l'heure", async () => {
    const cat = await categorie();
    const p = await personne();

    await deposerUnService({ creatorId: p.id, saisie: saisie({ categoryId: cat.id }) });
    const second = await deposerUnService({
      creatorId: p.id,
      saisie: saisie({ categoryId: cat.id }),
    });

    expect(second).toEqual({ ok: false, motif: "DOUBLON" });
    expect(await db.serviceOffer.count()).toBe(1);
  });

  it("laisse passer un titre différent, du même créateur", async () => {
    const cat = await categorie();
    const p = await personne();

    await deposerUnService({
      creatorId: p.id,
      saisie: saisie({ categoryId: cat.id, titre: "Refonte logo simple" }),
    });
    const second = await deposerUnService({
      creatorId: p.id,
      saisie: saisie({ categoryId: cat.id, titre: "Refonte logo complet" }),
    });

    expect(second.ok).toBe(true);
    expect(await db.serviceOffer.count()).toBe(2);
  });

  it("laisse passer le même titre d'un autre créateur", async () => {
    // Le doublon protège UN compte, pas la catégorie.
    const cat = await categorie();
    const un = await personne();
    const deux = await personne();

    await deposerUnService({ creatorId: un.id, saisie: saisie({ categoryId: cat.id }) });
    const second = await deposerUnService({
      creatorId: deux.id,
      saisie: saisie({ categoryId: cat.id }),
    });

    expect(second.ok).toBe(true);
  });
});
