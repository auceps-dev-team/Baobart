/**
 * Le passage quotidien des créateurs du mois, contre une vraie base.
 *
 * Ce qu'on éprouve, d'après les réponses du 08/11 :
 *   - le titre se pose, s'annonce, et se lit sur la vitrine ;
 *   - rejoué le même jour, le passage prolonge sans réannoncer ;
 *   - un compte suspendu n'est jamais nommé ;
 *   - un titre éteint se rallume et s'annonce de nouveau ;
 *   - un créateur sorti de la tête garde son titre jusqu'à sa date, sans un
 *     mot — la perte ne s'annonce pas.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { designerLesCreateursDuMois } from "@/lib/badges/createur-du-mois";
import { mesuresDe } from "@/lib/badges/mesures";
import { meritesObtenus } from "@/lib/badges/merites";
import { db } from "@/lib/db";

let n = 0;
const JOUR = 86_400_000;
const MAINTENANT = new Date("2026-11-08T02:30:00Z");

let appUrl: string | undefined;
beforeEach(() => {
  appUrl = process.env.APP_URL;
  process.env.APP_URL = "https://baobart.test";
});
afterEach(() => {
  process.env.APP_URL = appUrl;
});

async function compte(prefixe: string, donnees: { suspendedAt?: Date } = {}) {
  n += 1;
  const marque = `${prefixe}-${n}-${Math.random().toString(36).slice(2, 7)}`;
  return db.user.create({
    data: { email: `${marque}@baobart.test`, ...donnees, profile: { create: { username: marque, displayName: `Nom ${n}` } } },
    select: { id: true },
  });
}

/** Un créateur et `combien` acheteurs différents, chacun une vente aboutie récente. */
async function createurQuiVend(combien: number, donnees: { suspendedAt?: Date } = {}) {
  const createur = await compte("cm-v", donnees);
  n += 1;
  const p = await db.product.create({
    data: { sellerId: createur.id, name: `R ${n}`, slug: `r-cm-${n}-${Math.random().toString(36).slice(2, 6)}`, price: 1_000, currency: "XOF", status: "PUBLISHED" },
    select: { id: true },
  });
  for (let i = 0; i < combien; i += 1) {
    const acheteur = await compte("cm-a");
    await db.order.create({
      data: {
        buyerId: acheteur.id,
        total: 1_000,
        currency: "XOF",
        items: { create: { productId: p.id, quantity: 1, price: 1_000, state: "SUCCESSFUL", createdAt: new Date(MAINTENANT.getTime() - 3 * JOUR) } },
      },
    });
  }
  return createur;
}

const titreDe = async (userId: string) =>
  db.userBadge.findFirst({ where: { userId, badge: { code: "TOP_CREATOR" } }, select: { awardedAt: true, validUntil: true } });
const avisDe = async (userId: string) =>
  db.notification.findMany({ where: { userId, type: "CREATEUR_DU_MOIS" }, select: { cle: true, lien: true } });
const courrielsDe = async () =>
  db.emailOutbox.findMany({ where: { template: "CREATEUR_DU_MOIS" }, select: { idempotencyKey: true } });

describe("désigner les créateurs du mois", () => {
  it("nomme la tête, l'annonce par la cloche et par courriel, et la vitrine le lit", async () => {
    const tete = await createurQuiVend(20);
    await createurQuiVend(1);

    expect(await designerLesCreateursDuMois(MAINTENANT)).toEqual({ nommes: 1, prolonges: 0 });

    const titre = await titreDe(tete.id);
    expect(titre!.validUntil).toEqual(new Date(MAINTENANT.getTime() + 30 * JOUR));
    expect(await avisDe(tete.id)).toEqual([{ cle: expect.stringContaining("createur-du-mois-"), lien: "/dashboard/badges" }]);
    expect(await courrielsDe()).toHaveLength(1);

    const m = await mesuresDe(tete.id, MAINTENANT);
    expect(meritesObtenus(m!).map((x) => x.code)).toContain("TOP_CREATOR");
  });

  it("ne nomme personne sous le plancher de vingt acheteurs", async () => {
    await createurQuiVend(19);
    expect(await designerLesCreateursDuMois(MAINTENANT)).toEqual({ nommes: 0, prolonges: 0 });
  });

  it("rejoué le même jour, prolonge sans annoncer une seconde fois", async () => {
    const tete = await createurQuiVend(20);
    await designerLesCreateursDuMois(MAINTENANT);

    const plusTard = new Date(MAINTENANT.getTime() + 3_600_000);
    expect(await designerLesCreateursDuMois(plusTard)).toEqual({ nommes: 0, prolonges: 1 });
    expect(await avisDe(tete.id)).toHaveLength(1);
    expect(await courrielsDe()).toHaveLength(1);
    expect((await titreDe(tete.id))!.validUntil).toEqual(new Date(plusTard.getTime() + 30 * JOUR));
  });

  it("ne nomme jamais un compte suspendu", async () => {
    const suspendu = await createurQuiVend(25, { suspendedAt: new Date("2026-11-01T00:00:00Z") });
    expect(await designerLesCreateursDuMois(MAINTENANT)).toEqual({ nommes: 0, prolonges: 0 });
    expect(await titreDe(suspendu.id)).toBeNull();
  });

  it("rallume un titre éteint, et l'annonce de nouveau", async () => {
    const tete = await createurQuiVend(20);
    const badge = await db.badge.create({ data: { code: "TOP_CREATOR", name: "Créateur du mois", description: "" } });
    await db.userBadge.create({ data: { userId: tete.id, badgeId: badge.id, awardedAt: new Date("2026-09-01T00:00:00Z"), validUntil: new Date("2026-10-01T00:00:00Z") } });

    expect(await designerLesCreateursDuMois(MAINTENANT)).toEqual({ nommes: 1, prolonges: 0 });
    expect((await titreDe(tete.id))!.awardedAt).toEqual(MAINTENANT);
    expect(await avisDe(tete.id)).toHaveLength(1);
  });

  it("laisse s'éteindre en silence le titre de qui n'est plus en tête", async () => {
    const sorti = await compte("cm-sorti");
    const badge = await db.badge.create({ data: { code: "TOP_CREATOR", name: "Créateur du mois", description: "" } });
    const fin = new Date(MAINTENANT.getTime() + 5 * JOUR);
    await db.userBadge.create({ data: { userId: sorti.id, badgeId: badge.id, validUntil: fin } });
    await createurQuiVend(20);

    await designerLesCreateursDuMois(MAINTENANT);
    expect((await titreDe(sorti.id))!.validUntil).toEqual(fin);
    expect(await avisDe(sorti.id)).toHaveLength(0);

    // Passé sa date, la vitrine ne l'affiche plus.
    const m = await mesuresDe(sorti.id, new Date(fin.getTime() + 1));
    expect(meritesObtenus(m!).map((x) => x.code)).not.toContain("TOP_CREATOR");
  });
});
