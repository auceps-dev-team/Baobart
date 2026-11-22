/**
 * Les demandes de remboursement, sur de vrais achats simulés.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { acheter } from "@/lib/checkout/achat";
import { db } from "@/lib/db";
import { achatsRemboursables, definirDelai, demander, demandesPourLeSupport, prevenirDemandesEchues, trancher } from "@/lib/remboursements/service";

const JOUR = 86_400_000;
const AVANT = process.env.CHECKOUT_SIMULATION_ENABLED;
beforeEach(() => {
  process.env.CHECKOUT_SIMULATION_ENABLED = "1";
});
afterEach(() => {
  if (AVANT === undefined) delete process.env.CHECKOUT_SIMULATION_ENABLED;
  else process.env.CHECKOUT_SIMULATION_ENABLED = AVANT;
});

let n = 0;
async function compte(prefixe: string) {
  n += 1;
  const s = `${n}-${Math.random().toString(36).slice(2, 7)}`;
  return db.user.create({ data: { email: `${prefixe}-${s}@baobart.test`, profile: { create: { username: `${prefixe}-${s}`, displayName: prefixe } } }, select: { id: true } });
}

async function achat(prix = 5_000, pourboire = 0) {
  const vendeur = await compte("vendeur");
  const acheteur = await compte("acheteur");
  const s = `${++n}-${Math.random().toString(36).slice(2, 7)}`;
  const produit = await db.product.create({ data: { sellerId: vendeur.id, name: `Pack ${s}`, slug: `pack-${s}`, price: prix, currency: "XOF", status: "PUBLISHED", tipsEnabled: pourboire > 0 }, select: { id: true } });
  const media = await db.mediaAsset.create({ data: { ownerId: vendeur.id, purpose: "product", s3Key: `produits/${produit.id}/f.zip`, checksum: "x", contentType: "application/zip", sizeBytes: 1024, status: "READY" }, select: { id: true } });
  await db.productFile.create({ data: { productId: produit.id, mediaId: media.id, filename: "f.zip", sizeBytes: 1024, role: "SOURCE", position: 0 } });
  const r = await acheter({ produitId: produit.id, acheteurId: acheteur.id, pourboire });
  expect(r.ok).toBe(true);
  const ligne = await db.orderItem.findFirstOrThrow({ where: { productId: produit.id }, select: { id: true } });
  return { vendeur, acheteur, ligne: ligne.id };
}

const MOTIF = "Le fichier ne s'ouvre pas dans mon logiciel.";

describe("une demande de remboursement", () => {
  it("se fait dans le délai du créateur, figé à l'achat", async () => {
    const { vendeur, acheteur, ligne } = await achat();
    // Le créateur raccourcit son délai APRÈS la vente : rien ne change pour cet achat.
    await definirDelai(vendeur.id, 7);
    const [a] = await achatsRemboursables(acheteur.id);
    expect(a).toMatchObject({ orderItemId: ligne, refus: null });
    expect(Math.round((a!.jusquA!.getTime() - Date.now()) / JOUR)).toBe(30);

    const tard = new Date(Date.now() + 31 * JOUR);
    expect(await demander({ acheteurId: acheteur.id, orderItemId: ligne, motif: MOTIF, maintenant: tard })).toEqual({ ok: false, motif: "DELAI_DEPASSE" });
  });

  it("n'existe pas quand le créateur n'accepte aucun remboursement", async () => {
    const vendeurPrealable = await achat();
    await definirDelai(vendeurPrealable.vendeur.id, 0);
    // Un nouvel achat, après le réglage : il porte « aucun ».
    const acheteur = await compte("acheteur");
    const produit = await db.product.findFirstOrThrow({ where: { sellerId: vendeurPrealable.vendeur.id }, select: { id: true } });
    expect((await acheter({ produitId: produit.id, acheteurId: acheteur.id })).ok).toBe(true);
    const ligne = await db.orderItem.findFirstOrThrow({ where: { productId: produit.id, order: { buyerId: acheteur.id } }, select: { id: true, refundWindowDays: true } });
    expect(ligne.refundWindowDays).toBe(0);
    expect(await demander({ acheteurId: acheteur.id, orderItemId: ligne.id, motif: MOTIF })).toEqual({ ok: false, motif: "SANS_REMBOURSEMENT" });
  });

  it("ne se fait qu'une fois, par l'acheteur, avec un motif, et prévient le créateur", async () => {
    const { vendeur, acheteur, ligne } = await achat();
    const intrus = await compte("intrus");
    expect(await demander({ acheteurId: intrus.id, orderItemId: ligne, motif: MOTIF })).toEqual({ ok: false, motif: "INTROUVABLE" });
    expect(await demander({ acheteurId: acheteur.id, orderItemId: ligne, motif: "bof" })).toEqual({ ok: false, motif: "MOTIF" });

    expect((await demander({ acheteurId: acheteur.id, orderItemId: ligne, motif: MOTIF })).ok).toBe(true);
    expect(await demander({ acheteurId: acheteur.id, orderItemId: ligne, motif: MOTIF })).toEqual({ ok: false, motif: "DEJA_DEMANDE" });
    expect(await db.notification.count({ where: { userId: vendeur.id, type: "DEMANDE_REMBOURSEMENT" } })).toBe(1);
  });

  it("acceptée par le créateur, rembourse vraiment et prévient l'acheteur", async () => {
    const { vendeur, acheteur, ligne } = await achat(5_000);
    const d = await demander({ acheteurId: acheteur.id, orderItemId: ligne, motif: MOTIF });
    if (!d.ok) throw new Error("demande");

    const autre = await compte("autre-vendeur");
    expect(await trancher({ demandeId: d.demandeId, parId: autre.id, qualite: "CREATEUR", decision: "ACCEPTER" })).toEqual({ ok: false, motif: "INTROUVABLE" });

    expect(await trancher({ demandeId: d.demandeId, parId: vendeur.id, qualite: "CREATEUR", decision: "ACCEPTER" })).toMatchObject({ ok: true });
    expect(await db.orderItem.findUniqueOrThrow({ where: { id: ligne }, select: { refundedAmount: true } })).toEqual({ refundedAmount: 5_000 });
    expect(await db.refundRequest.findUniqueOrThrow({ where: { id: d.demandeId }, select: { status: true, decidedBySupport: true } })).toEqual({ status: "ACCEPTED", decidedBySupport: false });
    expect(await db.notification.count({ where: { userId: acheteur.id, type: "COMMANDE_REMBOURSEE" } })).toBe(1);
    expect(await db.balanceTransaction.count({ where: { orderItemId: ligne, type: "REFUND" } })).toBe(1);
  });

  it("refusée, exige un motif que l'acheteur reçoit", async () => {
    const { vendeur, acheteur, ligne } = await achat();
    const d = await demander({ acheteurId: acheteur.id, orderItemId: ligne, motif: MOTIF });
    if (!d.ok) throw new Error("demande");

    expect(await trancher({ demandeId: d.demandeId, parId: vendeur.id, qualite: "CREATEUR", decision: "REFUSER", motif: "non" })).toEqual({ ok: false, motif: "MOTIF_REQUIS" });
    expect((await trancher({ demandeId: d.demandeId, parId: vendeur.id, qualite: "CREATEUR", decision: "REFUSER", motif: "Le fichier s'ouvre avec Illustrator 2024." })).ok).toBe(true);
    const refus = await db.notification.findFirstOrThrow({ where: { userId: acheteur.id, type: "REMBOURSEMENT_REFUSE" }, select: { corps: true } });
    expect(refus.corps).toContain("Illustrator 2024");
    expect((await achatsRemboursables(acheteur.id))[0]).toMatchObject({ demande: { statut: "REFUSED", motifRefus: "Le fichier s'ouvre avec Illustrator 2024." } });
  });

  it("passe au support après sept jours, et une seule décision l'emporte", async () => {
    const { vendeur, acheteur, ligne } = await achat(5_000);
    const d = await demander({ acheteurId: acheteur.id, orderItemId: ligne, motif: MOTIF });
    if (!d.ok) throw new Error("demande");
    const support = await compte("support");

    expect(await trancher({ demandeId: d.demandeId, parId: support.id, qualite: "SUPPORT", decision: "ACCEPTER" })).toEqual({ ok: false, motif: "PAS_ENCORE_AU_SUPPORT" });
    expect(await demandesPourLeSupport()).toEqual([]);

    const plusTard = new Date(Date.now() + 8 * JOUR);
    expect((await demandesPourLeSupport(plusTard)).map((x) => x.id)).toEqual([d.demandeId]);

    // Le créateur se réveille au moment où le support tranche.
    const [a, b] = await Promise.all([
      trancher({ demandeId: d.demandeId, parId: vendeur.id, qualite: "CREATEUR", decision: "ACCEPTER", maintenant: plusTard }),
      trancher({ demandeId: d.demandeId, parId: support.id, qualite: "SUPPORT", decision: "ACCEPTER", maintenant: plusTard }),
    ]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    expect(await db.refund.count({ where: { orderItemId: ligne } })).toBe(1);
  });

  // Q-40 (recette du 14/11/2026) : la créatrice apprenait par une ligne « Tu
  // dois 2 800 F » sur l'écran des gains que l'équipe avait remboursé à sa place.
  it("prévient le créateur, par la cloche ET par courriel, quand l'équipe rembourse à sa place", async () => {
    const { vendeur, acheteur, ligne } = await achat(2_800);
    const d = await demander({ acheteurId: acheteur.id, orderItemId: ligne, motif: MOTIF });
    if (!d.ok) throw new Error("demande");
    const support = await compte("support-q40");
    const plusTard = new Date(Date.now() + 8 * JOUR);

    expect((await trancher({ demandeId: d.demandeId, parId: support.id, qualite: "SUPPORT", decision: "ACCEPTER", maintenant: plusTard })).ok).toBe(true);

    const avis = await db.notification.findFirstOrThrow({ where: { userId: vendeur.id, type: "REMBOURSE_PAR_EQUIPE" }, select: { corps: true } });
    expect(avis.corps).toContain("l'équipe a accepté");
    expect(await db.emailOutbox.count({ where: { template: "REMBOURSE_PAR_EQUIPE" } })).toBe(1);
  });

  it("ne dit rien de tel quand c'est le créateur lui-même qui accepte", async () => {
    const { vendeur, acheteur, ligne } = await achat(2_800);
    const d = await demander({ acheteurId: acheteur.id, orderItemId: ligne, motif: MOTIF });
    if (!d.ok) throw new Error("demande");
    expect((await trancher({ demandeId: d.demandeId, parId: vendeur.id, qualite: "CREATEUR", decision: "ACCEPTER" })).ok).toBe(true);
    expect(await db.notification.count({ where: { userId: vendeur.id, type: "REMBOURSE_PAR_EQUIPE" } })).toBe(0);
  });

  it("redevient décidable quand le remboursement ne peut pas partir", async () => {
    const { vendeur, acheteur, ligne } = await achat();
    const d = await demander({ acheteurId: acheteur.id, orderItemId: ligne, motif: MOTIF });
    if (!d.ok) throw new Error("demande");
    await db.user.update({ where: { id: vendeur.id }, data: { refundsDisabled: true } });

    const r = await trancher({ demandeId: d.demandeId, parId: vendeur.id, qualite: "CREATEUR", decision: "ACCEPTER" });
    expect(r).toMatchObject({ ok: false, motif: "REMBOURSEMENT_IMPOSSIBLE" });
    expect(await db.refundRequest.findUniqueOrThrow({ where: { id: d.demandeId }, select: { status: true } })).toEqual({ status: "PENDING" });
    expect(await db.refund.count({ where: { orderItemId: ligne } })).toBe(0);
  });

  it("reste éligible après un remboursement du prix seul quand un pourboire reste dû", async () => {
    const { acheteur, ligne } = await achat(5_000, 1_000);
    await db.orderItem.update({ where: { id: ligne }, data: { refundedAmount: 5_000 } });

    const [a] = await achatsRemboursables(acheteur.id);
    expect(a).toMatchObject({ orderItemId: ligne, refus: null });
    expect((await demander({ acheteurId: acheteur.id, orderItemId: ligne, motif: MOTIF })).ok).toBe(true);
  });
});

/**
 * Q-39 (recette du 14/11/2026, décidé le 21/11) : au huitième jour sans réponse
 * du créateur, la demande passait à l'équipe sans que personne le sache.
 */
describe("Q-39 — au huitième jour, le créateur et l'équipe sont prévenus", () => {
  async function demandeOuverte() {
    const a = await achat();
    const d = await demander({ acheteurId: a.acheteur.id, orderItemId: a.ligne, motif: MOTIF });
    if (!d.ok) throw new Error("demande");
    return { ...a, demandeId: d.demandeId };
  }

  async function membre(role: "SUPPORT" | "ADMIN" | "SUPER_ADMIN" | "MODERATOR") {
    const c = await compte(`equipe-${role.toLowerCase()}`);
    await db.user.update({ where: { id: c.id }, data: { platformRole: role } });
    return c;
  }

  const dans = (jours: number) => new Date(Date.now() + jours * JOUR);
  const avisA = (userId: string, type: string) => db.notification.count({ where: { userId, type } });

  it("prévient le créateur et ceux qui tranchent, cloche et courriel, une seule fois", async () => {
    const { vendeur, acheteur } = await demandeOuverte();
    const support = await membre("SUPPORT");
    const admin = await membre("ADMIN");
    const superAdmin = await membre("SUPER_ADMIN");
    // Un modérateur n'a pas le pouvoir de trancher ; un administrateur suspendu
    // ne peut plus agir.
    const moderateur = await membre("MODERATOR");
    const suspendu = await membre("ADMIN");
    await db.user.update({ where: { id: suspendu.id }, data: { suspendedAt: new Date() } });

    expect(await prevenirDemandesEchues(dans(8))).toMatchObject({ demandes: 1 });

    expect(await avisA(vendeur.id, "DEMANDE_TRANSMISE")).toBe(1);
    for (const m of [support, admin, superAdmin]) expect(await avisA(m.id, "DEMANDE_A_TRANCHER")).toBe(1);
    // Le nom du créateur n’est écrit nulle part chez l’équipe : il survivrait à
    // l’effacement de son compte (même raison que « Nouvel abonné », #81).
    const nomVendeur = (await db.profile.findUniqueOrThrow({ where: { userId: vendeur.id }, select: { displayName: true } })).displayName;
    const chezLEquipe = await db.notification.findFirstOrThrow({ where: { userId: admin.id, type: "DEMANDE_A_TRANCHER" }, select: { titre: true, corps: true, payload: true } });
    expect(JSON.stringify(chezLEquipe)).not.toContain(nomVendeur);
    for (const m of [moderateur, suspendu, acheteur, vendeur]) expect(await avisA(m.id, "DEMANDE_A_TRANCHER")).toBe(0);
    expect(await db.emailOutbox.count({ where: { template: "DEMANDE_TRANSMISE" } })).toBe(1);
    expect(await db.emailOutbox.count({ where: { template: "DEMANDE_A_TRANCHER" } })).toBe(3);

    // La nuit suivante : rien de plus, ni dans la cloche, ni par courriel.
    expect(await prevenirDemandesEchues(dans(9))).toEqual({ demandes: 0, avis: 0 });
    expect(await db.notification.count({ where: { type: { in: ["DEMANDE_TRANSMISE", "DEMANDE_A_TRANCHER"] } } })).toBe(4);
    expect(await db.emailOutbox.count({ where: { template: { in: ["DEMANDE_TRANSMISE", "DEMANDE_A_TRANCHER"] } } })).toBe(4);
  });

  it("ne dit rien avant le huitième jour, ni d'une demande déjà tranchée", async () => {
    const ouverte = await demandeOuverte();
    const tranchee = await demandeOuverte();
    await membre("ADMIN");

    expect(await prevenirDemandesEchues(dans(6))).toEqual({ demandes: 0, avis: 0 });

    const refus = await trancher({
      demandeId: tranchee.demandeId,
      parId: tranchee.vendeur.id,
      qualite: "CREATEUR",
      decision: "REFUSER",
      motif: "Le fichier s'ouvre bien chez moi.",
    });
    expect(refus.ok).toBe(true);

    expect(await prevenirDemandesEchues(dans(8))).toMatchObject({ demandes: 1 });
    expect(await avisA(ouverte.vendeur.id, "DEMANDE_TRANSMISE")).toBe(1);
    expect(await avisA(tranchee.vendeur.id, "DEMANDE_TRANSMISE")).toBe(0);
  });

  it("l'acheteur lit que sa demande est transmise à l'équipe, et non plus « en attente du créateur »", async () => {
    const { acheteur } = await demandeOuverte();
    expect((await achatsRemboursables(acheteur.id))[0]!.demande!.chezLEquipe).toBe(false);
    expect((await achatsRemboursables(acheteur.id, dans(8)))[0]!.demande!.chezLEquipe).toBe(true);
  });
});
