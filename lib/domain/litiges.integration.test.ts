/**
 * Les paiements contestés, contre une vraie base.
 *
 * Un litige reprend de l'argent sans que personne ne l'ait décidé. Deux
 * propriétés comptent plus que les autres : le vendeur est débité **une seule
 * fois** même si l'opérateur réémet son événement, et ses versements s'arrêtent
 * — payer quelqu'un dont l'argent vient d'être repris reviendrait à payer deux
 * fois sans jamais pouvoir récupérer.
 */

import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { enregistrerLitige, litigeGagne } from "@/lib/domain/litiges";
import { encaisserLigne } from "@/lib/domain/orders";

let n = 0;

async function venteDe(prix: number, encaisser = true) {
  n += 1;
  const vendeur = await db.user.create({
    data: {
      email: `vendeur-l${n}@baobart.test`,
      profile: { create: { username: `vendeur-l${n}`, displayName: `V${n}` } },
    },
    select: { id: true },
  });
  const acheteur = await db.user.create({
    data: {
      email: `acheteur-l${n}@baobart.test`,
      profile: { create: { username: `acheteur-l${n}`, displayName: `A${n}` } },
    },
    select: { id: true },
  });
  const produit = await db.product.create({
    data: {
      sellerId: vendeur.id,
      name: `Ressource l${n}`,
      slug: `ressource-l${n}`,
      price: prix,
      currency: "XOF",
      status: "PUBLISHED",
    },
    select: { id: true },
  });
  const commande = await db.order.create({
    data: {
      buyerId: acheteur.id,
      total: prix,
      currency: "XOF",
      items: { create: { productId: produit.id, quantity: 1, price: prix } },
    },
    select: { items: { select: { id: true } } },
  });

  const ligneId = commande.items[0]!.id;
  if (encaisser) await encaisserLigne({ orderItemId: ligneId, regime: "DIRECT" });

  return { vendeurId: vendeur.id, ligneId };
}

async function soldeInscrit(userId: string) {
  const lignes = await db.balanceTransaction.findMany({
    where: { userId },
    select: { holdingNet: true },
  });
  return lignes.reduce((s, l) => s + l.holdingNet, 0);
}

describe("enregistrer un litige", () => {
  it("inscrit la contestation sur la ligne", async () => {
    const { ligneId } = await venteDe(5_000);
    const r = await enregistrerLitige({ orderItemId: ligneId });

    expect(r).toEqual({ enregistre: true, debite: 5_000 });

    const ligne = await db.orderItem.findUniqueOrThrow({ where: { id: ligneId } });
    expect(ligne.chargebackAt).not.toBeNull();
    expect(ligne.chargebackReversedAt).toBeNull();
  });

  it("débite le vendeur du brut : la banque a tout repris", async () => {
    const { vendeurId, ligneId } = await venteDe(5_000);
    const avant = await soldeInscrit(vendeurId);

    await enregistrerLitige({ orderItemId: ligneId });

    expect(await soldeInscrit(vendeurId)).toBe(avant - 5_000);
  });

  it("suspend les versements du vendeur", async () => {
    // Payer un créateur dont l'argent vient d'être repris reviendrait à payer
    // deux fois, sans jamais pouvoir récupérer.
    const { vendeurId, ligneId } = await venteDe(5_000);
    await enregistrerLitige({ orderItemId: ligneId });

    const vendeur = await db.user.findUniqueOrThrow({ where: { id: vendeurId } });
    expect(vendeur.payoutsPausedAt).not.toBeNull();
    expect(vendeur.payoutsPausedReason).toContain("contest");
  });

  it("écrit un mouvement de type CHARGEBACK, distinct d'un remboursement", async () => {
    const { vendeurId, ligneId } = await venteDe(5_000);
    await enregistrerLitige({ orderItemId: ligneId });

    const mouvements = await db.balanceTransaction.findMany({
      where: { userId: vendeurId, type: "CHARGEBACK" },
    });
    expect(mouvements).toHaveLength(1);
    expect(mouvements[0]?.holdingNet).toBe(-5_000);
  });

  describe("idempotence", () => {
    it("refuse un second enregistrement du même litige", async () => {
      // Un opérateur qui n'a pas vu notre accusé de réception réémet, parfois
      // des jours plus tard.
      const { ligneId } = await venteDe(5_000);
      await enregistrerLitige({ orderItemId: ligneId });

      const second = await enregistrerLitige({ orderItemId: ligneId });
      expect(second).toEqual({ enregistre: false, motif: "DEJA_ENREGISTRE" });
    });

    it("ne débite jamais deux fois, même sur deux événements simultanés", async () => {
      const { vendeurId, ligneId } = await venteDe(5_000);
      const avant = await soldeInscrit(vendeurId);

      const [a, b] = await Promise.all([
        enregistrerLitige({ orderItemId: ligneId }),
        enregistrerLitige({ orderItemId: ligneId }),
      ]);

      expect([a, b].filter((r) => r.enregistre)).toHaveLength(1);
      expect(await soldeInscrit(vendeurId)).toBe(avant - 5_000);
    });
  });

  describe("refus", () => {
    it("refuse une ligne inconnue", async () => {
      const r = await enregistrerLitige({ orderItemId: "inexistante" });
      expect(r).toEqual({ enregistre: false, motif: "LIGNE_INTROUVABLE" });
    });

    it("refuse une ligne jamais encaissée", async () => {
      // Il n'y a pas d'argent à reprendre.
      const { ligneId } = await venteDe(5_000, false);
      const r = await enregistrerLitige({ orderItemId: ligneId });
      expect(r).toEqual({ enregistre: false, motif: "NON_ENCAISSEE" });
    });
  });
});

describe("litige tranché en faveur du vendeur", () => {
  it("rend l'argent et ramène le solde à son niveau d'avant", async () => {
    const { vendeurId, ligneId } = await venteDe(5_000);
    const apresVente = await soldeInscrit(vendeurId);

    await enregistrerLitige({ orderItemId: ligneId });
    const r = await litigeGagne({ orderItemId: ligneId });

    expect(r).toEqual({ rendu: true, credite: 5_000 });
    expect(await soldeInscrit(vendeurId)).toBe(apresVente);
  });

  it("marque la contestation comme tranchée", async () => {
    const { ligneId } = await venteDe(5_000);
    await enregistrerLitige({ orderItemId: ligneId });
    await litigeGagne({ orderItemId: ligneId });

    const ligne = await db.orderItem.findUniqueOrThrow({ where: { id: ligneId } });
    expect(ligne.chargebackReversedAt).not.toBeNull();
  });

  it("ne reprend pas les versements tout seul", async () => {
    // Un litige gagné ne dit rien du suivant : lever une suspension mérite un
    // regard humain, comme la machine à états du risque l'exige déjà.
    const { vendeurId, ligneId } = await venteDe(5_000);
    await enregistrerLitige({ orderItemId: ligneId });
    await litigeGagne({ orderItemId: ligneId });

    const vendeur = await db.user.findUniqueOrThrow({ where: { id: vendeurId } });
    expect(vendeur.payoutsPausedAt).not.toBeNull();
  });

  it("refuse de trancher deux fois", async () => {
    const { vendeurId, ligneId } = await venteDe(5_000);
    const apresVente = await soldeInscrit(vendeurId);

    await enregistrerLitige({ orderItemId: ligneId });
    await litigeGagne({ orderItemId: ligneId });
    const second = await litigeGagne({ orderItemId: ligneId });

    expect(second).toEqual({ rendu: false, motif: "DEJA_TRANCHE" });
    expect(await soldeInscrit(vendeurId)).toBe(apresVente);
  });

  it("refuse de trancher ce qui n'a jamais été contesté", async () => {
    const { ligneId } = await venteDe(5_000);
    const r = await litigeGagne({ orderItemId: ligneId });
    expect(r).toEqual({ rendu: false, motif: "PAS_DE_LITIGE" });
  });
});

describe("effet sur l'accès de l'acheteur", () => {
  it("un litige ouvert coupe l'accès, un litige gagné le rend", async () => {
    // La livraison lit ces deux colonnes depuis toujours ; c'est le chemin
    // d'écriture qui manquait.
    const { ligneId } = await venteDe(5_000);

    await enregistrerLitige({ orderItemId: ligneId });
    const pendant = await db.orderItem.findUniqueOrThrow({ where: { id: ligneId } });
    expect(pendant.chargebackAt !== null && pendant.chargebackReversedAt === null).toBe(
      true,
    );

    await litigeGagne({ orderItemId: ligneId });
    const apres = await db.orderItem.findUniqueOrThrow({ where: { id: ligneId } });
    expect(apres.chargebackAt !== null && apres.chargebackReversedAt === null).toBe(
      false,
    );
  });
});
