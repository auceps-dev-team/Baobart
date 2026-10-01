/**
 * Le montant choisi par l'acheteur — prix libre et pourboire.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TROIS CHOSES QUI NE SE VOIENT QUE BOUT À BOUT
 *
 * Le calcul de `retenirLeMontant` est pur et se teste seul. Ce qui demande une
 * vraie base, c'est ce qui arrive **après** : le pourboire entre-t-il dans le
 * brut sur lequel on prélève, se rembourse-t-il, et une ressource à prix libre
 * dont le prix suggéré vaut zéro se vend-elle vraiment ?
 *
 * Cette dernière est la plus traître : `acheter` refuse un prix nul depuis
 * toujours, avec une bonne raison. La règle devait changer sans s'effondrer.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { acheter } from "@/lib/checkout/achat";
import {
  MESSAGES_MONTANT,
  PLAFOND_POURBOIRE,
  estOfferte,
  libelleDuPrix,
  minimumLibre,
  montantsSuggeres,
  retenirLeMontant,
} from "@/lib/commerce/montant";
import { autoriserTelechargement } from "@/lib/domain/downloads";
import { formatMoney } from "@/lib/i18n/money";
import { droitDeTelecharger } from "@/lib/products/queries";
import { db } from "@/lib/db";
import { computeFees } from "@/lib/domain/fees";
import { rembourserLigne } from "@/lib/domain/orders";

let n = 0;
const suffixe = () => `${Date.now()}-${++n}`;

async function creerRessource(options: {
  mode?: "FIXED" | "LIBRE";
  prix?: number;
  minPrice?: number | null;
  pourboires?: boolean;
}) {
  const {
    mode = "FIXED",
    prix = 5_000,
    minPrice = null,
    pourboires = false,
  } = options;

  const vendeur = await db.user.create({
    data: { email: `mt-v-${suffixe()}@baobart.test`, defaultCurrency: "XOF" },
    select: { id: true },
  });

  const produit = await db.product.create({
    data: {
      sellerId: vendeur.id,
      slug: `mt-${suffixe()}`,
      name: "Soutiens le travail",
      price: prix,
      currency: "XOF",
      status: "PUBLISHED",
      pricingMode: mode,
      minPrice,
      tipsEnabled: pourboires,
    },
    select: { id: true },
  });

  const media = await db.mediaAsset.create({
    data: {
      ownerId: vendeur.id,
      purpose: "product",
      s3Key: `m/${suffixe()}.zip`,
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
      filename: "merci.zip",
      sizeBytes: 1024,
      role: "SOURCE",
    },
  });

  return { vendeur, produit };
}

async function creerAcheteur() {
  return db.user.create({
    data: { email: `mt-a-${suffixe()}@baobart.test`, defaultCurrency: "XOF" },
    select: { id: true },
  });
}

describe("la retenue du montant", () => {
  const fixe = {
    mode: "FIXED" as const,
    prix: 5_000,
    minPrice: null,
    pourboiresOuverts: false,
  };

  it("garde le prix du créateur en mode fixe", () => {
    expect(retenirLeMontant(fixe)).toEqual({
      ok: true,
      prix: 5_000,
      pourboire: 0,
      total: 5_000,
    });
  });

  it("ignore un montant envoyé sur une ressource à prix fixe", () => {
    // Ignoré, pas refusé : refuser révélerait qu'il existe un chemin où il
    // compterait.
    expect(retenirLeMontant({ ...fixe, montantChoisi: "1" })).toEqual({
      ok: true,
      prix: 5_000,
      pourboire: 0,
      total: 5_000,
    });
  });

  it("ignore un pourboire que le créateur n'invite pas", () => {
    // Sans ce filtre, on facturerait un supplément que le créateur n'a jamais
    // proposé, sur une fiche qui ne l'annonce pas.
    expect(retenirLeMontant({ ...fixe, pourboireChoisi: "2000" }).ok).toBe(true);
    expect(
      (retenirLeMontant({ ...fixe, pourboireChoisi: "2000" }) as { pourboire: number })
        .pourboire,
    ).toBe(0);
  });

  it("retient le pourboire quand il est invité", () => {
    expect(
      retenirLeMontant({ ...fixe, pourboiresOuverts: true, pourboireChoisi: "2000" }),
    ).toEqual({ ok: true, prix: 5_000, pourboire: 2_000, total: 7_000 });
  });

  it("tolère les espaces et les points de milliers", () => {
    // « 2 500 » et « 2.500 » sont ce qu'on tape naturellement ; les refuser
    // ferait échouer une saisie correcte pour une question de typographie.
    for (const forme of ["2 500", "2.500", " 2500 "]) {
      const suite = retenirLeMontant({
        ...fixe,
        pourboiresOuverts: true,
        pourboireChoisi: forme,
      });
      expect(suite.ok).toBe(true);
      expect((suite as { pourboire: number }).pourboire).toBe(2_500);
    }
  });

  it("refuse un point qui ne sépare pas des milliers", () => {
    // Mesuré le 25/09 (Qualitytest R24) : « 5000.5 » dans le montant libre
    // est devenu une commande de 50 005 F, sans un mot.
    for (const forme of ["5000.5", "5.5", "25.00", "2,500", "2500,00", "1.00.000", "12 34"]) {
      expect(
        retenirLeMontant({
          mode: "LIBRE",
          prix: 2_000,
          minPrice: 1_000,
          pourboiresOuverts: false,
          montantChoisi: forme,
        }),
        forme,
      ).toEqual({ ok: false, motif: "INVALIDE" });
    }
  });

  it("garde les vrais séparateurs de milliers, y compris l'espace insécable", () => {
    for (const [forme, attendu] of [
      ["5 000", 5_000],
      ["5.000", 5_000],
      ["1.000.000", 1_000_000],
      ["12 345", 12_345],
      ["5 000", 5_000],
      ["5 000", 5_000],
      ["15000", 15_000],
    ] as const) {
      const suite = retenirLeMontant({
        mode: "LIBRE",
        prix: 2_000,
        minPrice: 1_000,
        pourboiresOuverts: false,
        montantChoisi: forme,
      });
      expect(suite, forme).toEqual({ ok: true, prix: attendu, pourboire: 0, total: attendu });
    }
  });

  it("traite un champ vide comme « pas de pourboire »", () => {
    expect(
      (
        retenirLeMontant({
          ...fixe,
          pourboiresOuverts: true,
          pourboireChoisi: "",
        }) as { pourboire: number }
      ).pourboire,
    ).toBe(0);
  });

  it("refuse ce qui n'est pas un nombre", () => {
    expect(
      retenirLeMontant({
        ...fixe,
        pourboiresOuverts: true,
        pourboireChoisi: "beaucoup",
      }),
    ).toEqual({ ok: false, motif: "INVALIDE" });
  });

  it("refuse un pourboire au-dessus du plafond de saisie", () => {
    // Un zéro de trop se tape vite. Sans ce garde-fou, la somme partirait
    // chez l'opérateur telle quelle, et le refus tomberait sur le téléphone
    // de l'acheteur, sans explication.
    expect(
      retenirLeMontant({
        ...fixe,
        pourboiresOuverts: true,
        pourboireChoisi: PLAFOND_POURBOIRE + 1,
      }),
    ).toEqual({ ok: false, motif: "POURBOIRE_TROP_HAUT" });
  });

  it("refuse un montant libre sous le plancher du créateur", () => {
    const suite = retenirLeMontant({
      mode: "LIBRE",
      prix: 2_000,
      minPrice: 1_000,
      pourboiresOuverts: false,
      montantChoisi: "500",
    });

    expect(suite.ok).toBe(false);
    if (suite.ok) return;
    expect(suite.motif).toBe("TROP_BAS");
    expect(suite.minimum).toBe(1_000);
  });

  it("accepte un montant libre au-dessus du plancher", () => {
    expect(
      retenirLeMontant({
        mode: "LIBRE",
        prix: 2_000,
        minPrice: 1_000,
        pourboiresOuverts: false,
        montantChoisi: "7500",
      }),
    ).toEqual({ ok: true, prix: 7_500, pourboire: 0, total: 7_500 });
  });

  it("le plancher du créateur ne peut pas descendre sous celui de la plateforme", () => {
    // Le lui laisser produirait des ventes que l'opérateur refuse, après les
    // avoir ouvertes — c'est-à-dire devant l'acheteur.
    expect(minimumLibre(0)).toBeGreaterThan(0);
    expect(minimumLibre(null)).toBeGreaterThan(0);
    expect(minimumLibre(10_000)).toBe(10_000);
  });

  it("a un message pour chaque refus", () => {
    // Un motif sans message s'afficherait vide à l'écran.
    for (const motif of ["TROP_BAS", "INVALIDE", "POURBOIRE_TROP_HAUT"] as const) {
      expect(MESSAGES_MONTANT[motif]).toBeTruthy();
    }
  });
});

describe("les montants suggérés", () => {
  it("reprend ceux du créateur, triés et sans doublon", () => {
    expect(montantsSuggeres(1_000, 500, [2_000, 1_000, 2_000, 5_000])).toEqual([
      1_000, 2_000, 5_000,
    ]);
  });

  it("en dérive du prix quand le créateur n'en a posé aucun", () => {
    // Un écran nu sur une ressource qu'il n'a pas fini de régler ne sert
    // personne.
    expect(montantsSuggeres(1_000, null, [])).toEqual([1_000, 2_000, 5_000]);
  });

  it("écarte ceux qui passent sous le plancher", () => {
    expect(montantsSuggeres(5_000, 2_000, [500, 3_000])).toEqual([3_000]);
  });
});

describe("l'achat", () => {
  beforeEach(() => {
    process.env.CHECKOUT_SIMULATION_ENABLED = "true";
  });

  it("facture le montant choisi sur une ressource à prix libre", async () => {
    const { produit } = await creerRessource({
      mode: "LIBRE",
      prix: 1_000,
      minPrice: 500,
    });
    const acheteur = await creerAcheteur();

    const suite = await acheter({
      produitId: produit.id,
      acheteurId: acheteur.id,
      montant: "7500",
    });

    expect(suite.ok).toBe(true);
    if (!suite.ok) return;

    const ligne = await db.orderItem.findUniqueOrThrow({
      where: { id: suite.orderItemId },
      select: { price: true, tipAmount: true },
    });

    expect(ligne.price).toBe(7_500);
    expect(ligne.tipAmount).toBe(0);
  });

  it("vend une ressource à prix libre dont le prix suggéré vaut zéro", async () => {
    // LE CAS QUI COMPTE. `acheter` refuse un prix nul depuis toujours — avec
    // raison : une ressource offerte se télécharge sans commande. Mais en
    // `LIBRE`, zéro veut dire « le créateur n'a pas suggéré de montant », et
    // l'acheteur va en donner un. Refuser rendrait impossible de soutenir
    // quelqu'un qui offre son travail.
    const { produit } = await creerRessource({
      mode: "LIBRE",
      prix: 0,
      minPrice: 500,
    });
    const acheteur = await creerAcheteur();

    const suite = await acheter({
      produitId: produit.id,
      acheteurId: acheteur.id,
      montant: "3000",
    });

    expect(suite.ok).toBe(true);
    if (!suite.ok) return;
    expect(
      (
        await db.orderItem.findUniqueOrThrow({
          where: { id: suite.orderItemId },
          select: { price: true },
        })
      ).price,
    ).toBe(3_000);
  });

  it("refuse toujours une ressource gratuite à prix fixe", async () => {
    // L'autre sens : la règle d'origine tient partout ailleurs.
    const { produit } = await creerRessource({ mode: "FIXED", prix: 0 });
    const acheteur = await creerAcheteur();

    expect(
      await acheter({ produitId: produit.id, acheteurId: acheteur.id }),
    ).toEqual({ ok: false, motif: "GRATUITE" });
  });

  it("refuse un montant libre sous le plancher", async () => {
    const { produit } = await creerRessource({
      mode: "LIBRE",
      prix: 5_000,
      minPrice: 2_000,
    });
    const acheteur = await creerAcheteur();

    expect(
      await acheter({
        produitId: produit.id,
        acheteurId: acheteur.id,
        montant: "100",
      }),
      // La raison et le minimum voyagent jusqu'à la fiche : sans eux, elle
      // n'avait rien à dire (mesuré le 25/09, P5.1).
    ).toEqual({
      ok: false,
      motif: "MONTANT_REFUSE",
      montant: { motif: "TROP_BAS", minimum: 2_000 },
    });

    expect(await db.order.count({ where: { buyerId: acheteur.id } })).toBe(0);
  });

  it("enregistre le pourboire à part, et l'ajoute au total", async () => {
    const { produit } = await creerRessource({ prix: 5_000, pourboires: true });
    const acheteur = await creerAcheteur();

    const suite = await acheter({
      produitId: produit.id,
      acheteurId: acheteur.id,
      pourboire: "2000",
    });

    expect(suite.ok).toBe(true);
    if (!suite.ok) return;
    expect(suite.pourboire).toBe(2_000);

    const ligne = await db.orderItem.findUniqueOrThrow({
      where: { id: suite.orderItemId },
      select: { price: true, tipAmount: true, order: { select: { total: true } } },
    });

    // Chaque colonne dit une chose : le prix de la ressource, et ce qu'on a
    // donné en plus. Les additionner dans `price` rendrait impossible de
    // répondre à « combien mes acheteurs donnent-ils ? ».
    expect(ligne.price).toBe(5_000);
    expect(ligne.tipAmount).toBe(2_000);
    expect(ligne.order.total).toBe(7_000);
  });

  it("prélève les frais sur le pourboire aussi", async () => {
    // Il emprunte le même rail de paiement, qui coûte le même pourcentage.
    const { vendeur, produit } = await creerRessource({
      prix: 5_000,
      pourboires: true,
    });
    const acheteur = await creerAcheteur();

    const suite = await acheter({
      produitId: produit.id,
      acheteurId: acheteur.id,
      pourboire: "2000",
    });
    if (!suite.ok) throw new Error("achat refusé");

    const attendu = computeFees({
      unitPrice: 5_000,
      quantity: 1,
      regime: "DIRECT",
      tipAmount: 2_000,
    });
    expect(attendu.gross).toBe(7_000);

    // `issuedNet` : ce qui alimente réellement le solde du vendeur, dans la
    // devise d'encaissement. Le nom de la colonne compte — `issuedGross`
    // porterait le brut et le test passerait pour une mauvaise raison.
    const ecritures = await db.balanceTransaction.findMany({
      where: { userId: vendeur.id },
      select: { issuedNet: true, issuedGross: true },
    });

    const net = ecritures.reduce((t, e) => t + e.issuedNet, 0);
    const brut = ecritures.reduce((t, e) => t + e.issuedGross, 0);

    expect(brut).toBe(7_000);
    expect(net).toBe(attendu.sellerNet);
  });

  it("rembourse le pourboire avec le reste", async () => {
    // Rendre tout sauf ce qu'on a donné par bonne volonté serait
    // indéfendable — et personne ne comprendrait que la générosité soit la
    // seule chose non remboursable.
    const { produit } = await creerRessource({ prix: 5_000, pourboires: true });
    const acheteur = await creerAcheteur();

    const suite = await acheter({
      produitId: produit.id,
      acheteurId: acheteur.id,
      pourboire: "2000",
    });
    if (!suite.ok) throw new Error("achat refusé");

    // Le plafond de remboursement est la somme des deux : 7 000 passe.
    await rembourserLigne({ orderItemId: suite.orderItemId, amount: 7_000 });

    const ligne = await db.orderItem.findUniqueOrThrow({
      where: { id: suite.orderItemId },
      select: { refundedAmount: true },
    });
    expect(ligne.refundedAmount).toBe(7_000);
  });

  it("refuse de rembourser plus que le prix et le pourboire réunis", async () => {
    const { produit } = await creerRessource({ prix: 5_000, pourboires: true });
    const acheteur = await creerAcheteur();

    const suite = await acheter({
      produitId: produit.id,
      acheteurId: acheteur.id,
      pourboire: "2000",
    });
    if (!suite.ok) throw new Error("achat refusé");

    await expect(
      rembourserLigne({ orderItemId: suite.orderItemId, amount: 7_001 }),
    ).rejects.toThrow(RangeError);
  });
});

describe("ce qui est offert", () => {
  it("n'offre qu'un prix fixe à zéro — jamais un prix libre", () => {
    expect(estOfferte({ pricingMode: "FIXED", price: 0 })).toBe(true);
    expect(estOfferte({ pricingMode: "FIXED", price: 5_000 })).toBe(false);
    // En prix libre, zéro veut dire « pas de suggestion » : le produit
    // « coffee » se vend, minimum ou pas.
    expect(estOfferte({ pricingMode: "LIBRE", price: 0 })).toBe(false);
  });

  it("affiche le plancher d'un prix libre, pas « GRATUIT »", () => {
    expect(libelleDuPrix({ pricingMode: "FIXED", price: 0, minPrice: null, currency: "XOF" })).toBe("GRATUIT");
    expect(libelleDuPrix({ pricingMode: "FIXED", price: 8_000, minPrice: null, currency: "XOF" })).toBe(formatMoney(8_000));
    expect(libelleDuPrix({ pricingMode: "LIBRE", price: 0, minPrice: 1_000, currency: "XOF" })).toBe(`dès ${formatMoney(1_000)}`);
    expect(libelleDuPrix({ pricingMode: "LIBRE", price: 0, minPrice: null, currency: "XOF" })).toBe("Prix libre");
  });

  it("ne laisse pas télécharger sans payer un prix libre à suggestion nulle", async () => {
    // Le cas mesuré le 25/09 (Qualitytest P5.4) : minimum 1 000 F, suggestion
    // 0 — la fiche disait « GRATUIT · Télécharger », et le fichier partait.
    const { produit } = await creerRessource({ mode: "LIBRE", prix: 0, minPrice: 1_000 });
    const acheteur = await creerAcheteur();
    const fichier = await db.productFile.findFirstOrThrow({ where: { productId: produit.id }, select: { id: true } });

    const droit = await droitDeTelecharger(produit.id, acheteur.id);
    expect(droit.etat).toBe("A_ACHETER");
    expect(droit.etat === "A_ACHETER" ? droit.prix : null).toBe(`dès ${formatMoney(1_000)}`);

    const { decision } = await autoriserTelechargement({ userId: acheteur.id, productFileId: fichier.id });
    expect(decision.autorise).toBe(false);
    expect(await db.consumptionEvent.count({ where: { productId: produit.id } })).toBe(0);
  });

  it("laisse toujours télécharger une ressource offerte", async () => {
    const { produit } = await creerRessource({ mode: "FIXED", prix: 0 });
    const acheteur = await creerAcheteur();
    const fichier = await db.productFile.findFirstOrThrow({ where: { productId: produit.id }, select: { id: true } });

    expect((await droitDeTelecharger(produit.id, acheteur.id)).etat).toBe("TELECHARGEABLE");
    expect((await autoriserTelechargement({ userId: acheteur.id, productFileId: fichier.id })).decision.autorise).toBe(true);
  });
});
