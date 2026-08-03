import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { soldeVersableJusqua } from "@/lib/domain/balances";
import { encaisserLigne, rembourserLigne } from "@/lib/domain/orders";
import {
  RAILS_BAOBART,
  finDePeriodePourVersement,
  projeterVersements,
} from "@/lib/payments/payout-schedule";
import { preparerLeCycle } from "@/lib/payments/cycle";
import {
  confirmerVersement,
  echouerVersement,
  marquerVersementEnvoye,
  preparerVersement,
  retournerVersement,
} from "@/lib/payments/versements";

/**
 * La projection des versements, alimentée par de vrais soldes.
 *
 * Le calendrier lui-même est éprouvé sans base (17 cas unitaires). Ce qui se
 * vérifie seulement ici : que ce qu'on annonce au créateur — « tu toucheras
 * X le jour J » — corresponde aux écritures réellement portées à son solde.
 */

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

async function vendre(prix: number, date: Date) {
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

  const ligneId = o.items[0]!.id;
  const { frais } = await encaisserLigne({ orderItemId: ligneId, regime: "DIRECT", date });
  return { ligneId, net: frais.sellerNet };
}

const solde = (finDePeriode: Date) =>
  soldeVersableJusqua(db, createur, finDePeriode);

beforeEach(async () => {
  createur = await compte("kofi@vers.test");
  acheteur = await compte("ama@vers.test");

  const p = await db.product.create({
    data: {
      sellerId: createur,
      slug: `v-${Math.random().toString(36).slice(2, 9)}`,
      name: "Pack",
      price: 10_000,
      currency: "XOF",
      status: "PUBLISHED",
    },
    select: { id: true },
  });
  produit = p.id;
});

describe("ce qu'on annonce au créateur", () => {
  it("n'inclut que les ventes arrêtées à la fin de période", async () => {
    // Cycle du vendredi 31 juillet 2026, rétention de 7 jours : la période
    // s'arrête au 24 juillet.
    const a = await vendre(10_000, new Date("2026-07-20T10:00:00Z"));
    await vendre(10_000, new Date("2026-07-28T10:00:00Z"));

    const projections = projeterVersements({
      frequency: "WEEKLY",
      rail: RAILS_BAOBART.wave!,
      soldeVersableJusqua: () => 0, // remplacé plus bas, on veut la date
      today: new Date("2026-07-27T09:00:00Z"),
      limite: 1,
    });

    // Sans solde, rien à projeter : c'est le comportement attendu.
    expect(projections).toHaveLength(0);

    const fin = finDePeriodePourVersement(
      new Date("2026-07-28T00:00:00Z"),
      RAILS_BAOBART.wave!,
    );
    expect(fin.toISOString().slice(0, 10)).toBe("2026-07-24");
    expect(await solde(fin)).toBe(a.net);
  });

  it("deux rails différents touchent les mêmes ventes, à des jours différents", async () => {
    // Le point que le commentaire de `payout_schedule.rb` insiste à documenter :
    // la période est ancrée sur le cycle, jamais sur le jour du rail.
    await vendre(10_000, new Date("2026-07-20T10:00:00Z"));

    const mardi = finDePeriodePourVersement(
      new Date("2026-07-28T00:00:00Z"),
      RAILS_BAOBART.wave!,
    );
    const jeudi = finDePeriodePourVersement(
      new Date("2026-07-30T00:00:00Z"),
      RAILS_BAOBART.bank!,
    );

    expect(mardi.getTime()).toBe(jeudi.getTime());
    expect(await solde(mardi)).toBe(await solde(jeudi));
  });

  it("projette le montant réellement versable, pas le brut encaissé", async () => {
    const a = await vendre(10_000, new Date("2026-07-20T10:00:00Z"));

    const [premier] = projeterVersements({
      frequency: "WEEKLY",
      rail: RAILS_BAOBART.wave!,
      soldeVersableJusqua: () => a.net,
      today: new Date("2026-07-27T09:00:00Z"),
      limite: 1,
    });

    // 10 % de commission et 1,5 % de passerelle : le créateur ne touche pas
    // les 10 000 F affichés sur la fiche.
    expect(premier?.amount).toBe(a.net);
    expect(premier?.amount).toBeLessThan(10_000);
  });

  it("un remboursement fait redescendre ce qui est annoncé", async () => {
    const a = await vendre(10_000, new Date("2026-07-20T10:00:00Z"));
    const fin = new Date("2026-07-24T00:00:00Z");
    expect(await solde(fin)).toBe(a.net);

    await rembourserLigne({
      orderItemId: a.ligneId,
      amount: 4_000,
      date: new Date("2026-07-22T10:00:00Z"),
    });

    const apres = await solde(fin);
    expect(apres).toBeLessThan(a.net);
    expect(apres).toBeGreaterThan(0);
  });

  it("ne projette jamais deux fois la même somme", async () => {
    // Chaque échéance ne compte que ce qui n'a pas déjà été projeté : sans ça,
    // le créateur lirait quatre fois son solde et croirait toucher le quadruple.
    const parPeriode = new Map<string, number>([
      ["2026-07-24", 5_000],
      ["2026-07-31", 12_000],
      ["2026-08-07", 20_000],
    ]);

    const cumulJusqua = (d: Date) => {
      let total = 0;
      for (const [cle, montant] of parPeriode) {
        if (new Date(`${cle}T00:00:00Z`) <= d) total = Math.max(total, montant);
      }
      return total;
    };

    const projections = projeterVersements({
      frequency: "WEEKLY",
      rail: RAILS_BAOBART.wave!,
      soldeVersableJusqua: cumulJusqua,
      today: new Date("2026-07-27T09:00:00Z"),
      limite: 3,
    });

    const somme = projections.reduce((s, p) => s + p.amount, 0);
    // Le cumul projeté ne dépasse jamais le solde réel à la dernière période.
    const derniere = projections.at(-1);
    expect(somme).toBe(cumulJusqua(derniere!.periodEnd));
  });

  it("chaque échéance couvre une période postérieure à la précédente", async () => {
    // Un solde qui grossit : chaque cycle apporte de nouvelles ventes.
    let appels = 0;
    const projections = projeterVersements({
      frequency: "WEEKLY",
      rail: RAILS_BAOBART.mtn!,
      soldeVersableJusqua: () => {
        appels += 1;
        return appels * 50_000;
      },
      today: new Date("2026-07-27T09:00:00Z"),
      limite: 4,
    });

    expect(projections).toHaveLength(4);
    for (let i = 1; i < projections.length; i += 1) {
      expect(projections[i]!.periodEnd.getTime()).toBeGreaterThan(
        projections[i - 1]!.periodEnd.getTime(),
      );
      expect(projections[i]!.payoutDate.getTime()).toBeGreaterThan(
        projections[i - 1]!.payoutDate.getTime(),
      );
    }
  });

  it("s'arrête de sonder dès que plus rien n'arrive", async () => {
    // Un solde figé ne produit qu'une échéance : le reste, c'est le même
    // argent. Et la projection cesse d'interroger la base au lieu de relire
    // vingt-huit fois le même chiffre.
    let appels = 0;
    const projections = projeterVersements({
      frequency: "WEEKLY",
      rail: RAILS_BAOBART.wave!,
      soldeVersableJusqua: () => {
        appels += 1;
        return 1_000_000;
      },
      today: new Date("2026-07-27T09:00:00Z"),
      limite: 4,
    });

    expect(projections).toHaveLength(1);
    expect(appels).toBeLessThanOrEqual(3);
  });

  it("ne verse rien sous le seuil, et laisse la somme rouler", async () => {
    const sousLeSeuil = projeterVersements({
      frequency: "WEEKLY",
      rail: RAILS_BAOBART.wave!,
      soldeVersableJusqua: () => 500,
      today: new Date("2026-07-27T09:00:00Z"),
      limite: 2,
    });
    expect(sousLeSeuil).toHaveLength(0);

    // La même somme, une fois franchi le seuil, part en une seule fois.
    const auDessus = projeterVersements({
      frequency: "WEEKLY",
      rail: RAILS_BAOBART.wave!,
      soldeVersableJusqua: () => 1_500,
      today: new Date("2026-07-27T09:00:00Z"),
      limite: 2,
    });
    expect(auDessus).toHaveLength(1);
    expect(auDessus[0]?.amount).toBe(1_500);
  });
});

describe("exécution d'un versement", () => {
  const CYCLE = new Date("2026-07-31T00:00:00Z"); // un vendredi
  const rail = RAILS_BAOBART.wave!;

  const preparer = (forcer = false) =>
    preparerVersement({
      userId: createur,
      cycleDate: CYCLE,
      rail,
      method: "MOBILE_MONEY",
      accountRef: "+221770000000",
      forcer,
    });

  it("réserve les soldes de la période et fige leur montant", async () => {
    const a = await vendre(10_000, new Date("2026-07-20T10:00:00Z"));
    // Postérieure à la fin de période : elle reste pour le cycle suivant.
    await vendre(10_000, new Date("2026-07-28T10:00:00Z"));

    const { versement, periodEnd } = await preparer();

    expect(periodEnd.toISOString().slice(0, 10)).toBe("2026-07-24");
    expect(versement.amount).toBe(a.net);

    const soldes = await db.balance.findMany({ where: { userId: createur } });
    const pris = soldes.filter((b) => b.payoutId === versement.id);
    expect(pris).toHaveLength(1);
    expect(pris.every((b) => b.state === "PROCESSING")).toBe(true);
    // Celle d'après reste versable.
    expect(soldes.some((b) => b.state === "UNPAID")).toBe(true);
  });

  it("mène un versement de bout en bout et solde les balances", async () => {
    await vendre(10_000, new Date("2026-07-20T10:00:00Z"));
    const { versement } = await preparer();

    await marquerVersementEnvoye(versement.id, "WAVE-REF-42");
    const envoye = await db.payout.findUniqueOrThrow({ where: { id: versement.id } });
    expect(envoye.status).toBe("PROCESSING");
    expect(envoye.providerRef).toBe("WAVE-REF-42");

    await confirmerVersement(versement.id);

    const fini = await db.payout.findUniqueOrThrow({ where: { id: versement.id } });
    expect(fini.status).toBe("COMPLETED");
    expect(fini.processedAt).not.toBeNull();

    const soldes = await db.balance.findMany({ where: { payoutId: versement.id } });
    expect(soldes.every((b) => b.state === "PAID")).toBe(true);
  });

  it("rend exactement les soldes pris quand le versement échoue", async () => {
    // La raison d'être de cette machine : rendre « tout ce qui n'est pas
    // versé » rendrait aussi les ventes arrivées entre-temps, et le créateur
    // serait payé deux fois pour elles.
    const a = await vendre(10_000, new Date("2026-07-20T10:00:00Z"));
    const { versement } = await preparer();

    // Une vente survient pendant que le versement est en cours.
    const b = await vendre(10_000, new Date("2026-07-23T10:00:00Z"));

    await marquerVersementEnvoye(versement.id, "WAVE-REF-43");
    await echouerVersement(versement.id, "numéro invalide");

    const relu = await db.payout.findUniqueOrThrow({ where: { id: versement.id } });
    expect(relu.status).toBe("FAILED");
    expect(relu.failureReason).toBe("numéro invalide");

    // Tout est redevenu versable, et rien n'est resté accroché au versement.
    const soldes = await db.balance.findMany({ where: { userId: createur } });
    expect(soldes.every((b) => b.state === "UNPAID")).toBe(true);
    expect(soldes.every((b) => b.payoutId === null)).toBe(true);

    // Le total rendu est bien celui des deux ventes, ni plus ni moins.
    const total = soldes.reduce((s, x) => s + x.holdingAmount, 0);
    expect(total).toBe(a.net + b.net);
  });

  it("rend les soldes aussi quand l'argent revient après coup", async () => {
    await vendre(10_000, new Date("2026-07-20T10:00:00Z"));
    const { versement } = await preparer();
    await marquerVersementEnvoye(versement.id, "WAVE-REF-44");
    await confirmerVersement(versement.id);

    await retournerVersement(versement.id, "compte fermé");

    const soldes = await db.balance.findMany({ where: { userId: createur } });
    expect(soldes.every((b) => b.state === "UNPAID")).toBe(true);
  });

  it("refuse les transitions qui n'ont pas de sens", async () => {
    await vendre(10_000, new Date("2026-07-20T10:00:00Z"));
    const { versement } = await preparer();

    // Confirmer sans avoir envoyé.
    await expect(confirmerVersement(versement.id)).rejects.toThrow(/interdit/);

    await marquerVersementEnvoye(versement.id, "REF");
    await confirmerVersement(versement.id);

    // Un versement terminé ne se réenvoie pas.
    await expect(
      marquerVersementEnvoye(versement.id, "REF-2"),
    ).rejects.toThrow(/interdit/);
    // Ni ne se confirme deux fois.
    await expect(confirmerVersement(versement.id)).rejects.toThrow(/interdit/);
  });

  it("ne verse pas deux fois les mêmes soldes", async () => {
    await vendre(10_000, new Date("2026-07-20T10:00:00Z"));
    await preparer();

    // Les soldes sont pris : il ne reste rien à verser.
    await expect(preparer()).rejects.toThrow(/Aucun solde versable/);
    expect(await db.payout.count()).toBe(1);
  });

  it("refuse de verser sous le seuil, sauf ordre explicite", async () => {
    // 600 F bruts : le net tombe sous le minimum de 1 000 F.
    await vendre(600, new Date("2026-07-20T10:00:00Z"));

    await expect(preparer()).rejects.toThrow(/Aucun solde versable/);

    const { versement } = await preparer(true);
    expect(versement.amount).toBeGreaterThan(0);
  });

  it("ne réclame jamais d'argent au créateur", async () => {
    // Tout remboursé : le solde net de la période retombe à zéro.
    const a = await vendre(10_000, new Date("2026-07-20T10:00:00Z"));
    await rembourserLigne({
      orderItemId: a.ligneId,
      amount: 10_000,
      date: new Date("2026-07-21T10:00:00Z"),
    });

    await expect(preparer(true)).rejects.toThrow(/Aucun solde versable/);
    expect(await db.payout.count()).toBe(0);
  });

  it("n'emporte pas les soldes d'un autre créateur", async () => {
    const autre = await compte("voisin@vers.test");
    const produitVoisin = await db.product.create({
      data: {
        sellerId: autre,
        slug: `w-${Math.random().toString(36).slice(2, 9)}`,
        name: "Voisin",
        price: 10_000,
        currency: "XOF",
        status: "PUBLISHED",
      },
      select: { id: true },
    });
    const o = await db.order.create({
      data: {
        buyerId: acheteur,
        currency: "XOF",
        total: 10_000,
        status: "COMPLETED",
        items: {
          create: {
            productId: produitVoisin.id,
            price: 10_000,
            quantity: 1,
            state: "IN_PROGRESS",
          },
        },
      },
      select: { items: { select: { id: true } } },
    });
    await encaisserLigne({
      orderItemId: o.items[0]!.id,
      regime: "DIRECT",
      date: new Date("2026-07-20T10:00:00Z"),
    });

    await vendre(10_000, new Date("2026-07-20T10:00:00Z"));
    const { versement } = await preparer();

    const prisAilleurs = await db.balance.count({
      where: { payoutId: versement.id, userId: { not: createur } },
    });
    expect(prisAilleurs).toBe(0);

    const voisin = await db.balance.findMany({ where: { userId: autre } });
    expect(voisin.every((b) => b.state === "UNPAID")).toBe(true);
  });
});

describe("le passage hebdomadaire", () => {
  const CYCLE = new Date("2026-07-31T00:00:00Z"); // un vendredi

  async function creerCreateurPayable(input: {
    email: string;
    provider?: string;
    riskState?: "COMPLIANT" | "FLAGGED_FRAUD" | "SUSPENDED_TOS" | "NOT_REVIEWED";
    suspendu?: boolean;
    versementsSuspendus?: boolean;
    frequence?: "WEEKLY" | "MONTHLY";
    avecCompte?: boolean;
  }) {
    const u = await db.user.create({
      data: {
        email: input.email,
        defaultCurrency: "XOF",
        riskState: input.riskState ?? "COMPLIANT",
        suspendedAt: input.suspendu ? new Date() : null,
        payoutsPausedAt: input.versementsSuspendus ? new Date() : null,
        payoutFrequency: input.frequence ?? "WEEKLY",
        ...(input.avecCompte === false
          ? {}
          : {
              payoutAccounts: {
                create: {
                  method: "MOBILE_MONEY",
                  provider: input.provider ?? "wave",
                  accountRef: "+221770000001",
                },
              },
            }),
      },
      select: { id: true },
    });

    const p = await db.product.create({
      data: {
        sellerId: u.id,
        slug: `cy-${Math.random().toString(36).slice(2, 9)}`,
        name: "Pack",
        price: 10_000,
        currency: "XOF",
        status: "PUBLISHED",
      },
      select: { id: true },
    });

    const o = await db.order.create({
      data: {
        buyerId: acheteur,
        currency: "XOF",
        total: 10_000,
        status: "COMPLETED",
        items: {
          create: {
            productId: p.id,
            price: 10_000,
            quantity: 1,
            state: "IN_PROGRESS",
          },
        },
      },
      select: { items: { select: { id: true } } },
    });

    await encaisserLigne({
      orderItemId: o.items[0]!.id,
      regime: "DIRECT",
      date: new Date("2026-07-20T10:00:00Z"),
    });

    return u.id;
  }

  it("prépare un versement par créateur éligible", async () => {
    const a = await creerCreateurPayable({ email: "a@cycle.test" });
    const b = await creerCreateurPayable({ email: "b@cycle.test" });

    const r = await preparerLeCycle({ cycleDate: CYCLE, rails: ["wave"] });

    expect(r.prepares.map((p) => p.userId).sort()).toEqual([a, b].sort());
    expect(await db.payout.count()).toBe(2);

    // Les soldes sont réservés, pas encore payés : rien n'est parti chez un
    // opérateur.
    const soldes = await db.balance.findMany({ where: { payoutId: { not: null } } });
    expect(soldes.every((s) => s.state === "PROCESSING")).toBe(true);
    const versements = await db.payout.findMany();
    expect(versements.every((v) => v.status === "CREATING")).toBe(true);
  });

  it("n'appelle que les rails du jour", async () => {
    await creerCreateurPayable({ email: "wave@cycle.test", provider: "wave" });
    const jeudi = await creerCreateurPayable({
      email: "bank@cycle.test",
      provider: "bank",
    });

    // Un créateur payé le jeudi n'a rien à faire dans le passage du mardi.
    const r = await preparerLeCycle({ cycleDate: CYCLE, rails: ["wave"] });
    expect(r.prepares.map((p) => p.userId)).not.toContain(jeudi);
    expect(await db.payout.count()).toBe(1);
  });

  it("écarte les comptes suspendus, signalés, ou aux versements arrêtés", async () => {
    await creerCreateurPayable({ email: "sus@cycle.test", suspendu: true });
    await creerCreateurPayable({
      email: "flag@cycle.test",
      riskState: "FLAGGED_FRAUD",
    });
    await creerCreateurPayable({
      email: "pause@cycle.test",
      versementsSuspendus: true,
    });

    const r = await preparerLeCycle({ cycleDate: CYCLE, rails: ["wave"] });

    expect(r.prepares).toHaveLength(0);
    expect(r.ecartes.map((e) => e.raison).sort()).toEqual([
      "SOUS_ENQUETE",
      "SUSPENDU",
      "VERSEMENTS_SUSPENDUS",
    ]);
    expect(await db.payout.count()).toBe(0);
  });

  it("laisse le solde intact quand un créateur est écarté", async () => {
    const flag = await creerCreateurPayable({
      email: "flag2@cycle.test",
      riskState: "FLAGGED_FRAUD",
    });

    await preparerLeCycle({ cycleDate: CYCLE, rails: ["wave"] });

    // Le message promet que l'argent est conservé : il doit l'être.
    const soldes = await db.balance.findMany({ where: { userId: flag } });
    expect(soldes.every((s) => s.state === "UNPAID")).toBe(true);
    expect(soldes.reduce((t, s) => t + s.holdingAmount, 0)).toBeGreaterThan(0);
  });

  it("ne retient pas un créateur mensuel sur un cycle qui n'est pas le sien", async () => {
    const mensuel = await creerCreateurPayable({
      email: "mois@cycle.test",
      frequence: "MONTHLY",
    });

    // 24 juillet 2026 est un vendredi, mais pas le dernier du mois.
    const tot = await preparerLeCycle({
      cycleDate: new Date("2026-07-24T00:00:00Z"),
      rails: ["wave"],
    });
    expect(tot.prepares.map((p) => p.userId)).not.toContain(mensuel);

    // 31 juillet est le dernier vendredi de juillet : c'est son cycle.
    const bon = await preparerLeCycle({ cycleDate: CYCLE, rails: ["wave"] });
    expect(bon.prepares.map((p) => p.userId)).toContain(mensuel);
  });

  it("ne prépare rien en simulation", async () => {
    await creerCreateurPayable({ email: "sim@cycle.test" });

    const r = await preparerLeCycle({
      cycleDate: CYCLE,
      rails: ["wave"],
      simulation: true,
    });

    expect(r.prepares).toHaveLength(1);
    expect(await db.payout.count()).toBe(0);
    const soldes = await db.balance.findMany();
    expect(soldes.every((s) => s.state === "UNPAID")).toBe(true);
  });

  it("ne repasse pas deux fois sur le même cycle", async () => {
    await creerCreateurPayable({ email: "double@cycle.test" });

    const premier = await preparerLeCycle({ cycleDate: CYCLE, rails: ["wave"] });
    expect(premier.prepares).toHaveLength(1);

    // Les soldes sont pris : le second passage n'a plus rien à verser.
    const second = await preparerLeCycle({ cycleDate: CYCLE, rails: ["wave"] });
    expect(second.prepares).toHaveLength(0);
    expect(await db.payout.count()).toBe(1);
  });

  it("un créateur en échec n'emporte pas les suivants", async () => {
    // Le rail enregistré n'existe plus : ce créateur sera écarté, les autres
    // doivent quand même être payés.
    await creerCreateurPayable({ email: "casse@cycle.test", provider: "disparu" });
    const bon = await creerCreateurPayable({ email: "bon@cycle.test" });

    const r = await preparerLeCycle({
      cycleDate: CYCLE,
      rails: ["wave", "disparu"],
    });

    expect(r.prepares.map((p) => p.userId)).toContain(bon);
    expect(r.ecartes.some((e) => e.raison === "RAIL_INCONNU")).toBe(true);
  });

  it("ignore un créateur sans compte de versement", async () => {
    await creerCreateurPayable({ email: "sanscompte@cycle.test", avecCompte: false });

    const r = await preparerLeCycle({ cycleDate: CYCLE, rails: ["wave"] });

    // Filtré en base : il n'apparaît même pas dans les écartés, et surtout on
    // ne lit pas tous les comptes de la plateforme pour le découvrir.
    expect(r.prepares).toHaveLength(0);
    expect(r.ecartes).toHaveLength(0);
  });

  it("écarte un solde sous le seuil sans le perdre", async () => {
    const petit = await db.user.create({
      data: {
        email: "petit@cycle.test",
        defaultCurrency: "XOF",
        payoutAccounts: {
          create: {
            method: "MOBILE_MONEY",
            provider: "wave",
            accountRef: "+221770000009",
          },
        },
      },
      select: { id: true },
    });

    const p = await db.product.create({
      data: {
        sellerId: petit.id,
        slug: `pt-${Math.random().toString(36).slice(2, 9)}`,
        name: "Petit",
        price: 600,
        currency: "XOF",
        status: "PUBLISHED",
      },
      select: { id: true },
    });
    const o = await db.order.create({
      data: {
        buyerId: acheteur,
        currency: "XOF",
        total: 600,
        status: "COMPLETED",
        items: {
          create: { productId: p.id, price: 600, quantity: 1, state: "IN_PROGRESS" },
        },
      },
      select: { items: { select: { id: true } } },
    });
    await encaisserLigne({
      orderItemId: o.items[0]!.id,
      regime: "DIRECT",
      date: new Date("2026-07-20T10:00:00Z"),
    });

    const r = await preparerLeCycle({ cycleDate: CYCLE, rails: ["wave"] });

    expect(r.ecartes.some((e) => e.raison === "SOUS_LE_SEUIL")).toBe(true);
    const soldes = await db.balance.findMany({ where: { userId: petit.id } });
    expect(soldes.every((s) => s.state === "UNPAID")).toBe(true);
  });
});
