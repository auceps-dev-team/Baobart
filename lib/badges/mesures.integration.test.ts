/**
 * Les mesures des mérites, contre une vraie base.
 *
 * Deux sortes de tests :
 *   - des cas écrits à la main, un par règle de `lib/badges/mesures.ts`
 *     (anti-triche du 08/11 compris) ;
 *   - une comparaison sur des lignes tirées au hasard (fast-check) : la règle
 *     « vente aboutie » est écrite deux fois, en SQL et en TypeScript
 *     (`estUneVenteAboutie`). Si elles divergent un jour, ce test le dit avant
 *     un créateur.
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { estUneVenteAboutie, mesuresDe } from "@/lib/badges/mesures";
import { db } from "@/lib/db";

let n = 0;
const JOUR = 86_400_000;

async function compte(prefixe: string, donnees: { createdAt?: Date; suspendedAt?: Date; anonymizedAt?: Date } = {}) {
  n += 1;
  const marque = `${prefixe}-${n}-${Math.random().toString(36).slice(2, 7)}`;
  return db.user.create({
    data: { email: `${marque}@baobart.test`, ...donnees, profile: { create: { username: marque, displayName: marque } } },
    select: { id: true },
  });
}

async function ressource(vendeurId: string) {
  n += 1;
  return db.product.create({
    data: { sellerId: vendeurId, name: `R ${n}`, slug: `r-mes-${n}-${Math.random().toString(36).slice(2, 6)}`, price: 1_000, currency: "XOF", status: "PUBLISHED" },
    select: { id: true },
  });
}

interface Ligne {
  state: "SUCCESSFUL" | "NOT_CHARGED" | "FAILED" | "IN_PROGRESS";
  price: number;
  quantity: number;
  tipAmount: number;
  refundedAmount: number;
  chargebackAt: Date | null;
  chargebackReversedAt: Date | null;
  createdAt: Date;
}

const LIGNE: Ligne = {
  state: "SUCCESSFUL",
  price: 1_000,
  quantity: 1,
  tipAmount: 0,
  refundedAmount: 0,
  chargebackAt: null,
  chargebackReversedAt: null,
  createdAt: new Date("2026-10-01T10:00:00Z"),
};

async function vendre(acheteurId: string, produitId: string, ligne: Partial<Ligne> = {}) {
  const l = { ...LIGNE, ...ligne };
  await db.order.create({
    data: {
      buyerId: acheteurId,
      total: l.price * l.quantity + l.tipAmount,
      currency: "XOF",
      createdAt: l.createdAt,
      items: { create: { productId: produitId, ...l } },
    },
  });
}

const MAINTENANT = new Date("2026-11-08T12:00:00Z");

describe("les acheteurs d'un créateur", () => {
  it("compte des acheteurs différents, pas des ventes", async () => {
    const vendeur = await compte("v");
    const p = await ressource(vendeur.id);
    const fidele = await compte("a");
    const autre = await compte("a");
    for (let i = 0; i < 3; i += 1) await vendre(fidele.id, p.id);
    await vendre(autre.id, p.id);

    const m = await mesuresDe(vendeur.id, MAINTENANT);
    expect(m!.acheteurs).toBe(2);
  });

  it("écarte le gratuit, l'achat à soi-même, le remboursé en entier et le litige ouvert", async () => {
    const vendeur = await compte("v");
    const p = await ressource(vendeur.id);
    const [a1, a2, a3, a4, a5, a6] = await Promise.all(["a", "a", "a", "a", "a", "a"].map((x) => compte(x)));

    await vendre(a1!.id, p.id, { state: "NOT_CHARGED", price: 0 });
    await vendre(vendeur.id, p.id);
    // Remboursé en entier, pourboire compris : ce n'est plus une vente.
    await vendre(a2!.id, p.id, { tipAmount: 500, refundedAmount: 1_500 });
    await vendre(a3!.id, p.id, { chargebackAt: new Date("2026-10-02T00:00:00Z") });
    // Remboursé en partie, ou litige gagné : la vente reste.
    await vendre(a4!.id, p.id, { tipAmount: 500, refundedAmount: 1_000 });
    await vendre(a5!.id, p.id, { chargebackAt: new Date("2026-09-01T00:00:00Z"), chargebackReversedAt: new Date("2026-09-10T00:00:00Z") });
    await vendre(a6!.id, p.id);

    const m = await mesuresDe(vendeur.id, MAINTENANT);
    expect(m!.acheteurs).toBe(3);
  });

  it("remet « Sans litige » à zéro au dernier litige ouvert, pas au litige gagné", async () => {
    const vendeur = await compte("v");
    const p = await ressource(vendeur.id);
    const avant = await compte("a");
    const conteste = await compte("a");
    const apres = await compte("a");

    await vendre(avant.id, p.id, { createdAt: new Date("2026-09-01T00:00:00Z") });
    await vendre(conteste.id, p.id, { createdAt: new Date("2026-09-15T00:00:00Z"), chargebackAt: new Date("2026-10-01T00:00:00Z") });
    await vendre(apres.id, p.id, { createdAt: new Date("2026-10-05T00:00:00Z") });

    const m = await mesuresDe(vendeur.id, MAINTENANT);
    expect(m!.acheteurs).toBe(2);
    expect(m!.acheteursDepuisLeDernierLitige).toBe(1);
  });
});

describe("les abonnés qui comptent", () => {
  it("écartent les comptes suspendus, effacés, ou ouverts dans la semaine", async () => {
    const createur = await compte("c");
    const ancien = new Date(MAINTENANT.getTime() - 30 * JOUR);
    const suiveurs = await Promise.all([
      compte("s", { createdAt: ancien }),
      compte("s", { createdAt: ancien }),
      compte("s", { createdAt: ancien, suspendedAt: ancien }),
      compte("s", { createdAt: ancien, anonymizedAt: ancien }),
      compte("s", { createdAt: new Date(MAINTENANT.getTime() - 2 * JOUR) }),
    ]);
    await db.follow.createMany({ data: suiveurs.map((s) => ({ followerId: s.id, followingId: createur.id })) });

    const m = await mesuresDe(createur.id, MAINTENANT);
    expect(m!.abonnes).toBe(2);
  });
});

describe("le rang d'inscription et le titre rangé", () => {
  it("numérote les comptes dans l'ordre d'inscription", async () => {
    const premier = await compte("r", { createdAt: new Date("2026-01-01T00:00:00Z") });
    const second = await compte("r", { createdAt: new Date("2026-01-02T00:00:00Z") });
    expect((await mesuresDe(premier.id, MAINTENANT))!.rangDInscription).toBe(1);
    expect((await mesuresDe(second.id, MAINTENANT))!.rangDInscription).toBe(2);
  });

  it("lit la fin du titre « Créateur du mois » sur UserBadge", async () => {
    const c = await compte("t");
    const badge = await db.badge.create({ data: { code: "TOP_CREATOR", name: "Créateur du mois", description: "" } });
    const fin = new Date(MAINTENANT.getTime() + 12 * JOUR);
    await db.userBadge.create({ data: { userId: c.id, badgeId: badge.id, validUntil: fin } });
    expect((await mesuresDe(c.id, MAINTENANT))!.createurDuMoisJusquAu).toEqual(fin);
  });
});

describe("la règle « vente aboutie », SQL contre TypeScript", () => {
  const ligneAleatoire = fc.record({
    acheteur: fc.integer({ min: 0, max: 3 }),
    state: fc.constantFrom("SUCCESSFUL", "NOT_CHARGED", "FAILED", "IN_PROGRESS") as fc.Arbitrary<Ligne["state"]>,
    quantity: fc.integer({ min: 1, max: 3 }),
    tipAmount: fc.constantFrom(0, 300),
    // « prix » : le prix rendu, le pourboire gardé — le cas où une règle qui
    // oublierait le pourboire divergerait. Ajouté le 08/11 après qu'un bogue
    // volontairement injecté dans le SQL a traversé le test sans lui.
    rembourse: fc.constantFrom("rien", "partiel", "prix", "entier", "plus"),
    litige: fc.constantFrom("aucun", "ouvert", "gagne"),
  });

  it("donne le même nombre d'acheteurs sur des ventes tirées au hasard", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(ligneAleatoire, { minLength: 1, maxLength: 8 }), async (tirage) => {
        const vendeur = await compte("fc-v");
        const p = await ressource(vendeur.id);
        // L'acheteur 0 est le vendeur lui-même : le cas de l'achat à soi.
        const acheteurs = [vendeur, ...(await Promise.all([1, 2, 3].map(() => compte("fc-a"))))];

        const attendus = new Set<string>();
        for (const t of tirage) {
          const du = 1_000 * t.quantity + t.tipAmount;
          const ligne: Ligne = {
            ...LIGNE,
            state: t.state,
            quantity: t.quantity,
            tipAmount: t.tipAmount,
            refundedAmount: { rien: 0, partiel: 500, prix: 1_000 * t.quantity, entier: du, plus: du + 1 }[t.rembourse],
            chargebackAt: t.litige === "aucun" ? null : new Date("2026-10-10T00:00:00Z"),
            chargebackReversedAt: t.litige === "gagne" ? new Date("2026-10-20T00:00:00Z") : null,
          };
          const acheteurId = acheteurs[t.acheteur]!.id;
          await vendre(acheteurId, p.id, ligne);
          if (estUneVenteAboutie({ ...ligne, acheteurId, vendeurId: vendeur.id, price: ligne.price })) attendus.add(acheteurId);
        }

        const m = await mesuresDe(vendeur.id, MAINTENANT);
        expect(m!.acheteurs).toBe(attendus.size);
      }),
      {
        numRuns: 25,
        // Les cas que le hasard rate trop souvent, joués d'abord à coup sûr.
        // Mesuré le 08/11 : une règle SQL qui comptait l'achat à soi-même a
        // traversé 25 tirages ; une autre qui oubliait le pourboire, aussi,
        // tant que le tirage ne rendait jamais « le prix sans le pourboire ».
        examples: [
          [[{ acheteur: 0, state: "SUCCESSFUL", quantity: 1, tipAmount: 0, rembourse: "rien", litige: "aucun" }]],
          [[{ acheteur: 1, state: "SUCCESSFUL", quantity: 1, tipAmount: 300, rembourse: "prix", litige: "aucun" }]],
          [[{ acheteur: 1, state: "SUCCESSFUL", quantity: 2, tipAmount: 0, rembourse: "entier", litige: "gagne" }]],
          [[{ acheteur: 1, state: "NOT_CHARGED", quantity: 1, tipAmount: 0, rembourse: "rien", litige: "aucun" }]],
        ],
      },
    );
  });
});

describe("Fidèle et l'abonnement ouvert (relecture d'Argon, 08/11)", () => {
  // Atelier Sankofa : « Agence » dormait, et « Fidèle » comptait encore une
  // série. Les deux lisent désormais le même verdict, `lireQualifications`.
  /**
   * `echeanceCourante` : l'échéance de l'abonnement. `dernierPaiement` :
   * l'échéance couverte par le paiement le plus récent — par défaut la même
   * série, mais elle peut diverger, comme sur Atelier Sankofa où les dates de
   * l'abonnement avaient été réécrites après les paiements.
   */
  async function abonneAvecTroisCycles(echeanceCourante: Date, dernierPaiement = new Date(echeanceCourante.getTime() - 30 * JOUR)) {
    const c = await compte("fid");
    const plan = await db.plan.upsert({
      where: { code: "DISCOVERY" },
      update: {},
      create: { code: "DISCOVERY", name: "Pass Découverte", priceMonthly: 2_500 },
      select: { id: true },
    });
    const abo = await db.subscription.create({
      data: {
        userId: c.id,
        planId: plan.id,
        status: "ACTIVE",
        cycleStart: new Date(echeanceCourante.getTime() - 30 * JOUR),
        cycleEnd: echeanceCourante,
        cadence: "MENSUEL",
      },
      select: { id: true },
    });
    // Trois paiements à temps, chacun couvrant l'échéance d'un cycle de 30 jours.
    for (const i of [2, 1, 0]) {
      const echeance = new Date(dernierPaiement.getTime() - i * 30 * JOUR);
      await db.subscriptionPayment.create({
        data: { subscriptionId: abo.id, status: "PAID", amount: 2_500, currency: "XOF", provider: "test", cycleEnd: echeance, paidAt: echeance },
      });
    }
    return c;
  }

  it("compte la série quand l'abonnement est ouvert", async () => {
    const c = await abonneAvecTroisCycles(new Date(MAINTENANT.getTime() + 10 * JOUR));
    const m = await mesuresDe(c.id, MAINTENANT);
    expect(m!.abonnementOuvert).toBe(true);
    expect(m!.cyclesPayesDAffilee).toBe(3);
  });

  it("la remet à zéro quand l'abonnement est fermé, quoi que disent les paiements passés", async () => {
    // La forme d'Atelier Sankofa : l'abonnement est échu depuis 40 jours
    // (grâce et reprise passées), mais le dernier paiement couvre une
    // échéance d'il y a 10 jours — à lui seul, il ferait courir la série
    // encore 27 jours.
    const c = await abonneAvecTroisCycles(new Date(MAINTENANT.getTime() - 40 * JOUR), new Date(MAINTENANT.getTime() - 10 * JOUR));
    const m = await mesuresDe(c.id, MAINTENANT);
    expect(m!.cyclesPayesDAffilee).toBe(0);
    expect(m!.abonnementOuvert).toBe(false);
  });
});
