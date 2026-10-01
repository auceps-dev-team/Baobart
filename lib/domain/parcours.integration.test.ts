/**
 * Le parcours complet, contre une vraie base : acheter → encaisser → créditer
 * le créateur → télécharger.
 *
 * Ces tests ne vérifient pas la logique (les tests unitaires s'en chargent) :
 * ils vérifient que le **câblage** tient — transactions, triggers, quotas,
 * compteurs.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { soldeVersableJusqua } from "@/lib/domain/balances";
import { autoriserTelechargement } from "@/lib/domain/downloads";
import { encaisserLigne, rembourserLigne } from "@/lib/domain/orders";
import { REGLAGES_PAR_DEFAUT } from "@/lib/ndank/cycle";

const MO = 1024 * 1024;

async function creerCreateur(suffixe = "") {
  return db.user.create({
    data: { email: `awa${suffixe}@baobart.test`, defaultCurrency: "XOF" },
  });
}

async function creerProduitAvecFichier(sellerId: string, prix: number) {
  const produit = await db.product.create({
    data: {
      sellerId,
      slug: `pack-wax-${Math.random().toString(36).slice(2, 9)}`,
      name: "Pack motifs wax",
      price: prix,
      currency: "XOF",
      status: "PUBLISHED",
    },
  });

  const media = await db.mediaAsset.create({
    data: {
      ownerId: sellerId,
      purpose: "product",
      s3Key: `produits/${produit.id}/pack.zip`,
      checksum: "abc",
      sizeBytes: 200 * MO,
      contentType: "application/zip",
      status: "READY",
    },
  });

  const fichier = await db.productFile.create({
    data: {
      productId: produit.id,
      mediaId: media.id,
      filename: "pack-motifs-wax.zip",
      sizeBytes: 200 * MO,
    },
  });

  return { produit, fichier };
}

async function creerCommande(buyerId: string, productId: string, prix: number) {
  const commande = await db.order.create({
    data: { buyerId, total: prix, currency: "XOF", status: "IN_PROGRESS" },
  });

  return db.orderItem.create({
    data: { orderId: commande.id, productId, price: prix, quantity: 1 },
  });
}

describe("encaissement d'une vente", () => {
  let createur: Awaited<ReturnType<typeof creerCreateur>>;
  let acheteur: Awaited<ReturnType<typeof creerCreateur>>;

  beforeEach(async () => {
    createur = await creerCreateur("-vendeuse");
    acheteur = await creerCreateur("-acheteur");
  });

  it("fige les frais, crédite le créateur et écrit au grand livre", async () => {
    const { produit } = await creerProduitAvecFichier(createur.id, 10_000);
    const ligne = await creerCommande(acheteur.id, produit.id, 10_000);

    const { frais, mouvement } = await encaisserLigne({
      orderItemId: ligne.id,
      regime: "DIRECT",
    });

    // La ligne porte la décomposition, figée.
    const relue = await db.orderItem.findUniqueOrThrow({ where: { id: ligne.id } });
    expect(relue.state).toBe("SUCCESSFUL");
    expect(relue.platformFee).toBe(1_000);
    expect(relue.processorFee).toBe(150);

    // Le créateur a été crédité de son net, et de rien d'autre.
    const solde = await db.balance.findFirstOrThrow({
      where: { userId: createur.id },
    });
    expect(solde.holdingAmount).toBe(frais.sellerNet);
    expect(solde.state).toBe("UNPAID");

    // Le mouvement porte les deux devises et les deux niveaux.
    expect(mouvement).toMatchObject({
      type: "SALE",
      issuedGross: 10_000,
      issuedNet: frais.sellerNet,
      issuedCurrency: "XOF",
      holdingCurrency: "XOF",
    });
  });

  it("prélève davantage quand la vente vient du feed", async () => {
    const { produit } = await creerProduitAvecFichier(createur.id, 10_000);
    const l1 = await creerCommande(acheteur.id, produit.id, 10_000);
    const direct = await encaisserLigne({ orderItemId: l1.id, regime: "DIRECT" });

    const l2 = await creerCommande(acheteur.id, produit.id, 10_000);
    const feed = await encaisserLigne({
      orderItemId: l2.id,
      regime: "DECOUVERTE",
    });

    expect(feed.frais.sellerNet).toBeLessThan(direct.frais.sellerNet);
  });

  it("regroupe deux ventes du même jour sur un seul solde", async () => {
    const { produit } = await creerProduitAvecFichier(createur.id, 5_000);
    const l1 = await creerCommande(acheteur.id, produit.id, 5_000);
    const l2 = await creerCommande(acheteur.id, produit.id, 5_000);

    await encaisserLigne({ orderItemId: l1.id, regime: "DIRECT" });
    await encaisserLigne({ orderItemId: l2.id, regime: "DIRECT" });

    const soldes = await db.balance.findMany({ where: { userId: createur.id } });
    expect(soldes).toHaveLength(1);

    const mouvements = await db.balanceTransaction.findMany({
      where: { userId: createur.id },
    });
    expect(mouvements).toHaveLength(2);
  });

  it("livre un produit gratuit sans rien encaisser", async () => {
    const { produit } = await creerProduitAvecFichier(createur.id, 0);
    const ligne = await creerCommande(acheteur.id, produit.id, 0);

    const { mouvement } = await encaisserLigne({
      orderItemId: ligne.id,
      regime: "DIRECT",
    });

    const relue = await db.orderItem.findUniqueOrThrow({ where: { id: ligne.id } });
    expect(relue.state).toBe("NOT_CHARGED");
    expect(mouvement).toBeNull();
    expect(await db.balance.count({ where: { userId: createur.id } })).toBe(0);
  });

  it("refuse d'encaisser deux fois la même ligne", async () => {
    const { produit } = await creerProduitAvecFichier(createur.id, 10_000);
    const ligne = await creerCommande(acheteur.id, produit.id, 10_000);

    await encaisserLigne({ orderItemId: ligne.id, regime: "DIRECT" });
    await expect(
      encaisserLigne({ orderItemId: ligne.id, regime: "DIRECT" }),
    ).rejects.toThrow(/déjà en état/);

    expect(
      await db.balanceTransaction.count({ where: { userId: createur.id } }),
    ).toBe(1);
  });
});

describe("remboursement", () => {
  // Les deux titres ci-dessous décrivaient la règle de v0.7.0 — débit au
  // prorata du net. Depuis la décision d'août 2026 (v1.25.0), le vendeur
  // finance le remboursement brut ; les corps l'avaient suivie, pas les titres.
  // Relevé le 01/10 en recoupant une mesure du 25/09 (P3.2 : −10 000 F pour
  // une vente nette de 8 850 F).
  it("débite le créateur du brut remboursé, et la plateforme garde sa commission", async () => {
    const createur = await creerCreateur("-v2");
    const acheteur = await creerCreateur("-a2");
    const { produit } = await creerProduitAvecFichier(createur.id, 10_000);
    const ligne = await creerCommande(acheteur.id, produit.id, 10_000);

    const { frais } = await encaisserLigne({
      orderItemId: ligne.id,
      regime: "DIRECT",
    });

    // Remboursement de la moitié.
    const { aCharge, retenu } = await rembourserLigne({
      orderItemId: ligne.id,
      amount: 5_000,
      reason: "geste commercial",
    });

    // Le vendeur finance le brut remboursé, pas sa seule part nette : la
    // commission reste acquise à la plateforme et les frais d'opérateur ne
    // reviennent jamais de la passerelle.
    expect(aCharge).toBe(5_000);
    expect(retenu).toBe(Math.round(frais.platformFee / 2));

    const solde = await db.balance.findFirstOrThrow({
      where: { userId: createur.id },
    });
    expect(solde.holdingAmount).toBe(frais.sellerNet - aCharge);

    const relue = await db.orderItem.findUniqueOrThrow({ where: { id: ligne.id } });
    expect(relue.refundedAmount).toBe(5_000);
    // Le statut ne bouge pas : c'est le RemboursEment qui porte l'information.
    expect(relue.state).toBe("SUCCESSFUL");
  });

  it("empile plusieurs remboursements partiels", async () => {
    const createur = await creerCreateur("-v3");
    const acheteur = await creerCreateur("-a3");
    const { produit } = await creerProduitAvecFichier(createur.id, 10_000);
    const ligne = await creerCommande(acheteur.id, produit.id, 10_000);
    await encaisserLigne({ orderItemId: ligne.id, regime: "DIRECT" });

    await rembourserLigne({ orderItemId: ligne.id, amount: 3_000 });
    await rembourserLigne({ orderItemId: ligne.id, amount: 2_000 });

    const relue = await db.orderItem.findUniqueOrThrow({ where: { id: ligne.id } });
    expect(relue.refundedAmount).toBe(5_000);
    expect(await db.refund.count({ where: { orderItemId: ligne.id } })).toBe(2);
  });

  it("une suite de remboursements franc par franc retient la commission exacte", async () => {
    // Le défaut anticipé : arrondir chaque remboursement isolément ferait
    // dériver la part retenue par la plateforme sur cent passages.
    const createur = await creerCreateur("-v17");
    const acheteur = await creerCreateur("-a17");
    const { produit } = await creerProduitAvecFichier(createur.id, 100);
    const ligne = await creerCommande(acheteur.id, produit.id, 100);

    const { frais } = await encaisserLigne({
      orderItemId: ligne.id,
      regime: "DIRECT",
    });

    let rendu = 0;
    let retenuCumule = 0;
    for (let i = 0; i < 100; i += 1) {
      const r = await rembourserLigne({ orderItemId: ligne.id, amount: 1 });
      rendu += r.aCharge;
      retenuCumule += r.retenu;
    }

    expect(rendu).toBe(100);

    // La ligne est remboursée en entier : la plateforme doit avoir retenu sa
    // commission entière, ni un franc de plus, ni un de moins. Arrondir chaque
    // remboursement isolément ferait dériver sur cent passages.
    expect(retenuCumule).toBe(frais.platformFee);

    // Le vendeur a rendu le brut : son solde descend sous son net d'autant.
    const soldes = await db.balance.findMany({ where: { userId: createur.id } });
    const total = soldes.reduce((s, b) => s + b.holdingAmount, 0);
    expect(total).toBe(frais.sellerNet - 100);
  });

  it("refuse de rembourser plus que ce qui a été encaissé", async () => {
    const createur = await creerCreateur("-v4");
    const acheteur = await creerCreateur("-a4");
    const { produit } = await creerProduitAvecFichier(createur.id, 10_000);
    const ligne = await creerCommande(acheteur.id, produit.id, 10_000);
    await encaisserLigne({ orderItemId: ligne.id, regime: "DIRECT" });

    await expect(
      rembourserLigne({ orderItemId: ligne.id, amount: 10_001 }),
    ).rejects.toThrow(RangeError);
  });
});

describe("le grand livre est immuable en base", () => {
  it("refuse de modifier une écriture, trigger Postgres à l'appui", async () => {
    const createur = await creerCreateur("-v5");
    const acheteur = await creerCreateur("-a5");
    const { produit } = await creerProduitAvecFichier(createur.id, 10_000);
    const ligne = await creerCommande(acheteur.id, produit.id, 10_000);
    const { mouvement } = await encaisserLigne({
      orderItemId: ligne.id,
      regime: "DIRECT",
    });

    await expect(
      db.balanceTransaction.update({
        where: { id: mouvement!.id },
        data: { issuedNet: 0 },
      }),
    ).rejects.toThrow(/immuable/);
  });

  it("refuse de créditer un solde déjà parti en versement", async () => {
    const createur = await creerCreateur("-v6");
    const acheteur = await creerCreateur("-a6");
    const { produit } = await creerProduitAvecFichier(createur.id, 10_000);

    const l1 = await creerCommande(acheteur.id, produit.id, 10_000);
    await encaisserLigne({ orderItemId: l1.id, regime: "DIRECT" });

    // Le versement démarre : le solde du jour se fige.
    const solde = await db.balance.findFirstOrThrow({
      where: { userId: createur.id },
    });
    await db.balance.update({
      where: { id: solde.id },
      data: { state: "PROCESSING" },
    });

    const l2 = await creerCommande(acheteur.id, produit.id, 10_000);
    await expect(
      encaisserLigne({ orderItemId: l2.id, regime: "DIRECT" }),
    ).rejects.toThrow(/figés/);
  });
});

describe("téléchargement", () => {
  it("autorise l'acheteur, compte la consommation et calcule la durée d'URL", async () => {
    const createur = await creerCreateur("-v7");
    const acheteur = await creerCreateur("-a7");
    const { produit, fichier } = await creerProduitAvecFichier(createur.id, 10_000);
    const ligne = await creerCommande(acheteur.id, produit.id, 10_000);
    await encaisserLigne({ orderItemId: ligne.id, regime: "DIRECT" });

    const r = await autoriserTelechargement({
      userId: acheteur.id,
      productFileId: fichier.id,
      userAgent: "Mozilla/5.0 (Linux; Android 14)",
      ipAddress: "41.82.0.1",
    });

    expect(r.decision).toEqual({ autorise: true, consommeQuota: false });
    // 200 Mo sur une connexion lente : il faut plus de 4 heures.
    expect(r.dureeUrlSecondes).toBeGreaterThan(4 * 3600);

    const evenement = await db.consumptionEvent.findFirstOrThrow({
      where: { userId: acheteur.id },
    });
    expect(evenement.platform).toBe("ANDROID");
    expect(evenement.orderItemId).toBe(ligne.id);

    const relu = await db.product.findUniqueOrThrow({ where: { id: produit.id } });
    expect(relu.downloadsCount).toBe(1);
  });

  it("refuse quelqu'un qui n'a rien acheté", async () => {
    const createur = await creerCreateur("-v8");
    const curieux = await creerCreateur("-curieux");
    const { fichier } = await creerProduitAvecFichier(createur.id, 10_000);

    const r = await autoriserTelechargement({
      userId: curieux.id,
      productFileId: fichier.id,
    });

    expect(r.decision).toEqual({
      autorise: false,
      raison: "COMMANDE_NON_PAYEE",
    });
    expect(await db.consumptionEvent.count()).toBe(0);
  });

  it("refuse après un remboursement intégral", async () => {
    const createur = await creerCreateur("-v9");
    const acheteur = await creerCreateur("-a9");
    const { produit, fichier } = await creerProduitAvecFichier(createur.id, 10_000);
    const ligne = await creerCommande(acheteur.id, produit.id, 10_000);
    await encaisserLigne({ orderItemId: ligne.id, regime: "DIRECT" });
    await rembourserLigne({ orderItemId: ligne.id, amount: 10_000 });

    const r = await autoriserTelechargement({
      userId: acheteur.id,
      productFileId: fichier.id,
    });

    expect(r.decision).toEqual({ autorise: false, raison: "REMBOURSE" });
  });

  it("décompte le quota d'un abonné, puis le laisse re-télécharger gratuitement", async () => {
    const createur = await creerCreateur("-v10");
    const abonne = await creerCreateur("-abonne");
    // Une ressource payante : c'est là que l'abonnement sert. Sur une ressource
    // offerte, il n'y aurait pas de quota à décompter.
    const { fichier } = await creerProduitAvecFichier(createur.id, 10_000);

    const plan = await db.plan.upsert({
      where: { code: "EXPLORER" },
      update: { downloadsPerMonth: 2 },
      create: {
        code: "EXPLORER",
        name: "Explorer",
        priceMonthly: 2_500,
        downloadsPerMonth: 2,
      },
    });
    await db.subscription.create({
      data: {
        userId: abonne.id,
        planId: plan.id,
        status: "ACTIVE",
        cycleEnd: new Date(Date.now() + 30 * 86_400_000),
      },
    });

    const premier = await autoriserTelechargement({
      userId: abonne.id,
      productFileId: fichier.id,
    });
    expect(premier.decision).toEqual({ autorise: true, consommeQuota: true });

    const quota = await db.downloadQuota.findFirstOrThrow({});
    expect(quota.used).toBe(1);

    // Deuxième téléchargement du MÊME fichier : le droit est déjà acquis.
    const second = await autoriserTelechargement({
      userId: abonne.id,
      productFileId: fichier.id,
    });
    expect(second.decision).toEqual({ autorise: true, consommeQuota: false });

    const quotaApres = await db.downloadQuota.findFirstOrThrow({});
    expect(quotaApres.used).toBe(1);
  });

  it("tient la grâce promise après l'échéance, et pas au-delà", async () => {
    // Mesuré le 25/09 (Qualitytest P8.7) : refusé dès le lendemain de
    // l'échéance, pendant que la page du forfait promettait « accès maintenu
    // jusqu'au » échéance + 7 jours.
    const createur = await creerCreateur("-v13");
    const { fichier } = await creerProduitAvecFichier(createur.id, 10_000);
    const plan = await db.plan.upsert({
      where: { code: "EXPLORER" },
      update: { downloadsPerMonth: 20 },
      create: { code: "EXPLORER", name: "Explorer", priceMonthly: 2_500, downloadsPerMonth: 20 },
    });
    const abonne = async (suffixe: string, echeanceIlYaJours: number) => {
      const u = await creerCreateur(suffixe);
      await db.subscription.create({
        data: {
          userId: u.id,
          planId: plan.id,
          status: "ACTIVE",
          cycleEnd: new Date(Date.now() - echeanceIlYaJours * 86_400_000),
        },
      });
      return u;
    };

    const enGrace = await abonne("-grace", 1);
    expect(
      (await autoriserTelechargement({ userId: enGrace.id, productFileId: fichier.id })).decision.autorise,
    ).toBe(true);

    const auDela = await abonne("-echu", REGLAGES_PAR_DEFAUT.graceJours + 1);
    expect(
      (await autoriserTelechargement({ userId: auDela.id, productFileId: fichier.id })).decision,
    ).toEqual({ autorise: false, raison: "ABONNEMENT_INACTIF" });
  });

  it("livre une ressource offerte sans commande ni quota", async () => {
    const createur = await creerCreateur("-v12");
    const passant = await creerCreateur("-passant");
    const { produit, fichier } = await creerProduitAvecFichier(createur.id, 0);

    const r = await autoriserTelechargement({
      userId: passant.id,
      productFileId: fichier.id,
    });

    expect(r.decision).toEqual({ autorise: true, consommeQuota: false });
    expect(r.fichier?.filename).toBe("pack-motifs-wax.zip");

    // Elle compte quand même comme téléchargement : c'est ce que la maquette
    // affiche sur la carte, et c'est vrai que le fichier est parti.
    const relu = await db.product.findUniqueOrThrow({ where: { id: produit.id } });
    expect(relu.downloadsCount).toBe(1);
    expect(await db.consumptionEvent.count()).toBe(1);
  });

  it("coupe l'accès pendant un litige, et le rend si la contestation est levée", async () => {
    const createur = await creerCreateur("-v14");
    const acheteur = await creerCreateur("-a14");
    const { produit, fichier } = await creerProduitAvecFichier(createur.id, 10_000);
    const ligne = await creerCommande(acheteur.id, produit.id, 10_000);
    await encaisserLigne({ orderItemId: ligne.id, regime: "DIRECT" });

    await db.orderItem.update({
      where: { id: ligne.id },
      data: { chargebackAt: new Date() },
    });

    const pendant = await autoriserTelechargement({
      userId: acheteur.id,
      productFileId: fichier.id,
    });
    expect(pendant.decision).toEqual({ autorise: false, raison: "LITIGE" });
    expect(await db.consumptionEvent.count()).toBe(0);

    // Contestation tranchée en faveur du vendeur : le fichier revient.
    await db.orderItem.update({
      where: { id: ligne.id },
      data: { chargebackReversedAt: new Date() },
    });

    const apres = await autoriserTelechargement({
      userId: acheteur.id,
      productFileId: fichier.id,
    });
    expect(apres.decision).toMatchObject({ autorise: true });
  });

  it("coupe l'accès retiré à la main, même sans rembourser", async () => {
    const createur = await creerCreateur("-v15");
    const acheteur = await creerCreateur("-a15");
    const { produit, fichier } = await creerProduitAvecFichier(createur.id, 10_000);
    const ligne = await creerCommande(acheteur.id, produit.id, 10_000);
    await encaisserLigne({ orderItemId: ligne.id, regime: "DIRECT" });

    await db.orderItem.update({
      where: { id: ligne.id },
      data: { accessRevokedAt: new Date() },
    });

    const r = await autoriserTelechargement({
      userId: acheteur.id,
      productFileId: fichier.id,
    });

    // L'argent n'a pas bougé : ce n'est pas un remboursement, et le motif
    // affiché ne doit pas le laisser croire.
    expect(r.decision).toEqual({ autorise: false, raison: "ACCES_RETIRE" });
    const relu = await db.orderItem.findUniqueOrThrow({ where: { id: ligne.id } });
    expect(relu.refundedAmount).toBe(0);
  });

  it("la base refuse un litige tranché avant d'avoir été ouvert", async () => {
    const createur = await creerCreateur("-v16");
    const acheteur = await creerCreateur("-a16");
    const { produit } = await creerProduitAvecFichier(createur.id, 10_000);
    const ligne = await creerCommande(acheteur.id, produit.id, 10_000);

    await expect(
      db.orderItem.update({
        where: { id: ligne.id },
        data: { chargebackReversedAt: new Date() },
      }),
    ).rejects.toThrow();
  });

  it("refuse de livrer un aperçu comme s'il était le fichier vendu", async () => {
    const createur = await creerCreateur("-v13");
    const acheteur = await creerCreateur("-a13");
    const { produit } = await creerProduitAvecFichier(createur.id, 10_000);
    const ligne = await creerCommande(acheteur.id, produit.id, 10_000);
    await encaisserLigne({ orderItemId: ligne.id, regime: "DIRECT" });

    const media = await db.mediaAsset.create({
      data: {
        ownerId: createur.id,
        purpose: "preview",
        s3Key: `public/extraits/${produit.id}/extrait.mp3`,
        checksum: "def",
        sizeBytes: 2 * MO,
        contentType: "audio/mpeg",
        status: "READY",
      },
    });
    const apercu = await db.productFile.create({
      data: {
        productId: produit.id,
        mediaId: media.id,
        filename: "extrait.mp3",
        sizeBytes: 2 * MO,
        role: "PREVIEW",
      },
    });

    // L'acheteur a pourtant tous les droits sur cette ressource : c'est bien le
    // rôle du fichier qui l'arrête, pas son titre d'accès.
    const r = await autoriserTelechargement({
      userId: acheteur.id,
      productFileId: apercu.id,
    });

    expect(r.decision.autorise).toBe(false);
    expect(await db.consumptionEvent.count()).toBe(0);

    const relu = await db.product.findUniqueOrThrow({ where: { id: produit.id } });
    expect(relu.downloadsCount).toBe(0);
  });
});

describe("projection des versements sur données réelles", () => {
  it("additionne les soldes non versés jusqu'à la fin de période", async () => {
    const createur = await creerCreateur("-v11");
    const acheteur = await creerCreateur("-a11");
    const { produit } = await creerProduitAvecFichier(createur.id, 10_000);

    const l1 = await creerCommande(acheteur.id, produit.id, 10_000);
    await encaisserLigne({
      orderItemId: l1.id,
      regime: "DIRECT",
      date: new Date("2026-07-20T10:00:00Z"),
    });

    const l2 = await creerCommande(acheteur.id, produit.id, 10_000);
    await encaisserLigne({
      orderItemId: l2.id,
      regime: "DIRECT",
      date: new Date("2026-07-28T10:00:00Z"),
    });

    // Arrêté au 24 juillet : seule la première vente compte.
    const au24 = await soldeVersableJusqua(
      db,
      createur.id,
      new Date("2026-07-24T00:00:00Z"),
    );
    const au31 = await soldeVersableJusqua(
      db,
      createur.id,
      new Date("2026-07-31T00:00:00Z"),
    );

    expect(au24).toBe(8_850);
    expect(au31).toBe(17_700);
  });
});
