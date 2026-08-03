import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { soldeVersableJusqua } from "@/lib/domain/balances";
import { encaisserLigne, rembourserLigne } from "@/lib/domain/orders";
import {
  RAILS_BAOBART,
  finDePeriodePourVersement,
  projeterVersements,
} from "@/lib/payments/payout-schedule";

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

describe("ce qui manque encore", () => {
  it("aucun versement n'est exécuté : le modèle existe, le geste non", async () => {
    await vendre(10_000, new Date("2026-07-20T10:00:00Z"));

    // Le solde est bien porté au crédit du créateur…
    const soldes = await db.balance.findMany({ where: { userId: createur } });
    expect(soldes.length).toBeGreaterThan(0);
    expect(soldes.every((b) => b.state === "UNPAID")).toBe(true);

    // …mais rien ne le fait passer en versement. Ce test n'est pas une
    // vérification : c'est un constat, qui échouera le jour où l'exécution
    // arrivera, et rappellera de l'éprouver pour de bon.
    expect(await db.payout.count()).toBe(0);
  });
});
