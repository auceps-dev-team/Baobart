/**
 * Les codes promo, contre une vraie base.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX RÈGLES NE SE VOIENT QUE SOUS CONCURRENCE OU DANS LE TEMPS
 *
 * Le plafond : deux acheteurs qui présentent le dernier exemplaire au même
 * instant. Un `if` en mémoire laisserait passer les deux, et le compteur
 * afficherait exactement la bonne valeur.
 *
 * La libération : en mobile money, ouvrir n'est pas payer. Sans elle, dix
 * hésitations épuisent un code à dix usages, le vendeur annonce dix remises,
 * personne n'en reçoit — et le compteur affiche fidèlement « 10 / 10 ».
 */

import { beforeEach, describe, expect, it } from "vitest";

import { acheter } from "@/lib/checkout/achat";
import {
  consommerLeCode,
  creerUnCode,
  evaluerUnCode,
  libererLeCode,
  listerLesCodes,
  normaliserCode,
  prixPlancher,
  remiseDe,
  retirerUnCode,
} from "@/lib/commerce/codes-promo";
import { db } from "@/lib/db";
import { abandonnerVente } from "@/lib/payments/encaissement/reglement";

let n = 0;
const suffixe = () => `${Date.now()}-${++n}`;

const PRIX = 10_000;

async function creerVendeurEtProduit(prix = PRIX) {
  const vendeur = await db.user.create({
    data: { email: `promo-v-${suffixe()}@baobart.test`, defaultCurrency: "XOF" },
    select: { id: true },
  });

  const produit = await db.product.create({
    data: {
      sellerId: vendeur.id,
      slug: `promo-${suffixe()}`,
      name: "Pack wax",
      price: prix,
      currency: "XOF",
      status: "PUBLISHED",
    },
    select: { id: true },
  });

  const media = await db.mediaAsset.create({
    data: {
      ownerId: vendeur.id,
      purpose: "product",
      s3Key: `p/${suffixe()}.zip`,
      checksum: "x",
      sizeBytes: 1024,
      contentType: "application/zip",
      status: "READY",
    },
    select: { id: true },
  });

  await db.productFile.create({
    data: {
      productId: produit.id,
      mediaId: media.id,
      filename: "pack.zip",
      sizeBytes: 1024,
      role: "SOURCE",
    },
  });

  return { vendeur, produit };
}

async function creerAcheteur() {
  return db.user.create({
    data: { email: `promo-a-${suffixe()}@baobart.test`, defaultCurrency: "XOF" },
    select: { id: true },
  });
}

describe("la normalisation", () => {
  it("efface la casse, les espaces et la ponctuation", () => {
    // « Noel 25 » écrit et « noel-25 » tapé doivent se retrouver : la base
    // compare des octets, et le code s'afficherait pourtant dans l'écran du
    // vendeur exactement comme il l'a saisi.
    for (const forme of ["NOEL25", "noel 25", " Noël-25 ", "no.el_25"]) {
      expect(normaliserCode(forme)).toBe("NOEL25");
    }
  });
});

describe("le calcul de la remise", () => {
  it("arrondit le pourcentage vers le bas", () => {
    // Vers le bas, donc le franc de reste va au vendeur. Arbitraire, et
    // écrit : une règle d'arrondi qu'on ne nomme pas se redécide
    // différemment au prochain appel.
    expect(remiseDe("PERCENT", 33, 1_015)).toBe(334);
  });

  it("borne une remise fixe au prix", () => {
    // Un code « -10 000 F » sur une ressource à 3 000 F ne rend pas 7 000 F.
    expect(remiseDe("FIXED", 10_000, 3_000)).toBe(3_000);
  });

  it("borne un pourcentage à cent", () => {
    expect(remiseDe("PERCENT", 250, 1_000)).toBe(1_000);
  });

  it("ne rend rien sur un montant nul ou négatif", () => {
    expect(remiseDe("PERCENT", 0, 1_000)).toBe(0);
    expect(remiseDe("FIXED", -50, 1_000)).toBe(0);
  });
});

describe("l'évaluation", () => {
  it("accorde la remise annoncée", async () => {
    const { vendeur, produit } = await creerVendeurEtProduit();
    await creerUnCode({
      vendeurId: vendeur.id,
      code: "noel 25",
      type: "PERCENT",
      montant: 25,
    });

    const suite = await evaluerUnCode({
      code: "NOEL25",
      vendeurId: vendeur.id,
      produitId: produit.id,
      prix: PRIX,
    });

    expect(suite.ok).toBe(true);
    if (!suite.ok) return;
    expect(suite.remise).toBe(2_500);
    expect(suite.prixFinal).toBe(7_500);
    expect(suite.prixAffiche).toBe(PRIX);
  });

  it("refuse un code d'un autre vendeur", async () => {
    // La recherche porte sur `(sellerId, code)`. Deux vendeurs peuvent avoir
    // le même code sans se marcher dessus.
    const a = await creerVendeurEtProduit();
    const b = await creerVendeurEtProduit();
    await creerUnCode({
      vendeurId: a.vendeur.id,
      code: "PARTAGE",
      type: "PERCENT",
      montant: 10,
    });

    const suite = await evaluerUnCode({
      code: "PARTAGE",
      vendeurId: b.vendeur.id,
      produitId: b.produit.id,
      prix: PRIX,
    });

    expect(suite).toEqual({ ok: false, motif: "INCONNU" });
  });

  it("refuse un code retiré", async () => {
    const { vendeur, produit } = await creerVendeurEtProduit();
    const cree = await creerUnCode({
      vendeurId: vendeur.id,
      code: "RETIRE",
      type: "PERCENT",
      montant: 10,
    });
    if (!cree.ok) throw new Error("création refusée");

    await retirerUnCode(vendeur.id, cree.id);

    expect(
      await evaluerUnCode({
        code: "RETIRE",
        vendeurId: vendeur.id,
        produitId: produit.id,
        prix: PRIX,
      }),
    ).toEqual({ ok: false, motif: "RETIRE" });
  });

  it("refuse un code expiré", async () => {
    const { vendeur, produit } = await creerVendeurEtProduit();
    await creerUnCode({
      vendeurId: vendeur.id,
      code: "HIER",
      type: "PERCENT",
      montant: 10,
      expireLe: new Date(Date.now() - 1000),
    });

    expect(
      await evaluerUnCode({
        code: "HIER",
        vendeurId: vendeur.id,
        produitId: produit.id,
        prix: PRIX,
      }),
    ).toEqual({ ok: false, motif: "EXPIRE" });
  });

  it("refuse un code épuisé", async () => {
    const { vendeur, produit } = await creerVendeurEtProduit();
    const cree = await creerUnCode({
      vendeurId: vendeur.id,
      code: "UNSEUL",
      type: "PERCENT",
      montant: 10,
      plafond: 1,
    });
    if (!cree.ok) throw new Error("création refusée");

    await consommerLeCode(cree.id);

    expect(
      await evaluerUnCode({
        code: "UNSEUL",
        vendeurId: vendeur.id,
        produitId: produit.id,
        prix: PRIX,
      }),
    ).toEqual({ ok: false, motif: "EPUISE" });
  });

  it("refuse un code visant une autre ressource", async () => {
    const { vendeur, produit } = await creerVendeurEtProduit();
    const autre = await db.product.create({
      data: {
        sellerId: vendeur.id,
        slug: `autre-${suffixe()}`,
        name: "Autre",
        price: PRIX,
        currency: "XOF",
        status: "PUBLISHED",
      },
      select: { id: true },
    });

    await creerUnCode({
      vendeurId: vendeur.id,
      code: "CIBLE",
      type: "PERCENT",
      montant: 10,
      produitIds: [autre.id],
    });

    expect(
      await evaluerUnCode({
        code: "CIBLE",
        vendeurId: vendeur.id,
        produitId: produit.id,
        prix: PRIX,
      }),
    ).toEqual({ ok: false, motif: "AUTRE_RESSOURCE" });
  });

  it("vaut sur toutes les ressources quand aucune n'est visée", async () => {
    // `[]` est la valeur par défaut du schéma, et elle veut dire « partout ».
    const { vendeur, produit } = await creerVendeurEtProduit();
    await creerUnCode({
      vendeurId: vendeur.id,
      code: "PARTOUT",
      type: "PERCENT",
      montant: 10,
    });

    expect(
      (
        await evaluerUnCode({
          code: "PARTOUT",
          vendeurId: vendeur.id,
          produitId: produit.id,
          prix: PRIX,
        })
      ).ok,
    ).toBe(true);
  });

  it("refuse une remise qui passerait sous le prix viable", async () => {
    // En dessous, les frais dépassent l'encaissement : le vendeur ne toucherait
    // rien, et une commande à zéro franc serait refusée par l'opérateur — après
    // avoir été ouverte, donc devant l'acheteur.
    const { vendeur, produit } = await creerVendeurEtProduit();
    await creerUnCode({
      vendeurId: vendeur.id,
      code: "TOUT",
      type: "PERCENT",
      montant: 100,
    });

    expect(
      await evaluerUnCode({
        code: "TOUT",
        vendeurId: vendeur.id,
        produitId: produit.id,
        prix: PRIX,
      }),
    ).toEqual({ ok: false, motif: "TROP_FORTE" });
  });

  it("le prix plancher se calcule, il ne s'écrit pas", () => {
    // Dérivé du barème : une modification des frais le déplace toute seule.
    expect(prixPlancher()).toBeGreaterThan(0);
    expect(Number.isFinite(prixPlancher())).toBe(true);
  });
});

describe("le plafond sous concurrence", () => {
  it("ne laisse pas deux consommations dépasser le plafond", async () => {
    // LE TEST QUI COMPTE. Un `if` en mémoire laisserait passer les deux, et
    // le compteur afficherait exactement la bonne valeur — un dépassement
    // sans trace.
    const { vendeur } = await creerVendeurEtProduit();
    const cree = await creerUnCode({
      vendeurId: vendeur.id,
      code: "COURSE",
      type: "PERCENT",
      montant: 10,
      plafond: 1,
    });
    if (!cree.ok) throw new Error("création refusée");

    const [un, deux] = await Promise.all([
      consommerLeCode(cree.id),
      consommerLeCode(cree.id),
    ]);

    expect([un, deux].filter(Boolean)).toHaveLength(1);

    const apres = await db.offerCode.findUniqueOrThrow({
      where: { id: cree.id },
      select: { usesCount: true },
    });
    expect(apres.usesCount).toBe(1);
  });

  it("laisse consommer sans fin quand il n'y a pas de plafond", async () => {
    const { vendeur } = await creerVendeurEtProduit();
    const cree = await creerUnCode({
      vendeurId: vendeur.id,
      code: "ILLIMITE",
      type: "PERCENT",
      montant: 10,
    });
    if (!cree.ok) throw new Error("création refusée");

    expect(await consommerLeCode(cree.id)).toBe(true);
    expect(await consommerLeCode(cree.id)).toBe(true);
  });

  it("ne descend jamais sous zéro à la libération", async () => {
    // Un décrément non gardé donnerait -1, et le plafond ne s'appliquerait
    // plus jamais : `-1 < 10` reste vrai pour toujours.
    const { vendeur } = await creerVendeurEtProduit();
    const cree = await creerUnCode({
      vendeurId: vendeur.id,
      code: "PLANCHER",
      type: "PERCENT",
      montant: 10,
    });
    if (!cree.ok) throw new Error("création refusée");

    expect(await libererLeCode(cree.id)).toBe(false);

    const apres = await db.offerCode.findUniqueOrThrow({
      where: { id: cree.id },
      select: { usesCount: true },
    });
    expect(apres.usesCount).toBe(0);
  });
});

describe("l'achat avec un code", () => {
  const simulationOrigine = process.env.CHECKOUT_SIMULATION_ENABLED;
  const envOrigine = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.CHECKOUT_SIMULATION_ENABLED = "true";
  });

  it("facture le prix remisé et garde le prix affiché", async () => {
    const { vendeur, produit } = await creerVendeurEtProduit();
    const acheteur = await creerAcheteur();
    await creerUnCode({
      vendeurId: vendeur.id,
      code: "MOINS20",
      type: "PERCENT",
      montant: 20,
    });

    const suite = await acheter({
      produitId: produit.id,
      acheteurId: acheteur.id,
      codePromo: "moins 20",
    });

    expect(suite.ok).toBe(true);
    if (!suite.ok) return;
    expect(suite.remise).toEqual({ code: "MOINS20", montant: 2_000 });

    const ligne = await db.orderItem.findUniqueOrThrow({
      where: { id: suite.orderItemId },
      select: { price: true, listPrice: true, offerCodeId: true },
    });

    // Le prix ENCAISSÉ est le remisé : c'est lui que lit le barème de frais,
    // et la remise est donc supportée par le vendeur.
    expect(ligne.price).toBe(8_000);
    expect(ligne.listPrice).toBe(PRIX);
    expect(ligne.offerCodeId).not.toBeNull();

    const commande = await db.order.findUniqueOrThrow({
      where: { id: suite.orderId },
      select: { total: true },
    });
    expect(commande.total).toBe(8_000);
  });

  it("n'écrit pas de prix affiché quand il n'y a pas de code", async () => {
    // Recopier `price` dans les deux colonnes ferait lire pareil « il y a une
    // remise » et « il n'y en a pas ».
    const { produit } = await creerVendeurEtProduit();
    const acheteur = await creerAcheteur();

    const suite = await acheter({
      produitId: produit.id,
      acheteurId: acheteur.id,
    });

    expect(suite.ok).toBe(true);
    if (!suite.ok) return;

    const ligne = await db.orderItem.findUniqueOrThrow({
      where: { id: suite.orderItemId },
      select: { price: true, listPrice: true, offerCodeId: true },
    });
    expect(ligne.price).toBe(PRIX);
    expect(ligne.listPrice).toBeNull();
    expect(ligne.offerCodeId).toBeNull();
  });

  it("refuse l'achat quand le code ne vaut rien", async () => {
    // On ne vend pas au prix plein en ignorant le code : l'acheteur a vu une
    // remise à l'aperçu, et lui facturer autre chose sans le dire serait pire
    // qu'un refus.
    const { produit } = await creerVendeurEtProduit();
    const acheteur = await creerAcheteur();

    const suite = await acheter({
      produitId: produit.id,
      acheteurId: acheteur.id,
      codePromo: "NEXISTEPAS",
    });

    expect(suite).toEqual({ ok: false, motif: "CODE_REFUSE" });
    expect(await db.order.count({ where: { buyerId: acheteur.id } })).toBe(0);
  });

  it("consomme un exemplaire à l'achat", async () => {
    const { vendeur, produit } = await creerVendeurEtProduit();
    const acheteur = await creerAcheteur();
    const cree = await creerUnCode({
      vendeurId: vendeur.id,
      code: "COMPTE",
      type: "PERCENT",
      montant: 20,
      plafond: 3,
    });
    if (!cree.ok) throw new Error("création refusée");

    await acheter({
      produitId: produit.id,
      acheteurId: acheteur.id,
      codePromo: "COMPTE",
    });

    expect(
      (
        await db.offerCode.findUniqueOrThrow({
          where: { id: cree.id },
          select: { usesCount: true },
        })
      ).usesCount,
    ).toBe(1);
  });

  it("rend l'exemplaire quand la vente est abandonnée", async () => {
    // LE SECOND TEST QUI COMPTE. En mobile money, ouvrir n'est pas payer :
    // sans libération, dix hésitations épuisent un code à dix usages et
    // personne ne reçoit la remise annoncée.
    const { vendeur, produit } = await creerVendeurEtProduit();
    const acheteur = await creerAcheteur();
    const cree = await creerUnCode({
      vendeurId: vendeur.id,
      code: "RENDU",
      type: "PERCENT",
      montant: 20,
      plafond: 1,
    });
    if (!cree.ok) throw new Error("création refusée");

    const suite = await acheter({
      produitId: produit.id,
      acheteurId: acheteur.id,
      codePromo: "RENDU",
    });
    if (!suite.ok) throw new Error("achat refusé");

    // On remet la ligne en cours pour rejouer l'abandon : la simulation l'a
    // conclue tout de suite, alors qu'en mobile money elle resterait ouverte.
    await db.orderItem.update({
      where: { id: suite.orderItemId },
      data: { state: "IN_PROGRESS" },
    });

    expect(await abandonnerVente(suite.orderItemId)).toBe(true);

    expect(
      (
        await db.offerCode.findUniqueOrThrow({
          where: { id: cree.id },
          select: { usesCount: true },
        })
      ).usesCount,
    ).toBe(0);
  });

  it("ne rend pas deux fois le même exemplaire", async () => {
    // `abandonnerVente` ne réussit sa transition qu'une fois : la libération
    // est donc exactement aussi idempotente que l'abandon.
    const { vendeur, produit } = await creerVendeurEtProduit();
    const acheteur = await creerAcheteur();
    const cree = await creerUnCode({
      vendeurId: vendeur.id,
      code: "UNEFOIS",
      type: "PERCENT",
      montant: 20,
      plafond: 2,
    });
    if (!cree.ok) throw new Error("création refusée");

    const suite = await acheter({
      produitId: produit.id,
      acheteurId: acheteur.id,
      codePromo: "UNEFOIS",
    });
    if (!suite.ok) throw new Error("achat refusé");

    await db.orderItem.update({
      where: { id: suite.orderItemId },
      data: { state: "IN_PROGRESS" },
    });

    expect(await abandonnerVente(suite.orderItemId)).toBe(true);
    expect(await abandonnerVente(suite.orderItemId)).toBe(false);

    expect(
      (
        await db.offerCode.findUniqueOrThrow({
          where: { id: cree.id },
          select: { usesCount: true },
        })
      ).usesCount,
    ).toBe(0);
  });

  it("remet l'environnement", () => {
    if (simulationOrigine === undefined) {
      delete process.env.CHECKOUT_SIMULATION_ENABLED;
    } else {
      process.env.CHECKOUT_SIMULATION_ENABLED = simulationOrigine;
    }
    expect(envOrigine).toBeDefined();
  });
});

describe("la création et la liste", () => {
  it("refuse un code trop court", async () => {
    const { vendeur } = await creerVendeurEtProduit();
    expect(
      await creerUnCode({
        vendeurId: vendeur.id,
        code: "ab",
        type: "PERCENT",
        montant: 10,
      }),
    ).toEqual({ ok: false, motif: "CODE_VIDE" });
  });

  it("refuse un pourcentage au-dessus de cent", async () => {
    const { vendeur } = await creerVendeurEtProduit();
    expect(
      await creerUnCode({
        vendeurId: vendeur.id,
        code: "TROP",
        type: "PERCENT",
        montant: 150,
      }),
    ).toEqual({ ok: false, motif: "MONTANT_INVALIDE" });
  });

  it("refuse deux fois le même code chez le même vendeur", async () => {
    const { vendeur } = await creerVendeurEtProduit();
    await creerUnCode({
      vendeurId: vendeur.id,
      code: "DOUBLE",
      type: "PERCENT",
      montant: 10,
    });

    expect(
      await creerUnCode({
        vendeurId: vendeur.id,
        // Normalisé, c'est le même : sans cela, on créerait deux codes que
        // `evaluerUnCode` confondrait.
        code: "double",
        type: "PERCENT",
        montant: 20,
      }),
    ).toEqual({ ok: false, motif: "DEJA_PRIS" });
  });

  it("refuse de viser la ressource d'un autre", async () => {
    // Le code ne servirait à rien — la recherche porte sur le vendeur —, mais
    // l'écran afficherait une campagne sur un produit qui n'est pas le sien.
    const a = await creerVendeurEtProduit();
    const b = await creerVendeurEtProduit();

    expect(
      await creerUnCode({
        vendeurId: a.vendeur.id,
        code: "VOLE",
        type: "PERCENT",
        montant: 10,
        produitIds: [b.produit.id],
      }),
    ).toEqual({ ok: false, motif: "RESSOURCE_ETRANGERE" });
  });

  it("marque inactif ce qui n'accorde plus rien", async () => {
    const { vendeur } = await creerVendeurEtProduit();
    await creerUnCode({
      vendeurId: vendeur.id,
      code: "FINI",
      type: "PERCENT",
      montant: 10,
      expireLe: new Date(Date.now() - 1000),
    });

    const lignes = await listerLesCodes(vendeur.id);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]!.inactif).toBe(true);
    expect(lignes[0]!.libelleRemise).toBe("-10 %");
  });

  it("ne retire pas le code d'un autre vendeur", async () => {
    const a = await creerVendeurEtProduit();
    const b = await creerVendeurEtProduit();
    const cree = await creerUnCode({
      vendeurId: b.vendeur.id,
      code: "SIEN",
      type: "PERCENT",
      montant: 10,
    });
    if (!cree.ok) throw new Error("création refusée");

    expect(await retirerUnCode(a.vendeur.id, cree.id)).toBe(false);
    expect((await listerLesCodes(b.vendeur.id))[0]!.retireLe).toBeNull();
  });
});
