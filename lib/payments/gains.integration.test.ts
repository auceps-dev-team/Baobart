import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { encaisserLigne } from "@/lib/domain/orders";
import { gainsDe, masquerCompte } from "@/lib/payments/gains";
import { RAILS_BAOBART } from "@/lib/payments/payout-schedule";
import {
  confirmerVersement,
  marquerVersementEnvoye,
  preparerVersement,
} from "@/lib/payments/versements";

/**
 * L'écran « Gains », confronté au grand livre.
 *
 * Ce que le créateur lit ici décide s'il fait confiance à la plateforme. Un
 * chiffre flatteur et faux vaut moins qu'un chiffre modeste et vrai.
 */

const JOUR = 86_400_000;
const MAINTENANT = new Date("2026-07-27T09:00:00Z"); // un lundi

let createur: string;
let acheteur: string;
let produit: string;

async function compte(email: string): Promise<string> {
  const u = await db.user.create({
    data: { email, defaultCurrency: "XOF" },
    select: { id: true },
  });
  return u.id;
}

async function vendre(prix: number, ilYaJours: number) {
  const o = await db.order.create({
    data: {
      buyerId: acheteur,
      currency: "XOF",
      total: prix,
      status: "COMPLETED",
      items: {
        create: { productId: produit, price: prix, quantity: 1, state: "IN_PROGRESS" },
      },
    },
    select: { items: { select: { id: true } } },
  });

  const { frais } = await encaisserLigne({
    orderItemId: o.items[0]!.id,
    regime: "DIRECT",
    date: new Date(MAINTENANT.getTime() - ilYaJours * JOUR),
  });
  return frais.sellerNet;
}

async function enregistrerCompte(provider = "wave") {
  await db.payoutAccount.create({
    data: {
      userId: createur,
      method: "MOBILE_MONEY",
      provider,
      accountRef: "+221770004821",
    },
  });
}

beforeEach(async () => {
  createur = await compte("kofi@gains.test");
  acheteur = await compte("ama@gains.test");

  const p = await db.product.create({
    data: {
      sellerId: createur,
      slug: `g-${Math.random().toString(36).slice(2, 9)}`,
      name: "Pack",
      price: 10_000,
      currency: "XOF",
      status: "PUBLISHED",
    },
    select: { id: true },
  });
  produit = p.id;
});

describe("les trois sommes", () => {
  it("sépare ce qui est versable de ce qui est encore en rétention", async () => {
    // Les additionner donnerait un total flatteur et faux.
    const vieux = await vendre(10_000, 20); // hors rétention
    const recent = await vendre(10_000, 2); // encore dans les sept jours

    await enregistrerCompte();
    const g = await gainsDe(createur, MAINTENANT);

    expect(g.disponible).toBe(vieux);
    expect(g.enAttente).toBe(recent);
    // Le créateur ne doit jamais lire la somme des deux comme « disponible ».
    expect(g.disponible).toBeLessThan(vieux + recent);
  });

  it("ne compte comme versé que ce qui est réellement arrivé", async () => {
    await vendre(10_000, 20);
    await enregistrerCompte();

    const { versement } = await preparerVersement({
      userId: createur,
      cycleDate: new Date("2026-07-24T00:00:00Z"),
      rail: RAILS_BAOBART.wave!,
      method: "MOBILE_MONEY",
      accountRef: "+221770004821",
    });

    // Préparé mais pas confirmé : rien n'est arrivé chez le créateur.
    let g = await gainsDe(createur, MAINTENANT);
    expect(g.cumulAnnee).toBe(0);
    expect(g.versements[0]?.statut).toBe("CREATING");

    await marquerVersementEnvoye(versement.id, "WAVE-1");
    g = await gainsDe(createur, MAINTENANT);
    expect(g.cumulAnnee).toBe(0);

    await confirmerVersement(versement.id);
    g = await gainsDe(createur, MAINTENANT);
    expect(g.cumulAnnee).toBe(versement.amount);
  });

  it("retire du disponible ce qui est parti en versement", async () => {
    const net = await vendre(10_000, 20);
    await enregistrerCompte();

    expect((await gainsDe(createur, MAINTENANT)).disponible).toBe(net);

    await preparerVersement({
      userId: createur,
      cycleDate: new Date("2026-07-24T00:00:00Z"),
      rail: RAILS_BAOBART.wave!,
      method: "MOBILE_MONEY",
      accountRef: "+221770004821",
    });

    // Les soldes sont réservés : ils ne sont plus disponibles.
    expect((await gainsDe(createur, MAINTENANT)).disponible).toBe(0);
  });
});

describe("ce qu'on annonce comme date", () => {
  it("donne une date quand tout est en ordre", async () => {
    await vendre(20_000, 20);
    await enregistrerCompte();

    const g = await gainsDe(createur, MAINTENANT);
    expect(g.prochainVersement).not.toBeNull();
    expect(g.blocage.payable).toBe(true);
  });

  it("n'annonce aucune date sans compte, et dit pourquoi", async () => {
    await vendre(20_000, 20);

    const g = await gainsDe(createur, MAINTENANT);
    expect(g.prochainVersement).toBeNull();
    expect(g.blocage).toMatchObject({ payable: false, raison: "PAS_DE_COMPTE" });
    // Le solde est là, il ne bouge simplement pas.
    expect(g.disponible).toBeGreaterThan(0);
  });

  it("dit qu'un solde signalé est conservé", async () => {
    await vendre(20_000, 20);
    await enregistrerCompte();
    await db.user.update({
      where: { id: createur },
      data: { riskState: "FLAGGED_FRAUD" },
    });

    const g = await gainsDe(createur, MAINTENANT);
    expect(g.prochainVersement).toBeNull();
    if (!g.blocage.payable) expect(g.blocage.message).toMatch(/conserv/i);
    expect(g.disponible).toBeGreaterThan(0);
  });

  it("n'annonce rien sous le seuil, sans perdre la somme", async () => {
    await vendre(600, 20);
    await enregistrerCompte();

    const g = await gainsDe(createur, MAINTENANT);
    expect(g.prochainVersement).toBeNull();
    expect(g.blocage).toMatchObject({ raison: "SOUS_LE_SEUIL" });
    expect(g.disponible).toBeGreaterThan(0);
  });
});

describe("ce que l'écran affiche", () => {
  it("dérive la part du créateur du barème, pas de la maquette", async () => {
    await enregistrerCompte();
    const g = await gainsDe(createur, MAINTENANT);

    // La maquette annonçait « 80 % » : un taux que la lecture du dépôt de
    // référence a fait abandonner.
    expect(g.partCreateur).toBe("90 %");
  });

  it("masque le numéro du compte", async () => {
    await enregistrerCompte();
    const g = await gainsDe(createur, MAINTENANT);

    expect(g.compte?.apercu).toBe("···· 4821");
    expect(g.compte?.apercu).not.toContain("221770");
    expect(g.compte?.label).toBe("Wave");
  });

  it("masque aussi dans l'historique", async () => {
    await vendre(20_000, 20);
    await enregistrerCompte();
    await preparerVersement({
      userId: createur,
      cycleDate: new Date("2026-07-24T00:00:00Z"),
      rail: RAILS_BAOBART.wave!,
      method: "MOBILE_MONEY",
      accountRef: "+221770004821",
    });

    const g = await gainsDe(createur, MAINTENANT);
    expect(g.versements[0]?.compte).toBe("···· 4821");
  });

  it("rend six mois, ceux sans versement à zéro", async () => {
    await enregistrerCompte();
    const g = await gainsDe(createur, MAINTENANT);

    // Une barre absente laisserait croire à un trou dans les données.
    expect(g.parMois).toHaveLength(6);
    expect(g.parMois.every((m) => m.montant === 0)).toBe(true);
    expect(g.parMois.at(-1)?.libelle).toBe("juil.");
  });

  it("ne montre pas les versements d'un autre créateur", async () => {
    const voisin = await compte("voisin@gains.test");
    await db.payoutAccount.create({
      data: {
        userId: voisin,
        method: "MOBILE_MONEY",
        provider: "wave",
        accountRef: "+221770009999",
      },
    });

    await vendre(20_000, 20);
    await enregistrerCompte();
    await preparerVersement({
      userId: createur,
      cycleDate: new Date("2026-07-24T00:00:00Z"),
      rail: RAILS_BAOBART.wave!,
      method: "MOBILE_MONEY",
      accountRef: "+221770004821",
    });

    const g = await gainsDe(voisin, MAINTENANT);
    expect(g.versements).toHaveLength(0);
    expect(g.disponible).toBe(0);
  });
});

describe("masquage", () => {
  it("ne laisse voir que les quatre derniers chiffres", () => {
    expect(masquerCompte("+221 77 000 48 21")).toBe("···· 4821");
    expect(masquerCompte("SN08SN0101520000123456789012")).toBe("···· 9012");
  });

  it("ne casse pas sur une référence courte", () => {
    expect(masquerCompte("12")).toBe("···· 12");
    expect(masquerCompte("")).toBe("···· ");
  });
});
