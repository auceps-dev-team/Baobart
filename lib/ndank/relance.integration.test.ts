/**
 * L'adaptateur Ndank de Baobart, contre la vraie base.
 *
 * ─────────────────────────────────────────────────────────────────
 * DEUX PROPRIÉTÉS QUI DOIVENT TENIR
 *
 *   — ce que la personne a fermé dans ses réglages ferme aussi le canal chez
 *     Ndank. Sans ce croisement, l'écran de réglages mentirait : on couperait
 *     les courriels de relance et on continuerait d'en recevoir ;
 *   — une relance partie laisse une trace dans l'application, une seule, et
 *     uniquement en in-app — Ndank vient d'envoyer le message lui-même, le
 *     repasser par le courriel l'enverrait deux fois.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { PORTS_BAOBART } from "@/lib/ndank/baobart";
import { enregistrer } from "@/lib/notifications/preferences";

const { lecture, ecriture, envoi } = PORTS_BAOBART;

let n = 0;

async function abonne() {
  n += 1;
  const utilisateur = await db.user.create({
    data: {
      email: `ndank-${n}@baobart.test`,
      phone: "+2250700000000",
      profile: {
        create: {
          username: `abonne-${n}`,
          displayName: `Abonné ${n}`,
          country: "CI",
        },
      },
    },
    select: { id: true, email: true },
  });

  // `PlanCode` est un enum à trois valeurs : un plan par test est impossible.
  // On réutilise le même, créé une fois — le `TRUNCATE` du montage le vide
  // entre chaque test, donc `upsert` retombe toujours sur la création.
  const plan = await db.plan.upsert({
    where: { code: "EXPLORER" },
    update: {},
    create: { code: "EXPLORER", name: "Pass créateur", priceMonthly: 5000 },
    select: { id: true, name: true },
  });

  const abonnement = await db.subscription.create({
    data: {
      userId: utilisateur.id,
      planId: plan.id,
      status: "ACTIVE",
      cycleStart: new Date("2026-09-01T00:00:00Z"),
      cycleEnd: new Date("2026-10-01T00:00:00Z"),
    },
    select: { id: true },
  });

  return { utilisateur, plan, abonnement };
}

beforeEach(() => {
  n = 0;
});

describe("les coordonnées", () => {
  it("n'ouvrent aucun refus quand rien n'a été réglé", async () => {
    const { utilisateur } = await abonne();

    const ou = await lecture.coordonnees(utilisateur.id);

    expect(ou.abonneId).toBe(utilisateur.id);
    expect(ou.courriel).toBe(utilisateur.email);
    expect(ou.refuses).toEqual([]);
    // Et le canal est donc disponible.
    expect(envoi.disponible("courriel", ou)).toBe(true);
  });

  it("ferment le courriel quand la personne l'a coupé", async () => {
    // Le croisement des deux décideurs : le moteur choisit QUEL canal, l'hôte
    // sait ce qui a été accepté.
    const { utilisateur } = await abonne();
    await enregistrer({
      utilisateurId: utilisateur.id,
      evenement: "ABONNEMENT_A_RENOUVELER",
      canal: "COURRIEL",
      actif: false,
    });

    const ou = await lecture.coordonnees(utilisateur.id);

    expect(ou.refuses).toContain("courriel");
    // Fermé se comporte exactement comme absent, alors que l'adresse est là.
    expect(ou.courriel).not.toBeNull();
    expect(envoi.disponible("courriel", ou)).toBe(false);
  });

  it("ne touchent pas au SMS, qui n'a pas de réglage", async () => {
    // Il n'est pas au catalogue des notifications et ne part qu'au dernier
    // palier, quand l'accès est sur le point de se fermer.
    const { utilisateur } = await abonne();
    await enregistrer({
      utilisateurId: utilisateur.id,
      evenement: "ABONNEMENT_A_RENOUVELER",
      canal: "COURRIEL",
      actif: false,
    });

    const ou = await lecture.coordonnees(utilisateur.id);

    expect(ou.refuses).not.toContain("sms");
    expect(envoi.disponible("sms", ou)).toBe(true);
  });
});

describe("la trace dans l'application", () => {
  it("se pose quand la relance est notée", async () => {
    const { utilisateur, abonnement, plan } = await abonne();

    await ecriture.noterRelance(abonnement.id, "cycle-1:palier-1", ["courriel"]);

    const avis = await db.notification.findMany({
      where: { userId: utilisateur.id },
    });

    expect(avis).toHaveLength(1);
    expect(avis[0]?.type).toBe("ABONNEMENT_A_RENOUVELER");
    expect(avis[0]?.titre).toContain(plan.name);
    expect(avis[0]?.lien).toBe("/dashboard/forfait");
  });

  it("n'envoie aucun courriel — Ndank vient de le faire", async () => {
    // Le cœur de la restriction. Sans elle, l'abonné recevrait deux fois le
    // même message : une fois par Ndank, une fois par l'aiguilleur.
    const { abonnement } = await abonne();

    await ecriture.noterRelance(abonnement.id, "cycle-1:palier-1", ["courriel"]);

    expect(await db.emailOutbox.count()).toBe(0);
  });

  it("ne se pose qu'une fois, même si deux passages se croisent", async () => {
    // La ligne `SubscriptionReminder` porte une clé unique : le second passage
    // la perd, et doit sortir AVANT d'écrire un second avis.
    const { utilisateur, abonnement } = await abonne();

    await ecriture.noterRelance(abonnement.id, "cycle-1:palier-1", ["courriel"]);
    await ecriture.noterRelance(abonnement.id, "cycle-1:palier-1", ["sms"]);

    expect(
      await db.notification.count({ where: { userId: utilisateur.id } }),
    ).toBe(1);
    expect(await db.subscriptionReminder.count()).toBe(1);
  });

  it("respecte une préférence in-app coupée", async () => {
    // La restriction de canal est croisée avec les préférences : elle ne peut
    // pas ouvrir ce que la personne a fermé.
    const { utilisateur, abonnement } = await abonne();
    await enregistrer({
      utilisateurId: utilisateur.id,
      evenement: "ABONNEMENT_A_RENOUVELER",
      canal: "IN_APP",
      actif: false,
    });

    await ecriture.noterRelance(abonnement.id, "cycle-1:palier-1", ["courriel"]);

    expect(
      await db.notification.count({ where: { userId: utilisateur.id } }),
    ).toBe(0);
    // La relance, elle, reste notée : elle est bien partie.
    expect(await db.subscriptionReminder.count()).toBe(1);
  });
});
