import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  historiqueDesAchats,
  historiqueDesTelechargements,
} from "@/lib/dashboard/queries";

/**
 * Les deux historiques de l'acheteur, confrontés à la base.
 *
 * Ces écrans annoncent de l'argent — « total dépensé », « quota du mois ». Une
 * erreur y ressemble à un vol, pas à un bug d'affichage.
 */

const JOUR = 86_400_000;

let vendeur: string;
let acheteur: string;

async function compte(email: string): Promise<string> {
  const u = await db.user.create({
    data: { email, defaultCurrency: "XOF" },
    select: { id: true },
  });
  return u.id;
}

async function ressource(prix: number, nomFichier: string) {
  const p = await db.product.create({
    data: {
      sellerId: vendeur,
      slug: `h-${Math.random().toString(36).slice(2, 9)}`,
      name: `Ressource ${prix}`,
      price: prix,
      currency: "XOF",
      status: "PUBLISHED",
    },
    select: { id: true },
  });

  const media = await db.mediaAsset.create({
    data: {
      ownerId: vendeur,
      purpose: "product",
      s3Key: `produits/${p.id}/${nomFichier}`,
      checksum: "x",
      sizeBytes: 1024,
      contentType: "application/octet-stream",
      status: "READY",
    },
    select: { id: true },
  });

  const f = await db.productFile.create({
    data: {
      productId: p.id,
      mediaId: media.id,
      filename: nomFichier,
      sizeBytes: 1024,
    },
    select: { id: true },
  });

  return { produitId: p.id, fichierId: f.id };
}

async function commande(input: {
  produitId: string;
  prix: number;
  etat: "SUCCESSFUL" | "IN_PROGRESS" | "FAILED";
  rendu?: number;
  ilYaJours?: number;
}) {
  return db.order.create({
    data: {
      buyerId: acheteur,
      currency: "XOF",
      total: input.prix,
      status: input.etat === "SUCCESSFUL" ? "COMPLETED" : "IN_PROGRESS",
      createdAt: new Date(Date.now() - (input.ilYaJours ?? 1) * JOUR),
      items: {
        create: {
          productId: input.produitId,
          price: input.prix,
          quantity: 1,
          state: input.etat,
          refundedAmount: input.rendu ?? 0,
        },
      },
    },
    select: { id: true },
  });
}

beforeEach(async () => {
  vendeur = await compte("kofi@hist.test");
  acheteur = await compte("ama@hist.test");
});

describe("historique des achats", () => {
  it("ne compte comme dépensé que ce qui a réellement quitté la poche", async () => {
    const { produitId } = await ressource(10_000, "pack.zip");

    await commande({ produitId, prix: 10_000, etat: "SUCCESSFUL" });
    await commande({ produitId, prix: 4_000, etat: "SUCCESSFUL", rendu: 4_000 });
    await commande({ produitId, prix: 6_000, etat: "SUCCESSFUL", rendu: 2_000 });
    // Un panier abandonné n'a rien coûté : l'additionner gonflerait le total.
    await commande({ produitId, prix: 99_000, etat: "IN_PROGRESS" });
    await commande({ produitId, prix: 50_000, etat: "FAILED" });

    const a = await historiqueDesAchats(acheteur, "Toutes");

    // 10 000 + (4 000 − 4 000) + (6 000 − 2 000) = 14 000
    expect(a.bilan.totalDepense).toBe(14_000);
    expect(a.bilan.commandes).toBe(5);
  });

  it("distingue les trois états d'une commande", async () => {
    const { produitId } = await ressource(10_000, "pack.zip");
    await commande({ produitId, prix: 10_000, etat: "SUCCESSFUL", ilYaJours: 3 });
    await commande({ produitId, prix: 8_000, etat: "SUCCESSFUL", rendu: 8_000, ilYaJours: 2 });
    await commande({ produitId, prix: 6_000, etat: "SUCCESSFUL", rendu: 1_000, ilYaJours: 1 });

    const a = await historiqueDesAchats(acheteur, "Toutes");
    const etats = a.commandes.map((c) => c.etat).sort();

    expect(etats).toEqual([
      "PARTIELLEMENT REMBOURSÉE",
      "PAYÉE",
      "REMBOURSÉE",
    ]);
  });

  it("le filtre restreint la liste sans toucher au bilan", async () => {
    // Le défaut corrigé : filtrer sur « Payées » faisait disparaître
    // l'abonnement actif du bandeau du haut.
    const { produitId } = await ressource(10_000, "pack.zip");
    await commande({ produitId, prix: 10_000, etat: "SUCCESSFUL" });
    await commande({ produitId, prix: 5_000, etat: "IN_PROGRESS" });

    const plan = await db.plan.create({
      data: {
        code: "EXPLORER",
        name: "Explorer",
        priceMonthly: 2_500,
        downloadsPerMonth: 20,
      },
      select: { id: true },
    });
    await db.subscription.create({
      data: {
        userId: acheteur,
        planId: plan.id,
        status: "ACTIVE",
        cycleEnd: new Date(Date.now() + 10 * JOUR),
      },
    });

    const toutes = await historiqueDesAchats(acheteur, "Toutes");
    const payees = await historiqueDesAchats(acheteur, "Payées");
    const abo = await historiqueDesAchats(acheteur, "Abonnement");

    expect(toutes.commandes).toHaveLength(2);
    expect(payees.commandes).toHaveLength(1);
    expect(abo.commandes).toHaveLength(0);

    // Le bilan décrit le compte, pas la liste : il ne bouge pas.
    for (const vue of [toutes, payees, abo]) {
      expect(vue.bilan.commandes).toBe(2);
      expect(vue.bilan.totalDepense).toBe(10_000);
      expect(vue.bilan.abonnementActif).toBe(true);
    }
  });

  it("rend les commandes de la plus récente à la plus ancienne", async () => {
    const { produitId } = await ressource(1_000, "a.zip");
    await commande({ produitId, prix: 1_000, etat: "SUCCESSFUL", ilYaJours: 30 });
    await commande({ produitId, prix: 2_000, etat: "SUCCESSFUL", ilYaJours: 2 });
    await commande({ produitId, prix: 3_000, etat: "SUCCESSFUL", ilYaJours: 15 });

    const a = await historiqueDesAchats(acheteur, "Toutes");
    const dates = a.commandes.map((c) => c.passeeLe.getTime());
    expect(dates).toEqual([...dates].sort((x, y) => y - x));
  });

  it("ne montre pas les commandes de quelqu'un d'autre", async () => {
    const { produitId } = await ressource(1_000, "a.zip");
    const autre = await compte("intrus@hist.test");
    await db.order.create({
      data: {
        buyerId: autre,
        currency: "XOF",
        total: 90_000,
        status: "COMPLETED",
        items: {
          create: { productId: produitId, price: 90_000, quantity: 1, state: "SUCCESSFUL" },
        },
      },
    });

    const a = await historiqueDesAchats(acheteur, "Toutes");
    expect(a.commandes).toHaveLength(0);
    expect(a.bilan.totalDepense).toBe(0);
  });
});

describe("historique des téléchargements", () => {
  async function retrait(produitId: string, fichierId: string, ilYaJours: number) {
    await db.consumptionEvent.create({
      data: {
        userId: acheteur,
        productId: produitId,
        productFileId: fichierId,
        eventType: "DOWNLOAD",
        platform: "AUTRE",
        consumedAt: new Date(Date.now() - ilYaJours * JOUR),
      },
    });
  }

  it("regroupe par ressource et compte les reprises", async () => {
    const a = await ressource(7_000, "font.ttf");
    const b = await ressource(0, "textures.jpg");

    await retrait(a.produitId, a.fichierId, 1);
    await retrait(a.produitId, a.fichierId, 2);
    await retrait(a.produitId, a.fichierId, 3);
    await retrait(b.produitId, b.fichierId, 4);

    const h = await historiqueDesTelechargements(acheteur, "Tous");

    expect(h.ressources).toHaveLength(2);
    expect(h.totalGeneral).toBe(4);
    expect(h.ressourcesDistinctes).toBe(2);

    const premier = h.ressources.find((r) => r.produitId === a.produitId);
    expect(premier?.repetitions).toBe(3);
    expect(premier?.formats).toBe("TTF");
    expect(premier?.gratuite).toBe(false);
  });

  it("retient comme dernier retrait le plus récent, pas le premier lu", async () => {
    const a = await ressource(5_000, "pack.zip");
    await retrait(a.produitId, a.fichierId, 20);
    await retrait(a.produitId, a.fichierId, 1);

    const h = await historiqueDesTelechargements(acheteur, "Tous");
    const ecart = Date.now() - (h.ressources[0]?.dernierRetrait.getTime() ?? 0);
    expect(ecart).toBeLessThan(2 * JOUR);
  });

  it("sépare ce mois, les gratuits et les achetés", async () => {
    const paye = await ressource(7_000, "font.ttf");
    const offert = await ressource(0, "textures.jpg");

    // Un retrait aujourd'hui, un autre il y a quarante jours : le second est
    // forcément hors du mois courant, quel que soit le jour où le test tourne.
    await retrait(paye.produitId, paye.fichierId, 0);
    await retrait(offert.produitId, offert.fichierId, 40);

    const ceMois = await historiqueDesTelechargements(acheteur, "Ce mois");
    expect(ceMois.ressources.map((r) => r.produitId)).toEqual([paye.produitId]);

    const gratuits = await historiqueDesTelechargements(acheteur, "Gratuits");
    expect(gratuits.ressources.map((r) => r.produitId)).toEqual([offert.produitId]);

    const achetes = await historiqueDesTelechargements(acheteur, "Achetés");
    expect(achetes.ressources.map((r) => r.produitId)).toEqual([paye.produitId]);
  });

  it("ne laisse pas le filtre fausser le bilan", async () => {
    const paye = await ressource(7_000, "font.ttf");
    const offert = await ressource(0, "textures.jpg");
    await retrait(paye.produitId, paye.fichierId, 0);
    await retrait(offert.produitId, offert.fichierId, 40);

    for (const filtre of ["Tous", "Ce mois", "Gratuits", "Achetés"] as const) {
      const h = await historiqueDesTelechargements(acheteur, filtre);
      expect(h.totalGeneral).toBe(2);
      expect(h.ressourcesDistinctes).toBe(2);
    }
  });

  it("survit à une ressource supprimée depuis", async () => {
    // Le journal de consommation ne porte aucune relation : l'événement reste
    // quand la ressource part. La page ne doit pas s'effondrer pour autant.
    const a = await ressource(3_000, "a.zip");
    await retrait(a.produitId, a.fichierId, 1);
    await db.productFile.deleteMany({ where: { productId: a.produitId } });
    await db.product.delete({ where: { id: a.produitId } });

    const h = await historiqueDesTelechargements(acheteur, "Tous");
    expect(h.ressources).toHaveLength(0);
    // L'événement compte toujours : il a bien eu lieu.
    expect(h.totalGeneral).toBe(1);
  });

  it("annonce le quota du forfait, et rien quand il n'y en a pas", async () => {
    const sansForfait = await historiqueDesTelechargements(acheteur, "Tous");
    expect(sansForfait.quota).toBeNull();

    const plan = await db.plan.create({
      data: {
        code: "EXPLORER",
        name: "Explorer",
        priceMonthly: 2_500,
        downloadsPerMonth: 20,
      },
      select: { id: true },
    });
    const abo = await db.subscription.create({
      data: {
        userId: acheteur,
        planId: plan.id,
        status: "ACTIVE",
        cycleEnd: new Date(Date.now() + 10 * JOUR),
      },
      select: { id: true },
    });

    const maintenant = new Date();
    const periode = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, "0")}`;
    await db.downloadQuota.create({
      data: { subscriptionId: abo.id, period: periode, limit: 20, used: 7 },
    });

    const avecForfait = await historiqueDesTelechargements(acheteur, "Tous");
    expect(avecForfait.quota).toEqual({ utilises: 7, limite: 20 });
  });

  it("ne montre pas les retraits de quelqu'un d'autre", async () => {
    const a = await ressource(3_000, "a.zip");
    const autre = await compte("intrus@hist.test");
    await db.consumptionEvent.create({
      data: {
        userId: autre,
        productId: a.produitId,
        productFileId: a.fichierId,
        eventType: "DOWNLOAD",
        platform: "AUTRE",
      },
    });

    const h = await historiqueDesTelechargements(acheteur, "Tous");
    expect(h.totalGeneral).toBe(0);
  });
});
