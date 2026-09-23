/**
 * Les champs personnalisés au passage en caisse.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA VALIDATION EST LA SEULE CHOSE QUI COMPTE VRAIMENT ICI
 *
 * Le formulaire porte `required` et une liste de choix, et un navigateur les
 * fait respecter. Un `POST` direct n'en passe par aucun : un champ obligatoire
 * vide ou un choix inventé se retrouverait dans une vente **déjà payée**,
 * qu'on ne peut plus corriger.
 *
 * D'où des tests qui postent directement, sans passer par l'écran.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { acheter } from "@/lib/checkout/achat";
import {
  champsDe,
  declarerUnChamp,
  reponsesDe,
  retirerUnChamp,
  validerLesReponses,
  type ChampDeclare,
} from "@/lib/commerce/champs";
import { db } from "@/lib/db";

let n = 0;
const suffixe = () => `${Date.now()}-${++n}`;

async function creerVendeurEtProduit() {
  const vendeur = await db.user.create({
    data: { email: `ch-v-${suffixe()}@baobart.test` },
    select: { id: true },
  });

  const produit = await db.product.create({
    data: {
      sellerId: vendeur.id,
      slug: `ch-${suffixe()}`,
      name: "Affiche personnalisée",
      price: 8_000,
      currency: "XOF",
      status: "PUBLISHED",
    },
    select: { id: true },
  });

  const media = await db.mediaAsset.create({
    data: {
      ownerId: vendeur.id,
      purpose: "product",
      s3Key: `c/${suffixe()}.zip`,
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
      filename: "affiche.zip",
      sizeBytes: 1024,
      role: "SOURCE",
    },
  });

  return { vendeur, produit };
}

async function creerAcheteur() {
  return db.user.create({
    data: { email: `ch-a-${suffixe()}@baobart.test` },
    select: { id: true },
  });
}

const champ = (
  partiel: Partial<ChampDeclare> & Pick<ChampDeclare, "id" | "nom" | "type">,
): ChampDeclare => ({
  obligatoire: false,
  options: [],
  position: 0,
  ...partiel,
});

describe("la validation", () => {
  it("refuse un champ obligatoire laissé vide", async () => {
    const suite = validerLesReponses(
      [champ({ id: "c1", nom: "Dédicace", type: "TEXT", obligatoire: true })],
      {},
    );

    expect(suite).toEqual({ ok: false, motif: "MANQUANT", champ: "Dédicace" });
  });

  it("ne produit pas de réponse pour un champ facultatif vide", () => {
    // Écrire `{ nom: "Dédicace", valeur: "" }` ferait afficher au vendeur une
    // ligne vide qu'il lirait comme une réponse. L'absence se dit par
    // l'absence.
    const suite = validerLesReponses(
      [champ({ id: "c1", nom: "Dédicace", type: "TEXT" })],
      { c1: "   " },
    );

    expect(suite).toEqual({ ok: true, reponses: [] });
  });

  it("refuse un choix qui n'existe pas", () => {
    // Le formulaire n'offre que trois options ; un POST direct en propose ce
    // qu'il veut.
    const suite = validerLesReponses(
      [
        champ({
          id: "c1",
          nom: "Taille",
          type: "CHOICE",
          options: ["S", "M", "L"],
        }),
      ],
      { c1: "XXL" },
    );

    expect(suite).toEqual({
      ok: false,
      motif: "CHOIX_INCONNU",
      champ: "Taille",
    });
  });

  it("accepte un choix de la liste", () => {
    const suite = validerLesReponses(
      [
        champ({
          id: "c1",
          nom: "Taille",
          type: "CHOICE",
          options: ["S", "M", "L"],
        }),
      ],
      { c1: "M" },
    );

    expect(suite).toEqual({ ok: true, reponses: [{ nom: "Taille", valeur: "M" }] });
  });

  it("refuse une réponse trop longue", () => {
    const suite = validerLesReponses(
      [champ({ id: "c1", nom: "Dédicace", type: "TEXT" })],
      { c1: "x".repeat(201) },
    );

    expect(suite).toEqual({ ok: false, motif: "TROP_LONG", champ: "Dédicace" });
  });

  it("exige qu'une case obligatoire soit cochée", () => {
    // `TERMS` obligatoire veut dire « il faut cocher », pas « il faut
    // répondre » : une case décochée est un refus, pas un oubli.
    expect(
      validerLesReponses(
        [
          champ({
            id: "c1",
            nom: "Conditions de licence",
            type: "TERMS",
            obligatoire: true,
          }),
        ],
        {},
      ),
    ).toEqual({
      ok: false,
      motif: "MANQUANT",
      champ: "Conditions de licence",
    });

    expect(
      validerLesReponses(
        [
          champ({
            id: "c1",
            nom: "Conditions de licence",
            type: "TERMS",
            obligatoire: true,
          }),
        ],
        { c1: "on" },
      ),
    ).toEqual({
      ok: true,
      reponses: [{ nom: "Conditions de licence", valeur: "oui" }],
    });
  });

  it("ignore une case facultative décochée", () => {
    expect(
      validerLesReponses(
        [champ({ id: "c1", nom: "Newsletter", type: "BOOLEAN" })],
        {},
      ),
    ).toEqual({ ok: true, reponses: [] });
  });
});

describe("la déclaration", () => {
  it("refuse le type FILE, déclaré au schéma et non servi", async () => {
    // Le laisser passer donnerait un champ que l'acheteur voit et ne peut pas
    // remplir — et qui bloquerait l'achat s'il est obligatoire.
    const { vendeur, produit } = await creerVendeurEtProduit();

    expect(
      await declarerUnChamp({
        vendeurId: vendeur.id,
        produitId: produit.id,
        nom: "Ton logo",
        type: "FILE",
      }),
    ).toEqual({ ok: false, motif: "TYPE_NON_SERVI" });
  });

  it("refuse un CHOICE sans assez de choix", async () => {
    // Une liste déroulante vide : l'acheteur ne peut rien sélectionner, et si
    // le champ est obligatoire, l'achat devient impossible.
    const { vendeur, produit } = await creerVendeurEtProduit();

    expect(
      await declarerUnChamp({
        vendeurId: vendeur.id,
        produitId: produit.id,
        nom: "Taille",
        type: "CHOICE",
        options: ["M"],
      }),
    ).toEqual({ ok: false, motif: "CHOIX_MANQUANTS" });
  });

  it("refuse la ressource d'un autre vendeur", async () => {
    const a = await creerVendeurEtProduit();
    const b = await creerVendeurEtProduit();

    expect(
      await declarerUnChamp({
        vendeurId: a.vendeur.id,
        produitId: b.produit.id,
        nom: "Dédicace",
        type: "TEXT",
      }),
    ).toEqual({ ok: false, motif: "RESSOURCE_ETRANGERE" });
  });

  it("numérote les champs dans l'ordre de création", async () => {
    const { vendeur, produit } = await creerVendeurEtProduit();

    await declarerUnChamp({
      vendeurId: vendeur.id,
      produitId: produit.id,
      nom: "Premier",
      type: "TEXT",
    });
    await declarerUnChamp({
      vendeurId: vendeur.id,
      produitId: produit.id,
      nom: "Second",
      type: "TEXT",
    });

    const champs = await champsDe(produit.id);
    expect(champs.map((c) => c.nom)).toEqual(["Premier", "Second"]);
    expect(champs.map((c) => c.position)).toEqual([0, 1]);
  });

  it("ne retire pas le champ d'un autre vendeur", async () => {
    const a = await creerVendeurEtProduit();
    const b = await creerVendeurEtProduit();

    const cree = await declarerUnChamp({
      vendeurId: b.vendeur.id,
      produitId: b.produit.id,
      nom: "Dédicace",
      type: "TEXT",
    });
    if (!cree.ok) throw new Error("déclaration refusée");

    expect(await retirerUnChamp(a.vendeur.id, cree.id)).toBe(false);
    expect(await champsDe(b.produit.id)).toHaveLength(1);
  });

  it("écarte de la lecture un type que le schéma autorise mais qu'on ne sert pas", async () => {
    // Une ligne `FILE` peut exister — écrite par une version antérieure, ou à
    // la main. La rendre ferait afficher un champ qu'on ne sait pas remplir.
    const { produit } = await creerVendeurEtProduit();

    await db.customField.create({
      data: {
        productId: produit.id,
        name: "Ton logo",
        fieldType: "FILE",
        position: 0,
      },
    });

    expect(await champsDe(produit.id)).toHaveLength(0);
  });
});

describe("l'achat", () => {
  beforeEach(() => {
    process.env.CHECKOUT_SIMULATION_ENABLED = "true";
  });

  it("fige les réponses sur la ligne de commande", async () => {
    const { vendeur, produit } = await creerVendeurEtProduit();
    const acheteur = await creerAcheteur();

    const cree = await declarerUnChamp({
      vendeurId: vendeur.id,
      produitId: produit.id,
      nom: "Dédicace",
      type: "TEXT",
      obligatoire: true,
    });
    if (!cree.ok) throw new Error("déclaration refusée");

    const suite = await acheter({
      produitId: produit.id,
      acheteurId: acheteur.id,
      champs: { [cree.id]: "Pour Aya" },
    });

    expect(suite.ok).toBe(true);
    if (!suite.ok) return;

    const ligne = await db.orderItem.findUniqueOrThrow({
      where: { id: suite.orderItemId },
      select: { customFields: true },
    });

    expect(reponsesDe(ligne.customFields)).toEqual([
      { nom: "Dédicace", valeur: "Pour Aya" },
    ]);
  });

  it("refuse l'achat quand une réponse obligatoire manque", async () => {
    // Le cas du POST direct : le formulaire aurait refusé, pas le serveur.
    const { vendeur, produit } = await creerVendeurEtProduit();
    const acheteur = await creerAcheteur();

    await declarerUnChamp({
      vendeurId: vendeur.id,
      produitId: produit.id,
      nom: "Dédicace",
      type: "TEXT",
      obligatoire: true,
    });

    expect(
      await acheter({ produitId: produit.id, acheteurId: acheteur.id }),
    ).toEqual({ ok: false, motif: "CHAMPS_INVALIDES" });

    expect(await db.order.count({ where: { buyerId: acheteur.id } })).toBe(0);
  });

  it("garde le libellé d'alors, même si le champ est renommé après", async () => {
    // C'est tout l'intérêt de figer : relire la définition montrerait
    // « Taille : M » sous un champ devenu « Couleur ».
    const { vendeur, produit } = await creerVendeurEtProduit();
    const acheteur = await creerAcheteur();

    const cree = await declarerUnChamp({
      vendeurId: vendeur.id,
      produitId: produit.id,
      nom: "Taille",
      type: "TEXT",
    });
    if (!cree.ok) throw new Error("déclaration refusée");

    const suite = await acheter({
      produitId: produit.id,
      acheteurId: acheteur.id,
      champs: { [cree.id]: "M" },
    });
    if (!suite.ok) throw new Error("achat refusé");

    await db.customField.update({
      where: { id: cree.id },
      data: { name: "Couleur" },
    });

    const ligne = await db.orderItem.findUniqueOrThrow({
      where: { id: suite.orderItemId },
      select: { customFields: true },
    });

    expect(reponsesDe(ligne.customFields)[0]!.nom).toBe("Taille");
  });

  it("n'écrit rien quand la ressource n'a aucun champ", async () => {
    const { produit } = await creerVendeurEtProduit();
    const acheteur = await creerAcheteur();

    const suite = await acheter({
      produitId: produit.id,
      acheteurId: acheteur.id,
    });
    if (!suite.ok) throw new Error("achat refusé");

    const ligne = await db.orderItem.findUniqueOrThrow({
      where: { id: suite.orderItemId },
      select: { customFields: true },
    });

    expect(ligne.customFields).toBeNull();
  });
});
