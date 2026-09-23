/**
 * L'upsell post-achat.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA RÈGLE QUI COMPTE EST CELLE QUI EMPÊCHE D'AFFICHER
 *
 * Proposer d'acheter ce qu'on vient d'acquérir ne produit aucune erreur,
 * aucune vente, et beaucoup de doute sur le sérieux de la plateforme. Le
 * vendeur, lui, ne voit rien : son offre est bien active, elle s'affiche
 * bien — simplement, personne ne clique.
 *
 * D'où cinq cas de non-affichage éprouvés : déjà acquis, dépubliée, sans
 * fichier, gratuite, la sienne.
 */

import { describe, expect, it } from "vitest";

import {
  basculerUnUpsell,
  declarerUnUpsell,
  listerLesUpsells,
  offreApresAchat,
} from "@/lib/commerce/upsell";
import { db } from "@/lib/db";

let n = 0;
const suffixe = () => `${Date.now()}-${++n}`;

async function creerVendeur() {
  return db.user.create({
    data: { email: `ups-v-${suffixe()}@baobart.test` },
    select: { id: true },
  });
}

async function creerProduit(
  vendeurId: string,
  options: { prix?: number; publie?: boolean; avecFichier?: boolean } = {},
) {
  const { prix = 5_000, publie = true, avecFichier = true } = options;

  const produit = await db.product.create({
    data: {
      sellerId: vendeurId,
      slug: `ups-${suffixe()}`,
      name: `Ressource ${suffixe()}`,
      price: prix,
      currency: "XOF",
      status: publie ? "PUBLISHED" : "DRAFT",
    },
    select: { id: true, slug: true },
  });

  if (avecFichier) {
    const media = await db.mediaAsset.create({
      data: {
        ownerId: vendeurId,
        purpose: "product",
        s3Key: `u/${suffixe()}.zip`,
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
  }

  return produit;
}

async function creerAcheteur() {
  return db.user.create({
    data: { email: `ups-a-${suffixe()}@baobart.test` },
    select: { id: true },
  });
}

/** Une acquisition aboutie, pour éprouver « déjà possédé ». */
async function faireAcquerir(acheteurId: string, produitId: string) {
  await db.order.create({
    data: {
      buyerId: acheteurId,
      total: 5_000,
      currency: "XOF",
      status: "COMPLETED",
      items: {
        create: {
          productId: produitId,
          quantity: 1,
          price: 5_000,
          state: "SUCCESSFUL",
        },
      },
    },
  });
}

describe("ce qu'on propose", () => {
  it("rend l'offre déclarée sur le déclencheur", async () => {
    const vendeur = await creerVendeur();
    const acheteur = await creerAcheteur();
    const declencheur = await creerProduit(vendeur.id);
    const offre = await creerProduit(vendeur.id);

    await declarerUnUpsell({
      vendeurId: vendeur.id,
      declencheurId: declencheur.id,
      offreId: offre.id,
      remisePourcent: 20,
    });

    const suite = await offreApresAchat({
      produitAchete: declencheur.id,
      acheteurId: acheteur.id,
    });

    expect(suite).not.toBeNull();
    expect(suite!.produitId).toBe(offre.id);
    expect(suite!.prix).toBe(5_000);
    expect(suite!.remisePourcent).toBe(20);
    expect(suite!.prixFinal).toBe(4_000);
  });

  it("rend le prix plein quand aucune remise n'est déclarée", async () => {
    const vendeur = await creerVendeur();
    const acheteur = await creerAcheteur();
    const declencheur = await creerProduit(vendeur.id);
    const offre = await creerProduit(vendeur.id);

    await declarerUnUpsell({
      vendeurId: vendeur.id,
      declencheurId: declencheur.id,
      offreId: offre.id,
    });

    const suite = await offreApresAchat({
      produitAchete: declencheur.id,
      acheteurId: acheteur.id,
    });

    expect(suite!.remisePourcent).toBeNull();
    expect(suite!.prixFinal).toBe(5_000);
  });

  it("rend null quand rien n'est déclaré", async () => {
    const vendeur = await creerVendeur();
    const acheteur = await creerAcheteur();
    const declencheur = await creerProduit(vendeur.id);

    expect(
      await offreApresAchat({
        produitAchete: declencheur.id,
        acheteurId: acheteur.id,
      }),
    ).toBeNull();
  });

  it("n'en rend qu'une, la plus récente", async () => {
    // En afficher trois transformerait la page de remerciement en catalogue.
    const vendeur = await creerVendeur();
    const acheteur = await creerAcheteur();
    const declencheur = await creerProduit(vendeur.id);
    const premiere = await creerProduit(vendeur.id);
    const seconde = await creerProduit(vendeur.id);

    await declarerUnUpsell({
      vendeurId: vendeur.id,
      declencheurId: declencheur.id,
      offreId: premiere.id,
    });
    await declarerUnUpsell({
      vendeurId: vendeur.id,
      declencheurId: declencheur.id,
      offreId: seconde.id,
    });

    const suite = await offreApresAchat({
      produitAchete: declencheur.id,
      acheteurId: acheteur.id,
    });

    expect(suite!.produitId).toBe(seconde.id);
  });
});

describe("ce qu'on ne propose pas", () => {
  async function avecUpsell(options: Parameters<typeof creerProduit>[1] = {}) {
    const vendeur = await creerVendeur();
    const acheteur = await creerAcheteur();
    const declencheur = await creerProduit(vendeur.id);
    const offre = await creerProduit(vendeur.id, options);

    await declarerUnUpsell({
      vendeurId: vendeur.id,
      declencheurId: declencheur.id,
      offreId: offre.id,
    });

    return { vendeur, acheteur, declencheur, offre };
  }

  it("ne propose pas ce que l'acheteur possède déjà", async () => {
    // LE CAS QUI COMPTE. Aucune erreur, aucune vente, et beaucoup de doute
    // sur le sérieux de la plateforme.
    const { acheteur, declencheur, offre } = await avecUpsell();
    await faireAcquerir(acheteur.id, offre.id);

    expect(
      await offreApresAchat({
        produitAchete: declencheur.id,
        acheteurId: acheteur.id,
      }),
    ).toBeNull();
  });

  it("ne propose pas ce qu'il est en train d'acheter", async () => {
    // Un achat `IN_PROGRESS` compte aussi : proposer d'acheter une seconde
    // fois ce qu'on vient de lancer produirait deux commandes du même bien.
    const { acheteur, declencheur, offre } = await avecUpsell();

    await db.order.create({
      data: {
        buyerId: acheteur.id,
        total: 5_000,
        currency: "XOF",
        items: { create: { productId: offre.id, quantity: 1, price: 5_000 } },
      },
    });

    expect(
      await offreApresAchat({
        produitAchete: declencheur.id,
        acheteurId: acheteur.id,
      }),
    ).toBeNull();
  });

  it("ne propose pas une ressource dépubliée", async () => {
    const { acheteur, declencheur } = await avecUpsell({ publie: false });

    expect(
      await offreApresAchat({
        produitAchete: declencheur.id,
        acheteurId: acheteur.id,
      }),
    ).toBeNull();
  });

  it("ne propose pas une ressource sans fichier", async () => {
    // L'acheteur paierait pour rien — c'est le même refus que l'achat.
    const { acheteur, declencheur } = await avecUpsell({ avecFichier: false });

    expect(
      await offreApresAchat({
        produitAchete: declencheur.id,
        acheteurId: acheteur.id,
      }),
    ).toBeNull();
  });

  it("ne propose pas une ressource gratuite", async () => {
    // Elle se télécharge, elle ne s'achète pas : proposer un bouton qui mène
    // à un refus est pire que ne rien proposer.
    const { acheteur, declencheur } = await avecUpsell({ prix: 0 });

    expect(
      await offreApresAchat({
        produitAchete: declencheur.id,
        acheteurId: acheteur.id,
      }),
    ).toBeNull();
  });

  it("ne propose pas sa propre ressource au vendeur", async () => {
    const vendeur = await creerVendeur();
    const declencheur = await creerProduit(vendeur.id);
    const offre = await creerProduit(vendeur.id);

    await declarerUnUpsell({
      vendeurId: vendeur.id,
      declencheurId: declencheur.id,
      offreId: offre.id,
    });

    expect(
      await offreApresAchat({
        produitAchete: declencheur.id,
        acheteurId: vendeur.id,
      }),
    ).toBeNull();
  });

  it("ne propose pas une offre désactivée", async () => {
    const vendeur = await creerVendeur();
    const acheteur = await creerAcheteur();
    const declencheur = await creerProduit(vendeur.id);
    const offre = await creerProduit(vendeur.id);

    const cree = await declarerUnUpsell({
      vendeurId: vendeur.id,
      declencheurId: declencheur.id,
      offreId: offre.id,
    });
    if (!cree.ok) throw new Error("déclaration refusée");

    await basculerUnUpsell(vendeur.id, cree.id, false);

    expect(
      await offreApresAchat({
        produitAchete: declencheur.id,
        acheteurId: acheteur.id,
      }),
    ).toBeNull();
  });
});

describe("la déclaration", () => {
  it("refuse de déclencher sur la ressource d'un autre", async () => {
    // Sans ce contrôle, on déclencherait sur la ressource d'un concurrent
    // pour proposer la sienne à ses acheteurs.
    const a = await creerVendeur();
    const b = await creerVendeur();
    const sienne = await creerProduit(a.id);
    const autre = await creerProduit(b.id);

    expect(
      await declarerUnUpsell({
        vendeurId: a.id,
        declencheurId: autre.id,
        offreId: sienne.id,
      }),
    ).toEqual({ ok: false, motif: "RESSOURCE_ETRANGERE" });
  });

  it("refuse de se proposer elle-même", async () => {
    const vendeur = await creerVendeur();
    const produit = await creerProduit(vendeur.id);

    expect(
      await declarerUnUpsell({
        vendeurId: vendeur.id,
        declencheurId: produit.id,
        offreId: produit.id,
      }),
    ).toEqual({ ok: false, motif: "MEME_RESSOURCE" });
  });

  it("refuse une remise hors bornes", async () => {
    const vendeur = await creerVendeur();
    const a = await creerProduit(vendeur.id);
    const b = await creerProduit(vendeur.id);

    for (const remise of [0, -10, 101, 5.5]) {
      expect(
        await declarerUnUpsell({
          vendeurId: vendeur.id,
          declencheurId: a.id,
          offreId: b.id,
          remisePourcent: remise,
        }),
      ).toEqual({ ok: false, motif: "REMISE_INVALIDE" });
    }
  });

  it("refuse deux fois le même couple", async () => {
    const vendeur = await creerVendeur();
    const a = await creerProduit(vendeur.id);
    const b = await creerProduit(vendeur.id);

    await declarerUnUpsell({
      vendeurId: vendeur.id,
      declencheurId: a.id,
      offreId: b.id,
    });

    expect(
      await declarerUnUpsell({
        vendeurId: vendeur.id,
        declencheurId: a.id,
        offreId: b.id,
      }),
    ).toEqual({ ok: false, motif: "DEJA_DECLAREE" });
  });
});

describe("la liste du vendeur", () => {
  it("marque orpheline une règle dont une ressource a disparu", async () => {
    // `Upsell` porte des identifiants nus : supprimer une ressource laisse
    // une règle qui ne déclenchera jamais, sans que rien ne l'efface. La
    // cacher ferait chercher pourquoi l'offre ne s'affiche pas.
    const vendeur = await creerVendeur();
    const a = await creerProduit(vendeur.id);
    const b = await creerProduit(vendeur.id);

    await declarerUnUpsell({
      vendeurId: vendeur.id,
      declencheurId: a.id,
      offreId: b.id,
    });

    await db.productFile.deleteMany({ where: { productId: b.id } });
    await db.product.delete({ where: { id: b.id } });

    const lignes = await listerLesUpsells(vendeur.id);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]!.orpheline).toBe(true);
    expect(lignes[0]!.offre).toBeNull();
  });

  it("ne bascule pas l'offre d'un autre vendeur", async () => {
    const a = await creerVendeur();
    const b = await creerVendeur();
    const un = await creerProduit(b.id);
    const deux = await creerProduit(b.id);

    const cree = await declarerUnUpsell({
      vendeurId: b.id,
      declencheurId: un.id,
      offreId: deux.id,
    });
    if (!cree.ok) throw new Error("déclaration refusée");

    expect(await basculerUnUpsell(a.id, cree.id, false)).toBe(false);
    expect((await listerLesUpsells(b.id))[0]!.actif).toBe(true);
  });
});
