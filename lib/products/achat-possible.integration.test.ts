/**
 * Le bouton d'achat apparaît exactement quand un achat peut aboutir.
 *
 * C'est une équivalence, pas une approximation, et elle mérite d'être tenue
 * des deux côtés. Un bouton absent alors que l'achat marcherait fait perdre
 * des ventes en silence. Un bouton présent alors que l'action refusera promet
 * un écran qui n'ouvre sur rien — et l'acheteur, lui, croit avoir échoué.
 *
 * Le cas qui a motivé ces tests : la condition ne regardait que la simulation
 * de développement. Brancher un opérateur réel aurait laissé le bouton
 * invisible en production, sans que rien ne le signale.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { renouvellementPossible } from "@/lib/abonnements/renouvellement";
import { encaissementPossible } from "@/lib/checkout/achat";
import { droitDeTelecharger } from "@/lib/products/queries";

const AVANT = {
  simulation: process.env.CHECKOUT_SIMULATION_ENABLED,
  driver: process.env.PAYMENTS_DRIVER,
  secret: process.env.PAYMENTS_SANDBOX_SECRET,
  url: process.env.APP_URL,
};

function ferme() {
  delete process.env.CHECKOUT_SIMULATION_ENABLED;
  delete process.env.PAYMENTS_DRIVER;
  delete process.env.PAYMENTS_SANDBOX_SECRET;
  process.env.APP_URL = "https://baobart.test";
}

beforeEach(ferme);

afterEach(() => {
  for (const [cle, valeur] of [
    ["CHECKOUT_SIMULATION_ENABLED", AVANT.simulation],
    ["PAYMENTS_DRIVER", AVANT.driver],
    ["PAYMENTS_SANDBOX_SECRET", AVANT.secret],
    ["APP_URL", AVANT.url],
  ] as const) {
    if (valeur === undefined) delete process.env[cle];
    else process.env[cle] = valeur;
  }
});

let n = 0;

async function creerUtilisateur(role: string) {
  n += 1;
  return db.user.create({
    data: {
      email: `${role}-ap-${n}@baobart.test`,
      profile: { create: { username: `${role}-ap-${n}`, displayName: `${role} ${n}` } },
    },
    select: { id: true },
  });
}

async function creerProduitVendable(vendeurId: string) {
  n += 1;
  const produit = await db.product.create({
    data: {
      sellerId: vendeurId,
      name: `Ressource ap ${n}`,
      slug: `ressource-ap-${n}`,
      price: 5_000,
      currency: "XOF",
      status: "PUBLISHED",
    },
    select: { id: true, slug: true },
  });

  const media = await db.mediaAsset.create({
    data: {
      ownerId: vendeurId,
      purpose: "product",
      s3Key: `produits/${produit.id}/f-${n}.zip`,
      checksum: "x",
      contentType: "application/zip",
      sizeBytes: 1024,
      status: "READY",
    },
    select: { id: true },
  });

  await db.productFile.create({
    data: {
      productId: produit.id,
      mediaId: media.id,
      filename: `f-${n}.zip`,
      sizeBytes: 1024,
      role: "SOURCE",
      position: 0,
    },
  });

  return produit;
}

async function scene() {
  const vendeur = await creerUtilisateur("vendeur");
  const acheteur = await creerUtilisateur("acheteur");
  const produit = await creerProduitVendable(vendeur.id);
  return { vendeur, acheteur, produit };
}

async function droit(produitId: string, userId: string) {
  return droitDeTelecharger(produitId, userId);
}

describe("le bouton d'achat", () => {
  it("reste caché quand rien ne permet d'encaisser", async () => {
    const { produit, acheteur } = await scene();

    const d = await droit(produit.id, acheteur.id);
    expect(d.etat).toBe("A_ACHETER");
    expect(d.etat === "A_ACHETER" && d.achatPossible).toBe(false);
  });

  it("apparaît quand la simulation est ouverte", async () => {
    const { produit, acheteur } = await scene();
    process.env.CHECKOUT_SIMULATION_ENABLED = "1";

    const d = await droit(produit.id, acheteur.id);
    expect(d.etat === "A_ACHETER" && d.achatPossible).toBe(true);
  });

  it("apparaît quand un opérateur est branché, sans simulation", async () => {
    const { produit, acheteur } = await scene();
    process.env.PAYMENTS_DRIVER = "bac-a-sable";
    process.env.PAYMENTS_SANDBOX_SECRET = "un-secret-de-bac-a-sable-assez-long";

    const d = await droit(produit.id, acheteur.id);
    expect(d.etat === "A_ACHETER" && d.achatPossible).toBe(true);
  });

  it("reste caché si l'opérateur est nommé mais son secret absent", async () => {
    // Un opérateur à moitié branché encaisse peut-être, mais personne ne sait
    // dire si l'argent est arrivé. Le pilote se déclare alors « aucun ».
    const { produit, acheteur } = await scene();
    process.env.PAYMENTS_DRIVER = "bac-a-sable";

    const d = await droit(produit.id, acheteur.id);
    expect(d.etat === "A_ACHETER" && d.achatPossible).toBe(false);
  });

  it("reste caché sans adresse publique : l'opérateur n'aurait où renvoyer personne", async () => {
    const { produit, acheteur } = await scene();
    process.env.PAYMENTS_DRIVER = "bac-a-sable";
    process.env.PAYMENTS_SANDBOX_SECRET = "un-secret-de-bac-a-sable-assez-long";
    delete process.env.APP_URL;

    const d = await droit(produit.id, acheteur.id);
    expect(d.etat === "A_ACHETER" && d.achatPossible).toBe(false);
  });

  it("reste caché sur sa propre ressource, opérateur ou pas", async () => {
    // Se l'acheter reviendrait à se créditer son propre argent, frais en moins.
    const { produit, vendeur } = await scene();
    process.env.CHECKOUT_SIMULATION_ENABLED = "1";

    const d = await droit(produit.id, vendeur.id);
    expect(d.etat === "A_ACHETER" && d.achatPossible).toBe(false);
  });
});

describe("une seule règle pour tous les écrans", () => {
  // La fiche et le renouvellement en tenaient chacun une copie ; l'historique
  // des achats n'en lisait aucune et affichait en dur « Le paiement n'est pas
  // encore branché » (mesuré le 25/09, Qualitytest D11).
  const cas: Array<[string, () => void, boolean]> = [
    ["rien de branché", () => {}, false],
    ["simulation ouverte", () => { process.env.CHECKOUT_SIMULATION_ENABLED = "1"; }, true],
    ["opérateur branché", () => { process.env.PAYMENTS_DRIVER = "bac-a-sable"; process.env.PAYMENTS_SANDBOX_SECRET = "un-secret-de-bac-a-sable-assez-long"; }, true],
    ["opérateur sans secret", () => { process.env.PAYMENTS_DRIVER = "bac-a-sable"; }, false],
    ["opérateur sans adresse publique", () => { process.env.PAYMENTS_DRIVER = "bac-a-sable"; process.env.PAYMENTS_SANDBOX_SECRET = "un-secret-de-bac-a-sable-assez-long"; delete process.env.APP_URL; }, false],
  ];

  for (const [nom, poser, attendu] of cas) {
    it(`${nom} : la fiche, le renouvellement et l'historique répondent pareil`, () => {
      poser();
      expect(encaissementPossible()).toBe(attendu);
      expect(renouvellementPossible()).toBe(attendu);
    });
  }
});

