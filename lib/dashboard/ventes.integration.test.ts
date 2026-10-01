import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { lireVentesCreateur } from "@/lib/dashboard/lectures";

/**
 * Les ventes du créateur, confrontées à la base.
 *
 * Mesuré le 25/09 (Qualitytest niveau 4, S15) : deux paiements abandonnés et
 * deux en cours s'affichaient « PAYÉ · ENCAISSEE · Paiement encaissé, accès
 * actif », avec « Rembourser… ». La liste ne filtrait aucun état, et
 * `etatDeLaVente` ne lit pas celui qu'on lui passe.
 */

let vendeur: string;
let acheteur: string;
let produitId: string;

async function compte(email: string): Promise<string> {
  const u = await db.user.create({ data: { email, defaultCurrency: "XOF" }, select: { id: true } });
  return u.id;
}

async function ligne(etat: "SUCCESSFUL" | "NOT_CHARGED" | "IN_PROGRESS" | "FAILED", prix: number) {
  await db.order.create({
    data: {
      buyerId: acheteur,
      currency: "XOF",
      total: prix,
      status: etat === "SUCCESSFUL" || etat === "NOT_CHARGED" ? "COMPLETED" : etat === "FAILED" ? "ABANDONED" : "IN_PROGRESS",
      items: { create: { productId: produitId, price: prix, quantity: 1, state: etat } },
    },
  });
}

beforeEach(async () => {
  vendeur = await compte("awa@ventes.test");
  acheteur = await compte("kofi@ventes.test");
  const p = await db.product.create({
    data: { sellerId: vendeur, slug: `v-${Math.random().toString(36).slice(2, 9)}`, name: "Affiche", price: 9_000, currency: "XOF", status: "PUBLISHED" },
    select: { id: true },
  });
  produitId = p.id;
});

describe("lireVentesCreateur", () => {
  it("ne présente comme ventes que les lignes qui ont abouti", async () => {
    await ligne("SUCCESSFUL", 9_000);
    await ligne("NOT_CHARGED", 0);
    await ligne("FAILED", 8_000);
    await ligne("IN_PROGRESS", 50_005);

    const ventes = await lireVentesCreateur(vendeur, 60);

    expect(ventes.map((v) => v.state).sort()).toEqual(["NOT_CHARGED", "SUCCESSFUL"]);
  });

  it("rend toutes les lignes à l'écran des commandes, qui dit chaque état", async () => {
    await ligne("SUCCESSFUL", 9_000);
    await ligne("FAILED", 8_000);
    await ligne("IN_PROGRESS", 2_500);

    const lignes = await lireVentesCreateur(vendeur, 20, { toutes: true });

    expect(lignes).toHaveLength(3);
  });
});
