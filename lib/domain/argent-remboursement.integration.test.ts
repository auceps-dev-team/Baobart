/**
 * Où va l'argent, vente puis remboursement.
 *
 * Ces tests ne vérifient pas qu'un calcul est juste — `fees.test.ts` s'en
 * charge. Ils **fixent le trajet des fonds**, y compris la part que personne
 * n'inscrit nulle part, pour qu'un changement de politique commerciale soit un
 * choix visible et non un effet de bord.
 *
 * Politique arrêtée en août 2026, après confrontation à Gumroad : la commission
 * reste acquise à la plateforme, et les frais d'opérateur restent à la charge du
 * vendeur. C'est donc le vendeur qui finance le remboursement en entier.
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

  it("débite le vendeur du brut, pas de son net", async () => {
    // Décision commerciale d'août 2026 : la commission n'est pas rendue, et
    // les frais d'opérateur — que la passerelle ne restitue jamais — restent
    // à la charge du vendeur. C'est donc lui qui finance le remboursement.
    const { ligneId } = await venteDe(PRIX);
    const { aCharge } = await rembourserLigne({
      orderItemId: ligneId,
      amount: PRIX,
    });

    expect(aCharge).toBe(PRIX);
  });

  it("laisse le vendeur en déficit de ce qu'il n'avait jamais reçu", async () => {
    // Il avait touché 4 425 et rend 5 000 : son solde descend à −575. Aucune
    // contrainte ne l'interdit, et le versement suivant absorbera le déficit.
    const { vendeurId, ligneId } = await venteDe(PRIX);
    await rembourserLigne({ orderItemId: ligneId, amount: PRIX });

    expect(await soldeInscrit(vendeurId)).toBe(frais.sellerNet - PRIX);
    expect(await soldeInscrit(vendeurId)).toBe(-575);
  });

  it("note la commission gardée par la plateforme", async () => {
    // Faute de compte plateforme au grand livre, cette somme n'existe nulle
    // part ailleurs. La consigner permet un jour de répondre à « combien
    // avons-nous conservé sur les remboursements ».
    const { ligneId } = await venteDe(PRIX);
    const { retenu, remboursement } = await rembourserLigne({
      orderItemId: ligneId,
      amount: PRIX,
    });

    expect(retenu).toBe(frais.platformFee);
    expect(remboursement.retainedFee).toBe(frais.platformFee);
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
  it("débite au total exactement le brut remboursé", async () => {
    const { vendeurId, ligneId } = await venteDe(100);
    const frais = computeFees({ unitPrice: 100, quantity: 1, regime: "DIRECT" });

    let debite = 0;
    for (let i = 0; i < 100; i += 1) {
      const r = await rembourserLigne({ orderItemId: ligneId, amount: 1 });
      debite += r.aCharge;
    }

    expect(debite).toBe(100);
    expect(await soldeInscrit(vendeurId)).toBe(frais.sellerNet - 100);
  });

  it("additionne la commission retenue sans dériver d'un franc", async () => {
    // Cent remboursements d'un franc : arrondir chacun isolément ferait
    // conserver à la plateforme plus, ou moins, que sa commission entière.
    const { ligneId } = await venteDe(100);
    const frais = computeFees({ unitPrice: 100, quantity: 1, regime: "DIRECT" });

    let retenuCumule = 0;
    for (let i = 0; i < 100; i += 1) {
      const r = await rembourserLigne({ orderItemId: ligneId, amount: 1 });
      retenuCumule += r.retenu;
    }

    expect(retenuCumule).toBe(frais.platformFee);
  });
});
