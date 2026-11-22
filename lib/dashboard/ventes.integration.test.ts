import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { lireVentesCreateur, lireVentesPourLEcran } from "@/lib/dashboard/lectures";

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

/**
 * La recherche de l'écran « Ventes » (décidé le 21/11/2026 : « ajouter les
 * filtres »). Mesuré ce jour-là : le champ n'avait ni nom ni formulaire — il
 * ne filtrait rien — et l'écran ne lisait que les soixante dernières ventes :
 * une plus ancienne n'apparaissait nulle part, sans que rien le dise.
 */
describe("lireVentesPourLEcran — la recherche et le plafond", () => {
  async function vendre(nomProduit: string, nomAcheteur: string, quand: Date) {
    const s = Math.random().toString(36).slice(2, 9);
    const p = await db.product.create({
      data: { sellerId: vendeur, slug: `r-${s}`, name: nomProduit, price: 5_000, currency: "XOF", status: "PUBLISHED" },
      select: { id: true },
    });
    const a = await db.user.create({
      data: { email: `${s}@acheteurs.test`, profile: { create: { username: `a-${s}`, displayName: nomAcheteur } } },
      select: { id: true },
    });
    const o = await db.order.create({
      data: {
        buyerId: a.id,
        currency: "XOF",
        total: 5_000,
        status: "COMPLETED",
        createdAt: quand,
        items: { create: { productId: p.id, price: 5_000, quantity: 1, state: "SUCCESSFUL", createdAt: quand } },
      },
      select: { items: { select: { id: true } } },
    });
    return o.items[0]!.id;
  }

  it("trouve par ressource, par acheteur — nom ou adresse — et par référence, sans tenir compte de la casse", async () => {
    const kente = await vendre("Pack Kente", "Awa Diallo", new Date());
    await vendre("Police Adinkra", "Serge Koné", new Date());
    await vendre("Affiche Wax", "Yao Mensah", new Date());

    const ids = async (q: string) => (await lireVentesPourLEcran(vendeur, { q })).ventes.map((v) => v.id);

    expect(await ids("kente")).toEqual([kente]);
    expect(await ids("AWA")).toEqual([kente]);
    // La référence affichée : les huit derniers caractères, en majuscules.
    expect(await ids(kente.slice(-8).toUpperCase())).toEqual([kente]);
    expect(await ids("")).toHaveLength(3);
    expect(await ids("introuvable")).toEqual([]);
  });

  it("ne cherche que chez ce vendeur", async () => {
    await vendre("Pack Kente", "Awa Diallo", new Date());
    const autre = await compte("autre@ventes.test");
    const p = await db.product.create({
      data: { sellerId: autre, slug: `x-${Math.random().toString(36).slice(2, 9)}`, name: "Pack Kente bis", price: 5_000, currency: "XOF", status: "PUBLISHED" },
      select: { id: true },
    });
    await db.order.create({
      data: { buyerId: acheteur, currency: "XOF", total: 5_000, status: "COMPLETED", items: { create: { productId: p.id, price: 5_000, quantity: 1, state: "SUCCESSFUL" } } },
    });

    expect((await lireVentesPourLEcran(vendeur, { q: "kente" })).ventes).toHaveLength(1);
  });

  it("trouve une vente plus ancienne que les soixante dernières", async () => {
    const ancienne = await vendre("Pack Kente", "Awa Diallo", new Date(Date.now() - 90 * 86_400_000));
    for (let k = 0; k < 60; k++) await vendre(`Affiche ${k}`, `Acheteur ${k}`, new Date(Date.now() - k * 60_000));

    const tout = await lireVentesPourLEcran(vendeur);
    expect(tout.ventes).toHaveLength(61);
    expect(tout.tronquee).toBe(false);
    expect((await lireVentesPourLEcran(vendeur, { q: "awa" })).ventes.map((v) => v.id)).toEqual([ancienne]);
  });

  it("dit quand il s'arrête : au-delà du plafond, la liste se sait tronquée", async () => {
    // Pas cinq cents ventes ici : le plafond est un paramètre, la règle est la même.
    for (let k = 0; k < 4; k++) await vendre(`Affiche ${k}`, `Acheteur ${k}`, new Date(Date.now() - k * 60_000));

    const r = await lireVentesPourLEcran(vendeur, { plafond: 3 });
    expect(r.ventes).toHaveLength(3);
    expect(r.tronquee).toBe(true);
  });

  it("tronque une recherche démesurée plutôt que de l'envoyer telle quelle", async () => {
    await vendre("Pack Kente", "Awa Diallo", new Date());
    const r = await lireVentesPourLEcran(vendeur, { q: `  kente${" ".repeat(200)}x` });
    expect(r.q.length).toBeLessThanOrEqual(80);
  });
});
