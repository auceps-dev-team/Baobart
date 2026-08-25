/**
 * Où va l'argent, vente puis remboursement.
 *
 * Ces tests ne vérifient pas qu'un calcul est juste — `fees.test.ts` s'en
 * charge. Ils **fixent le trajet des fonds**, y compris la part que personne
 * n'inscrit nulle part, pour qu'un changement de politique commerciale soit un
 * choix visible et non un effet de bord.
 *
 * Éprouvé au regard de Gumroad (`app/models/refund.rb`), qui garde de son côté
 * une notion de commission retenue au remboursement — chose que notre modèle
 * ne sait pas exprimer aujourd'hui.
 */

import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { computeFees } from "@/lib/domain/fees";
import { encaisserLigne, rembourserLigne } from "@/lib/domain/orders";

let n = 0;

async function venteDe(prix: number) {
  n += 1;
  const vendeur = await db.user.create({
    data: {
      email: `vendeur-r${n}@baobart.test`,
      profile: { create: { username: `vendeur-r${n}`, displayName: `V${n}` } },
    },
    select: { id: true },
  });
  const acheteur = await db.user.create({
    data: {
      email: `acheteur-r${n}@baobart.test`,
      profile: { create: { username: `acheteur-r${n}`, displayName: `A${n}` } },
    },
    select: { id: true },
  });
  const produit = await db.product.create({
    data: {
      sellerId: vendeur.id,
      name: `Ressource r${n}`,
      slug: `ressource-r${n}`,
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
    select: { id: true, items: { select: { id: true } } },
  });

  const ligneId = commande.items[0]!.id;
  await encaisserLigne({ orderItemId: ligneId, regime: "DIRECT" });

  return { vendeurId: vendeur.id, ligneId };
}

/** Somme algébrique de ce que le grand livre attribue à quelqu'un. */
async function soldeInscrit(userId: string) {
  const lignes = await db.balanceTransaction.findMany({
    where: { userId },
    select: { holdingNet: true },
  });
  return lignes.reduce((s, l) => s + l.holdingNet, 0);
}

describe("trajet des fonds sur une vente à 5 000", () => {
  const PRIX = 5_000;
  const frais = computeFees({ unitPrice: PRIX, quantity: 1, regime: "DIRECT" });

  it("crédite le créateur du net, et de lui seul", async () => {
    const { vendeurId } = await venteDe(PRIX);
    expect(await soldeInscrit(vendeurId)).toBe(frais.sellerNet);
  });

  it("n'inscrit la part de la plateforme nulle part", async () => {
    // Constat, pas reproche : le grand livre est tenu par utilisateur, et la
    // plateforme n'est pas un utilisateur. Ce qu'elle prélève — commission et
    // frais d'opérateur — n'existe que comme différence entre ce que l'acheteur
    // a payé et ce que le créateur a reçu.
    const { ligneId } = await venteDe(PRIX);

    const ligne = await db.orderItem.findUniqueOrThrow({ where: { id: ligneId } });
    const prelevé = ligne.platformFee + ligne.processorFee;
    expect(prelevé).toBe(PRIX - frais.sellerNet);

    // Aucune écriture ne porte cette somme.
    const total = await db.balanceTransaction.aggregate({
      _sum: { holdingNet: true },
    });
    expect(total._sum.holdingNet).toBe(frais.sellerNet);
  });
});

describe("remboursement intégral", () => {
  const PRIX = 5_000;
  const frais = computeFees({ unitPrice: PRIX, quantity: 1, regime: "DIRECT" });

  it("ramène le créateur à zéro : il rend ce qu'il avait touché", async () => {
    const { vendeurId, ligneId } = await venteDe(PRIX);
    await rembourserLigne({ orderItemId: ligneId, amount: PRIX });

    expect(await soldeInscrit(vendeurId)).toBe(0);
  });

  it("laisse la plateforme supporter seule commission et frais d'opérateur", async () => {
    // L'acheteur récupère 5 000. Le créateur en rend 4 425. Les 575 restants
    // sortent donc de la plateforme — dont 75 de frais d'opérateur que le
    // prestataire de paiement, lui, ne rend pas.
    //
    // Rien dans le code ne dit que c'est voulu : c'est ce qui arrive faute de
    // compte plateforme. Ce test le fixe pour que la question se pose.
    const { ligneId } = await venteDe(PRIX);
    const { partNette } = await rembourserLigne({
      orderItemId: ligneId,
      amount: PRIX,
    });

    const rendüParLaPlateforme = PRIX - partNette;
    expect(partNette).toBe(frais.sellerNet);
    expect(rendüParLaPlateforme).toBe(frais.platformFee + frais.processorFee);
    expect(rendüParLaPlateforme).toBe(575);
  });

  it("interdit de rembourser au-delà de ce qui a été encaissé", async () => {
    const { ligneId } = await venteDe(PRIX);
    await rembourserLigne({ orderItemId: ligneId, amount: PRIX });

    await expect(
      rembourserLigne({ orderItemId: ligneId, amount: 1 }),
    ).rejects.toThrow(RangeError);
  });
});

describe("remboursements partiels empilés", () => {
  it("ne fait pas payer au créateur la monnaie de la division", async () => {
    // Cent remboursements d'un franc sur une vente de cent : arrondir chacun
    // isolément ferait rendre au créateur plus qu'il n'a reçu.
    const { vendeurId, ligneId } = await venteDe(100);

    for (let i = 0; i < 100; i += 1) {
      await rembourserLigne({ orderItemId: ligneId, amount: 1 });
    }

    expect(await soldeInscrit(vendeurId)).toBe(0);
  });
});
