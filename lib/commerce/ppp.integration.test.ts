/**
 * La parité de pouvoir d'achat.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE PREMIER TEST EST CELUI QUI VÉRIFIE QUE RIEN NE SE PASSE
 *
 * La table des coefficients est livrée **vide**, et c'est une décision : un
 * coefficient PPP est une valeur mesurée, et en inventer pour faire marcher
 * une démonstration poserait une réduction qu'aucune source ne soutient.
 *
 * Le comportement par défaut — prix inchangé, partout — est donc la propriété
 * principale à garantir. Tout le reste ne s'active qu'une fois des chiffres
 * chargés avec leur source.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { acheter } from "@/lib/checkout/achat";
import { prixPlancher } from "@/lib/commerce/codes-promo";
import {
  ajusterAuPays,
  listerLesFacteurs,
  poserUnFacteur,
  retirerUnFacteur,
} from "@/lib/commerce/ppp";
import { db } from "@/lib/db";

let n = 0;
const suffixe = () => `${Date.now()}-${++n}`;

const SOURCE = "Banque mondiale, PPP conversion factor 2023 (jeu de test)";

async function creerRessource(options: {
  prix?: number;
  ppp?: boolean;
  plafondBp?: number | null;
} = {}) {
  const { prix = 10_000, ppp = true, plafondBp = null } = options;

  const vendeur = await db.user.create({
    data: { email: `ppp-v-${suffixe()}@baobart.test`, defaultCurrency: "XOF" },
    select: { id: true },
  });

  const produit = await db.product.create({
    data: {
      sellerId: vendeur.id,
      slug: `ppp-${suffixe()}`,
      name: "Pack",
      price: prix,
      currency: "XOF",
      status: "PUBLISHED",
      pppEnabled: ppp,
      pppMaxDiscountBp: plafondBp,
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
    data: { email: `ppp-a-${suffixe()}@baobart.test`, defaultCurrency: "XOF" },
    select: { id: true },
  });
}

describe("sans coefficient chargé", () => {
  beforeEach(async () => {
    await db.pppFactor.deleteMany({});
  });

  it("ne change rien, quel que soit le pays", async () => {
    // LA PROPRIÉTÉ PRINCIPALE. La table est vide à la livraison, et une
    // réduction qui apparaîtrait sans chiffre serait une réduction inventée.
    for (const pays of ["CI", "SN", "FR", "US"]) {
      const suite = await ajusterAuPays({
        prix: 10_000,
        actif: true,
        plafondBp: null,
        pays,
      });

      expect(suite.remiseBp).toBe(0);
      expect(suite.prix).toBe(10_000);
      expect(suite.raison).toBe("SANS_COEFFICIENT");
    }
  });

  it("ne change rien quand le créateur n'y a pas souscrit", async () => {
    await poserUnFacteur({
      pays: "CI",
      facteurBp: 5_000,
      source: SOURCE,
      releveLe: new Date("2023-01-01"),
    });

    const suite = await ajusterAuPays({
      prix: 10_000,
      actif: false,
      plafondBp: null,
      pays: "CI",
    });

    expect(suite.remiseBp).toBe(0);
    expect(suite.raison).toBe("DESACTIVE");
  });

  it("ne change rien sur un pays illisible", async () => {
    for (const pays of ["", "FRANCE", "f", null]) {
      const suite = await ajusterAuPays({
        prix: 10_000,
        actif: true,
        plafondBp: null,
        pays,
      });
      expect(suite.raison).toBe("PAYS_INCONNU");
    }
  });
});

describe("avec un coefficient", () => {
  beforeEach(async () => {
    await db.pppFactor.deleteMany({});
  });

  it("applique la réduction qu'il annonce", async () => {
    // 6 000 bp = l'acheteur paie 60 %, donc 40 % de moins.
    await poserUnFacteur({
      pays: "CI",
      facteurBp: 6_000,
      source: SOURCE,
      releveLe: new Date("2023-01-01"),
    });

    const suite = await ajusterAuPays({
      prix: 10_000,
      actif: true,
      plafondBp: null,
      pays: "ci",
    });

    expect(suite.remiseBp).toBe(4_000);
    expect(suite.prix).toBe(6_000);
  });

  it("borne la réduction au plafond du créateur", async () => {
    // Le pays est déclaré, pas vérifié : n'importe qui peut cocher le pays le
    // moins cher. Sans plafond, le créateur le découvrirait sur son relevé.
    await poserUnFacteur({
      pays: "CI",
      facteurBp: 2_000,
      source: SOURCE,
      releveLe: new Date("2023-01-01"),
    });

    const suite = await ajusterAuPays({
      prix: 10_000,
      actif: true,
      plafondBp: 3_000,
      pays: "CI",
    });

    expect(suite.remiseBp).toBe(3_000);
    expect(suite.prix).toBe(7_000);
  });

  it("ignore un coefficient qui ferait monter le prix", async () => {
    // « Parité de pouvoir d'achat » n'annonce pas une hausse, et personne
    // n'accepte de payer davantage parce qu'il habite ailleurs.
    await poserUnFacteur({
      pays: "CH",
      facteurBp: 10_000,
      source: SOURCE,
      releveLe: new Date("2023-01-01"),
    });

    const suite = await ajusterAuPays({
      prix: 10_000,
      actif: true,
      plafondBp: null,
      pays: "CH",
    });

    expect(suite.remiseBp).toBe(0);
    expect(suite.prix).toBe(10_000);
    expect(suite.raison).toBe("COEFFICIENT_NEUTRE");
  });

  it("ne descend jamais sous le plancher — et cette garde dort aujourd'hui", async () => {
    // ══════════════════════════════════════════════════════════════════════
    // CE TEST CONSTATE, IL NE PRÉTEND PAS ÉPROUVER
    //
    // Ma première version affirmait que la remise était rabotée au plancher.
    // Elle échouait, et le code avait raison : `prixPlancher()` rend 1,
    // parce que les parts fixes du barème valent délibérément zéro tant que
    // les coûts réels par transaction ne sont pas mesurés.
    //
    // Or la remise s'arrondit vers le bas : pour tout prix entier,
    // `prix − floor(prix × bp / 10 000)` reste ≥ 1. La branche du plancher
    // est donc **inatteignable**.
    //
    // Écrire un test qui la contourne pour obtenir un vert donnerait une
    // garde « éprouvée » que rien n'exerce. On vérifie donc les deux choses
    // qui sont vraies : le prix reste au-dessus du plancher, et la branche
    // ne se déclenche pas.
    await poserUnFacteur({
      pays: "CI",
      facteurBp: 1,
      source: SOURCE,
      releveLe: new Date("2023-01-01"),
    });

    for (const prix of [1, 5, 11, 1_000, 10_000]) {
      const suite = await ajusterAuPays({
        prix,
        actif: true,
        plafondBp: null,
        pays: "CI",
      });

      expect(suite.prix).toBeGreaterThanOrEqual(prixPlancher());
      expect(suite.raison).not.toBe("PLANCHER_ATTEINT");
    }
  });

  it("le plancher vaut un franc tant que les parts fixes valent zéro", () => {
    // La raison pour laquelle la garde ci-dessus dort. Le jour où une part
    // fixe reçoit une valeur mesurée, ce test tombe — et c'est le signal
    // qu'il faut reprendre le précédent.
    expect(prixPlancher()).toBe(1);
  });
});

describe("les coefficients eux-mêmes", () => {
  beforeEach(async () => {
    await db.pppFactor.deleteMany({});
  });

  it("exigent une source", async () => {
    // Un coefficient sans source ne peut pas être revérifié. Personne n'osera
    // le corriger, et il restera en place des années après que le chiffre a
    // bougé.
    expect(
      await poserUnFacteur({
        pays: "CI",
        facteurBp: 6_000,
        source: "",
        releveLe: new Date(),
      }),
    ).toEqual({ ok: false, motif: "SANS_SOURCE" });
  });

  it("refusent un pays qui n'est pas un code à deux lettres", async () => {
    for (const pays of ["CIV", "c", "12"]) {
      expect(
        await poserUnFacteur({
          pays,
          facteurBp: 6_000,
          source: SOURCE,
          releveLe: new Date(),
        }),
      ).toEqual({ ok: false, motif: "PAYS_INVALIDE" });
    }
  });

  it("refusent un coefficient hors bornes", async () => {
    for (const bp of [0, -100, 10_001, 5.5]) {
      expect(
        await poserUnFacteur({
          pays: "CI",
          facteurBp: bp,
          source: SOURCE,
          releveLe: new Date(),
        }),
      ).toEqual({ ok: false, motif: "COEFFICIENT_INVALIDE" });
    }
  });

  it("gardent la date de relevé, distincte de celle d'écriture", async () => {
    // Un chiffre de 2021 chargé aujourd'hui reste un chiffre de 2021.
    const releve = new Date("2021-06-15");
    await poserUnFacteur({
      pays: "CI",
      facteurBp: 6_000,
      source: SOURCE,
      releveLe: releve,
    });

    const lignes = await listerLesFacteurs();
    expect(lignes[0]!.measuredAt.toISOString()).toBe(releve.toISOString());
  });

  it("se retirent, et le pays repasse au prix plein", async () => {
    await poserUnFacteur({
      pays: "CI",
      facteurBp: 6_000,
      source: SOURCE,
      releveLe: new Date(),
    });

    expect(await retirerUnFacteur("ci")).toBe(true);
    expect(
      (
        await ajusterAuPays({
          prix: 10_000,
          actif: true,
          plafondBp: null,
          pays: "CI",
        })
      ).remiseBp,
    ).toBe(0);
  });
});

describe("l'achat", () => {
  beforeEach(async () => {
    process.env.CHECKOUT_SIMULATION_ENABLED = "true";
    await db.pppFactor.deleteMany({});
  });

  it("facture le prix ajusté et garde le prix d'avant", async () => {
    await poserUnFacteur({
      pays: "CI",
      facteurBp: 6_000,
      source: SOURCE,
      releveLe: new Date("2023-01-01"),
    });

    const { produit } = await creerRessource({ prix: 10_000 });
    const acheteur = await creerAcheteur();

    const suite = await acheter({
      produitId: produit.id,
      acheteurId: acheteur.id,
      pays: "CI",
    });
    if (!suite.ok) throw new Error("achat refusé");

    const ligne = await db.orderItem.findUniqueOrThrow({
      where: { id: suite.orderItemId },
      select: {
        price: true,
        listPrice: true,
        buyerCountry: true,
        pppDiscountBp: true,
      },
    });

    expect(ligne.price).toBe(6_000);
    // Sans `listPrice`, une vente ajustée serait indistinguable d'une vente au
    // tarif, et « la parité change-t-elle quelque chose ? » resterait sans
    // réponse.
    expect(ligne.listPrice).toBe(10_000);
    expect(ligne.buyerCountry).toBe("CI");
    expect(ligne.pppDiscountBp).toBe(4_000);
  });

  it("note le pays même quand rien n'est ajusté", async () => {
    // C'est ce qui permet de savoir d'où viennent les ventes sans avoir à
    // instrumenter après coup.
    const { produit } = await creerRessource({ ppp: false });
    const acheteur = await creerAcheteur();

    const suite = await acheter({
      produitId: produit.id,
      acheteurId: acheteur.id,
      pays: "SN",
    });
    if (!suite.ok) throw new Error("achat refusé");

    const ligne = await db.orderItem.findUniqueOrThrow({
      where: { id: suite.orderItemId },
      select: { buyerCountry: true, pppDiscountBp: true, listPrice: true },
    });

    expect(ligne.buyerCountry).toBe("SN");
    expect(ligne.pppDiscountBp).toBe(0);
    expect(ligne.listPrice).toBeNull();
  });
});
