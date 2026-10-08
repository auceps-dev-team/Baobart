/**
 * Le renouvellement d'abonnement, de bout en bout.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUI COMPTE ICI N'EST PAS LE CAS NOMINAL
 *
 * Un renouvellement qui marche se voit tout de suite. Ce qui ne se voit pas,
 * et qui coûte :
 *
 *   — un rejeu qui avance le cycle DEUX fois : l'abonné gagne deux mois pour un
 *     paiement, et rien ne le signale ;
 *   — un cycle qui s'enchaîne sur la date de paiement au lieu de l'échéance :
 *     l'abonné paie onze mois au lieu de douze, sur un an ;
 *   — un montant insuffisant accepté : un mois d'accès pour cent francs ;
 *   — un paiement encaissé qui ne réveille pas un abonnement suspendu.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { finaliserRenouvellement, perimerPaiementsOublies } from "@/lib/abonnements/reglement";
import {
  ouvrirRenouvellement,
  referenceDe,
} from "@/lib/abonnements/renouvellement";
import { ajouterJours, joursEntre } from "@/lib/ndank/cycle";
import type { FaitPaiement } from "@/lib/payments/encaissement/pilotes";
import { recevoir } from "@/lib/payments/encaissement/reception";

const AVANT = { ...process.env };

const PRIX = 2_000;

beforeEach(() => {
  // Pas de simulation : on veut le vrai chemin, celui qui laisse le paiement
  // ouvert en attendant le rappel.
  delete process.env.CHECKOUT_SIMULATION_ENABLED;
  process.env.PAYMENTS_DRIVER = "bac-a-sable";
  process.env.PAYMENTS_SANDBOX_SECRET = "un-secret-de-bac-a-sable-assez-long";
  process.env.APP_URL = "https://baobart.test";
});

afterEach(() => {
  process.env = { ...AVANT };
});

let n = 0;

async function abonne(options: { echeance: Date; statut?: "ACTIVE" | "CANCELLED" | "PENDING_CANCELLATION" | "EXPIRED" }) {
  n += 1;

  const utilisateur = await db.user.create({
    data: {
      email: `abo-${n}@baobart.test`,
      profile: { create: { username: `abo-${n}`, displayName: `Awa ${n}` } },
    },
    select: { id: true, email: true },
  });

  // `PlanCode` est unique et n'a que trois valeurs : un test qui crée deux
  // abonnés ne peut pas créer deux plans. On réutilise celui qui est là — la
  // base est vidée entre chaque test, donc il n'y en a jamais qu'un.
  const plan = await db.plan.upsert({
    where: { code: "DISCOVERY" },
    update: {},
    create: { code: "DISCOVERY", name: "Pass Découverte", priceMonthly: PRIX },
    select: { id: true },
  });

  const abonnement = await db.subscription.create({
    data: {
      userId: utilisateur.id,
      planId: plan.id,
      status: options.statut ?? "ACTIVE",
      cycleStart: ajouterJours(options.echeance, -30),
      cycleEnd: options.echeance,
      cadence: "MENSUEL",
      cancelledAt: options.statut === "PENDING_CANCELLATION" ? new Date() : null,
    },
    select: { id: true, cycleEnd: true },
  });

  return { utilisateur, abonnement };
}

let e = 0;

function fait(reference: string, patch: Partial<FaitPaiement> = {}): FaitPaiement {
  e += 1;
  return {
    sens: "ENCAISSEMENT",
    evenement: `evt-abo-${e}`,
    reference,
    referenceOperateur: `op-${e}`,
    issue: "REUSSI",
    montant: PRIX,
    devise: "XOF",
    ...patch,
  };
}

async function lire(abonnementId: string) {
  return db.subscription.findUniqueOrThrow({
    where: { id: abonnementId },
    select: {
      status: true,
      cycleStart: true,
      cycleEnd: true,
      cancelledAt: true,
      providerRef: true,
    },
  });
}

describe("ouvrir un renouvellement", () => {
  it("inscrit un paiement en attente sans toucher au cycle", async () => {
    const { utilisateur, abonnement } = await abonne({
      echeance: ajouterJours(new Date(), 2),
    });

    const suite = await ouvrirRenouvellement({
      abonnementId: abonnement.id,
      abonneId: utilisateur.id,
    });

    expect(suite.ok).toBe(true);
    if (!suite.ok) return;
    expect(suite.paye).toBe(false);

    // Le cycle n'a PAS bougé : rien n'est encore payé.
    const apres = await lire(abonnement.id);
    expect(apres.cycleEnd.getTime()).toBe(abonnement.cycleEnd.getTime());

    const paiement = await db.subscriptionPayment.findUniqueOrThrow({
      where: { id: suite.paiementId },
      select: { status: true, amount: true, subscriptionId: true },
    });
    expect(paiement.status).toBe("PENDING");
    // Le montant est figé à l'ouverture : un changement de tarif ne doit pas
    // modifier un paiement déjà autorisé.
    expect(paiement.amount).toBe(PRIX);
    expect(paiement.subscriptionId).toBe(abonnement.id);
  });

  it("ne crée aucune commande — l'argent n'est celui d'aucun vendeur", async () => {
    // Le défaut que ce test empêche : faire passer un abonnement par `Order`
    // créditerait le solde d'un vendeur inventé, et fabriquerait une dette de
    // versement envers quelqu'un à qui l'on ne doit rien.
    const { utilisateur, abonnement } = await abonne({
      echeance: ajouterJours(new Date(), 2),
    });

    await ouvrirRenouvellement({
      abonnementId: abonnement.id,
      abonneId: utilisateur.id,
    });

    expect(await db.order.count()).toBe(0);
    expect(await db.orderItem.count()).toBe(0);
  });

  it("refuse l'abonnement d'autrui, sans dire qu'il existe", async () => {
    const { abonnement } = await abonne({ echeance: ajouterJours(new Date(), 2) });
    const { utilisateur: autre } = await abonne({
      echeance: ajouterJours(new Date(), 2),
    });

    const suite = await ouvrirRenouvellement({
      abonnementId: abonnement.id,
      abonneId: autre.id,
    });

    expect(suite).toEqual({ ok: false, motif: "INTROUVABLE" });
  });

  it("bloque un second clic dans la foulée", async () => {
    const { utilisateur, abonnement } = await abonne({
      echeance: ajouterJours(new Date(), 2),
    });

    await ouvrirRenouvellement({
      abonnementId: abonnement.id,
      abonneId: utilisateur.id,
    });
    const second = await ouvrirRenouvellement({
      abonnementId: abonnement.id,
      abonneId: utilisateur.id,
    });

    expect(second).toEqual({ ok: false, motif: "EN_COURS" });
    expect(await db.subscriptionPayment.count()).toBe(1);
  });

  it("refuse un abonnement clos", async () => {
    const { utilisateur, abonnement } = await abonne({
      echeance: ajouterJours(new Date(), -120),
      statut: "CANCELLED",
    });

    const suite = await ouvrirRenouvellement({
      abonnementId: abonnement.id,
      abonneId: utilisateur.id,
    });

    expect(suite).toEqual({ ok: false, motif: "CLOS" });
  });

  it("accepte celui qui avait demandé à résilier", async () => {
    // Ndank écrit aux PENDING_CANCELLATION tant qu'il leur reste de l'accès.
    // Leur refuser le paiement que nos propres relances les invitent à faire
    // serait incohérent.
    const { utilisateur, abonnement } = await abonne({
      echeance: ajouterJours(new Date(), 2),
      statut: "PENDING_CANCELLATION",
    });

    const suite = await ouvrirRenouvellement({
      abonnementId: abonnement.id,
      abonneId: utilisateur.id,
    });

    expect(suite.ok).toBe(true);
  });
});

describe("le rappel de l'opérateur", () => {
  async function ouvert(echeance: Date) {
    const { utilisateur, abonnement } = await abonne({ echeance });
    const suite = await ouvrirRenouvellement({
      abonnementId: abonnement.id,
      abonneId: utilisateur.id,
    });
    if (!suite.ok) throw new Error(`ouverture refusée : ${suite.motif}`);
    return { utilisateur, abonnement, paiementId: suite.paiementId };
  }

  it("avance le cycle et dépose le reçu", async () => {
    const echeance = ajouterJours(new Date(), 2);
    const { utilisateur, abonnement, paiementId } = await ouvert(echeance);

    const suite = await recevoir(
      "bac-a-sable",
      fait(referenceDe(paiementId)),
      {},
    );

    expect(suite).toEqual({ recu: true, effet: "RENOUVELE" });

    const apres = await lire(abonnement.id);
    expect(apres.status).toBe("ACTIVE");
    // Trente jours de plus, comptés depuis l'ANCIENNE échéance.
    expect(joursEntre(echeance, apres.cycleEnd)).toBe(30);

    const courriel = await db.emailOutbox.findFirstOrThrow({
      where: { recipient: utilisateur.email },
      select: { template: true, payload: true },
    });
    expect(courriel.template).toBe("RECU_ABONNEMENT");
    expect((courriel.payload as { prochaine: string }).prochaine.length)
      .toBeGreaterThan(0);

    // Depuis v1.52.1, le reçu passe par l'aiguilleur : il laisse aussi une
    // trace dans l'application. C'est ce qui permet de retrouver la preuve
    // d'un prélèvement sans relever sa boîte.
    //
    // Les deux écritures sont dans la MÊME transaction que le paiement. Si
    // l'une manquait ici, c'est que l'atomicité a été perdue en route.
    const avis = await db.notification.findFirstOrThrow({
      where: { userId: utilisateur.id },
      select: { type: true, titre: true, corps: true, lien: true, readAt: true },
    });
    expect(avis.type).toBe("ABONNEMENT_RECU");
    expect(avis.lien).toBe("/dashboard/forfait");
    expect(avis.corps).toMatch(/Prochaine échéance/);
    expect(avis.readAt).toBeNull();
  });

  it("n'écrit ni reçu ni avis quand le paiement ne passe pas", async () => {
    // L'autre moitié de l'atomicité, et la plus importante : un paiement qui
    // ne se règle pas ne doit laisser aucune trace de reçu. Avant que
    // l'aiguilleur sache entrer dans la transaction, l'avis serait parti
    // quand même — et l'abonné aurait lu « renouvelé » sans l'être.
    const echeance = ajouterJours(new Date(), 2);
    const { paiementId } = await ouvert(echeance);

    // Un paiement déjà réglé : la garde d'état refuse, rien ne doit s'écrire.
    await db.subscriptionPayment.update({
      where: { id: paiementId },
      data: { status: "PAID" },
    });

    await recevoir("bac-a-sable", fait(referenceDe(paiementId)), {});

    expect(await db.emailOutbox.count()).toBe(0);
    expect(await db.notification.count()).toBe(0);
  });

  it("n'avance le cycle qu'une fois, même rejoué", async () => {
    // LE test de ce fichier. Sans la garde dans le `WHERE`, un opérateur qui
    // rejoue offrirait un mois par rejeu — et personne ne le verrait.
    const echeance = ajouterJours(new Date(), 2);
    const { abonnement, paiementId } = await ouvert(echeance);

    const reference = referenceDe(paiementId);
    await recevoir("bac-a-sable", fait(reference), {});
    // Un événement DIFFÉRENT : l'anti-rejeu par clé d'événement ne protège
    // pas, et c'est la garde d'état qui doit tenir.
    const second = await recevoir("bac-a-sable", fait(reference), {});

    expect(second).toEqual({ recu: true, effet: "SANS_EFFET" });

    const apres = await lire(abonnement.id);
    expect(joursEntre(echeance, apres.cycleEnd)).toBe(30);
    expect(await db.emailOutbox.count()).toBe(1);
  });

  it("enchaîne sur l'échéance, pas sur la date de paiement", async () => {
    // Un abonné qui paie trois jours en retard chaque mois verrait sinon son
    // échéance glisser — et paierait onze mois au lieu de douze sur un an.
    const echeance = ajouterJours(new Date(), -3);
    const { abonnement, paiementId } = await ouvert(echeance);

    await recevoir("bac-a-sable", fait(referenceDe(paiementId)), {});

    const apres = await lire(abonnement.id);
    expect(joursEntre(echeance, apres.cycleEnd)).toBe(30);
  });

  it("repart du jour du paiement quand l'accès était déjà éteint", async () => {
    // L'exception : enchaîner sur une échéance vieille de trois semaines
    // facturerait une période déjà écoulée.
    const echeance = ajouterJours(new Date(), -40);
    const { abonnement, paiementId } = await ouvert(echeance);

    await recevoir("bac-a-sable", fait(referenceDe(paiementId)), {});

    const apres = await lire(abonnement.id);
    expect(joursEntre(new Date(), apres.cycleEnd)).toBe(30);
  });

  it("réveille un abonnement suspendu", async () => {
    const { utilisateur, abonnement } = await abonne({
      echeance: ajouterJours(new Date(), -40),
      statut: "EXPIRED",
    });
    const ouverture = await ouvrirRenouvellement({
      abonnementId: abonnement.id,
      abonneId: utilisateur.id,
    });
    if (!ouverture.ok) throw new Error("ouverture refusée");

    await recevoir("bac-a-sable", fait(referenceDe(ouverture.paiementId)), {});

    expect((await lire(abonnement.id)).status).toBe("ACTIVE");
  });

  it("annule une résiliation demandée", async () => {
    const { utilisateur, abonnement } = await abonne({
      echeance: ajouterJours(new Date(), 2),
      statut: "PENDING_CANCELLATION",
    });
    const ouverture = await ouvrirRenouvellement({
      abonnementId: abonnement.id,
      abonneId: utilisateur.id,
    });
    if (!ouverture.ok) throw new Error("ouverture refusée");

    await recevoir("bac-a-sable", fait(referenceDe(ouverture.paiementId)), {});

    const apres = await lire(abonnement.id);
    expect(apres.status).toBe("ACTIVE");
    expect(apres.cancelledAt).toBeNull();
  });

  it("refuse un montant insuffisant, et n'avance rien", async () => {
    const echeance = ajouterJours(new Date(), 2);
    const { abonnement, paiementId } = await ouvert(echeance);

    const suite = await recevoir(
      "bac-a-sable",
      fait(referenceDe(paiementId), { montant: 100 }),
      {},
    );

    expect(suite.recu).toBe(false);
    const apres = await lire(abonnement.id);
    expect(apres.cycleEnd.getTime()).toBe(echeance.getTime());
  });

  it("refuse un succès sans montant, que rien ne peut confirmer", async () => {
    const echeance = ajouterJours(new Date(), 2);
    const { abonnement, paiementId } = await ouvert(echeance);

    const suite = await recevoir(
      "bac-a-sable",
      fait(referenceDe(paiementId), { montant: null }),
      {},
    );

    expect(suite.recu === false && suite.motif).toBe("MONTANT_ABSENT");
    const apres = await lire(abonnement.id);
    expect(apres.cycleEnd.getTime()).toBe(echeance.getTime());
  });

  it("accepte un montant supérieur plutôt que de couper un accès payé", async () => {
    const echeance = ajouterJours(new Date(), 2);
    const { abonnement, paiementId } = await ouvert(echeance);

    const suite = await recevoir(
      "bac-a-sable",
      fait(referenceDe(paiementId), { montant: PRIX + 50 }),
      {},
    );

    expect(suite).toEqual({ recu: true, effet: "RENOUVELE" });
    expect(joursEntre(echeance, (await lire(abonnement.id)).cycleEnd)).toBe(30);
  });

  it("refuse une autre devise", async () => {
    const { paiementId } = await ouvert(ajouterJours(new Date(), 2));

    const suite = await recevoir(
      "bac-a-sable",
      fait(referenceDe(paiementId), { devise: "EUR" }),
      {},
    );

    expect(suite.recu).toBe(false);
  });

  it("referme le paiement sur un échec, sans toucher au cycle", async () => {
    const echeance = ajouterJours(new Date(), 2);
    const { abonnement, paiementId } = await ouvert(echeance);

    const suite = await recevoir(
      "bac-a-sable",
      fait(referenceDe(paiementId), { issue: "ECHOUE" }),
      {},
    );

    expect(suite).toEqual({ recu: true, effet: "RENOUVELLEMENT_ECHOUE" });
    expect((await lire(abonnement.id)).cycleEnd.getTime()).toBe(
      echeance.getTime(),
    );
  });

  it("ne renverse pas un renouvellement déjà payé", async () => {
    // Un « échoué » arrive parfois après un « réussi ». Le suivre couperait
    // l'accès de quelqu'un qui a payé.
    const echeance = ajouterJours(new Date(), 2);
    const { abonnement, paiementId } = await ouvert(echeance);
    const reference = referenceDe(paiementId);

    await recevoir("bac-a-sable", fait(reference), {});
    const tardif = await recevoir(
      "bac-a-sable",
      fait(reference, { issue: "ECHOUE" }),
      {},
    );

    expect(tardif).toEqual({ recu: true, effet: "SANS_EFFET" });
    const apres = await lire(abonnement.id);
    expect(apres.status).toBe("ACTIVE");
    expect(joursEntre(echeance, apres.cycleEnd)).toBe(30);
  });

  it("ne décide de rien sur une étape intermédiaire", async () => {
    const echeance = ajouterJours(new Date(), 2);
    const { abonnement, paiementId } = await ouvert(echeance);

    const suite = await recevoir(
      "bac-a-sable",
      fait(referenceDe(paiementId), { issue: "EN_COURS" }),
      {},
    );

    expect(suite).toEqual({ recu: true, effet: "SANS_EFFET" });
    expect((await lire(abonnement.id)).cycleEnd.getTime()).toBe(
      echeance.getTime(),
    );
  });

  it("refuse une référence d'abonnement qui n'existe pas", async () => {
    const suite = await recevoir(
      "bac-a-sable",
      fait(referenceDe("clx-inexistant")),
      {},
    );

    expect(suite.recu).toBe(false);
    if (suite.recu) return;
    expect(suite.motif).toBe("ABONNEMENT_INTROUVABLE");
  });

  it("n'attrape pas les rappels de commande", async () => {
    // L'autre moitié de l'aiguillage : une référence nue doit continuer à
    // chercher parmi les commandes.
    const suite = await recevoir("bac-a-sable", fait("clx0123456789"), {});

    expect(suite.recu).toBe(false);
    if (suite.recu) return;
    expect(suite.motif).toBe("COMMANDE_INTROUVABLE");
  });
});

describe("le ménage", () => {
  it("referme un paiement qu'aucun rappel n'est venu conclure", async () => {
    const { utilisateur, abonnement } = await abonne({
      echeance: ajouterJours(new Date(), 2),
    });
    const ouverture = await ouvrirRenouvellement({
      abonnementId: abonnement.id,
      abonneId: utilisateur.id,
    });
    if (!ouverture.ok) throw new Error("ouverture refusée");

    // Rien ne bouge avant vingt-quatre heures : l'invite mobile money part sur
    // un téléphone qui peut être hors réseau des heures durant.
    expect(await perimerPaiementsOublies()).toBe(0);

    const demain = new Date(Date.now() + 25 * 3_600_000);
    expect(await perimerPaiementsOublies(demain)).toBe(1);

    expect(
      (
        await db.subscriptionPayment.findUniqueOrThrow({
          where: { id: ouverture.paiementId },
          select: { status: true },
        })
      ).status,
    ).toBe("FAILED");
  });

  it("ne referme pas un paiement déjà réglé", async () => {
    const { utilisateur, abonnement } = await abonne({
      echeance: ajouterJours(new Date(), 2),
    });
    const ouverture = await ouvrirRenouvellement({
      abonnementId: abonnement.id,
      abonneId: utilisateur.id,
    });
    if (!ouverture.ok) throw new Error("ouverture refusée");

    await finaliserRenouvellement(ouverture.paiementId);

    const demain = new Date(Date.now() + 25 * 3_600_000);
    expect(await perimerPaiementsOublies(demain)).toBe(0);
  });
});
