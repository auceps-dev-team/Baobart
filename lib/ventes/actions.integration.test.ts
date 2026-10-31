/**
 * Le geste « Rembourser » du vendeur, depuis le formulaire jusqu'au grand livre.
 *
 * Mesuré le 31/10/2026 (`Doc/ETAT_DU_PROJET_2026-10.md`, Q2-1) : le montant
 * saisi passait par `.replace(/[^d]/g, "")` — l'antislash de `\d` perdu en
 * v1.79.0. Tous les chiffres étaient effacés, le champ arrivait vide, et
 * `rembourserUneVente` rendait tout le restant. Le vendeur qui voulait rendre
 * 1 000 F sur 5 000 en rendait 5 000, et l'écran disait « enregistré ».
 *
 * `lib/ventes/remboursement.integration.test.ts` éprouvait déjà le chemin de
 * l'argent, mais en lui passant un nombre : la lecture du formulaire n'était
 * éprouvée nulle part. On passe donc ici par l'action elle-même, avec un
 * vrai `FormData`. Vente simulée (sans opérateur) : rien ne part à l'extérieur.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { encaisserLigne } from "@/lib/domain/orders";

let sessionCouranteValeur: { id: string } | null = null;

vi.mock("@/lib/auth/session", () => ({
  sessionCourante: async () => sessionCouranteValeur,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { agirSurLaVente } from "@/lib/ventes/actions";

let n = 0;

async function venteDe(prix: number) {
  n += 1;
  const marque = `remb-form-${n}-${Math.random().toString(36).slice(2, 7)}`;
  const vendeur = await db.user.create({
    data: { email: `vendeur-${marque}@baobart.test`, profile: { create: { username: `v-${marque}`, displayName: "V" } } },
    select: { id: true },
  });
  const acheteur = await db.user.create({
    data: { email: `acheteur-${marque}@baobart.test`, profile: { create: { username: `a-${marque}`, displayName: "A" } } },
    select: { id: true },
  });
  const produit = await db.product.create({
    data: { sellerId: vendeur.id, name: `R ${marque}`, slug: `r-${marque}`, price: prix, currency: "XOF", status: "PUBLISHED" },
    select: { id: true },
  });
  const commande = await db.order.create({
    data: { buyerId: acheteur.id, total: prix, currency: "XOF", items: { create: { productId: produit.id, quantity: 1, price: prix } } },
    select: { items: { select: { id: true } } },
  });
  const ligneId = commande.items[0]!.id;
  await encaisserLigne({ orderItemId: ligneId });
  return { vendeurId: vendeur.id, acheteurId: acheteur.id, ligneId };
}

function formulaire(montant: string) {
  const donnees = new FormData();
  donnees.set("montant", montant);
  return donnees;
}

const rembourse = async (ligneId: string) =>
  (await db.orderItem.findUniqueOrThrow({ where: { id: ligneId }, select: { refundedAmount: true } })).refundedAmount;

beforeEach(() => {
  sessionCouranteValeur = null;
});

describe("le vendeur rembourse une partie de la vente", () => {
  it("rend le montant saisi, pas tout le restant", async () => {
    const { vendeurId, ligneId } = await venteDe(5_000);
    sessionCouranteValeur = { id: vendeurId };

    const r = await agirSurLaVente(ligneId, "rembourser", null, formulaire("1000"));

    expect(r.ok).toBe(true);
    expect(await rembourse(ligneId)).toBe(1_000);
  });

  it("lit un montant saisi avec une espace entre les milliers", async () => {
    const { vendeurId, ligneId } = await venteDe(5_000);
    sessionCouranteValeur = { id: vendeurId };

    expect((await agirSurLaVente(ligneId, "rembourser", null, formulaire("2 500"))).ok).toBe(true);
    expect(await rembourse(ligneId)).toBe(2_500);
  });

  it("refuse une décimale plutôt que de la lire dix fois plus grande", async () => {
    // Retirer tout ce qui n'est pas un chiffre — l'intention de 2026-09 —
    // aurait lu « 1000.5 » comme 10 005.
    const { vendeurId, ligneId } = await venteDe(20_000);
    sessionCouranteValeur = { id: vendeurId };

    const r = await agirSurLaVente(ligneId, "rembourser", null, formulaire("1000.5"));

    expect(r.ok).toBe(false);
    expect(await rembourse(ligneId)).toBe(0);
  });

  it("refuse un champ vide : vide ne veut pas dire « tout »", async () => {
    const { vendeurId, ligneId } = await venteDe(5_000);
    sessionCouranteValeur = { id: vendeurId };

    const r = await agirSurLaVente(ligneId, "rembourser", null, formulaire(""));

    expect(r.ok).toBe(false);
    expect(await rembourse(ligneId)).toBe(0);
  });

  it("rend tout quand le vendeur saisit tout le restant", async () => {
    const { vendeurId, ligneId } = await venteDe(5_000);
    sessionCouranteValeur = { id: vendeurId };

    expect((await agirSurLaVente(ligneId, "rembourser", null, formulaire("5000"))).ok).toBe(true);
    expect(await rembourse(ligneId)).toBe(5_000);
  });

  it("ne laisse pas rembourser la vente d'un autre", async () => {
    const { acheteurId, ligneId } = await venteDe(5_000);
    sessionCouranteValeur = { id: acheteurId };

    const r = await agirSurLaVente(ligneId, "rembourser", null, formulaire("1000"));

    expect(r).toEqual({ ok: false, message: "Vente introuvable." });
    expect(await rembourse(ligneId)).toBe(0);
  });
});
