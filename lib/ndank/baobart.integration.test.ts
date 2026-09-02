/**
 * Ndank branché sur Baobart, contre la vraie base.
 *
 * Le moteur est déjà éprouvé sans base — c'est tout l'intérêt des ports. Ce
 * fichier vérifie autre chose : que l'adaptateur lit et écrit vraiment ce que
 * le moteur croit. Un port qui ment est pire qu'un moteur faux, parce que rien
 * ne le montre.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { ajouterJours, cycleApresPaiement } from "@/lib/ndank/cycle";
import {
  PORTS_BAOBART,
  lienDeValidation,
  montantLisible,
} from "@/lib/ndank/baobart";
import { passer } from "@/lib/ndank/moteur";

const AVANT = process.env.APP_URL;

beforeEach(() => {
  process.env.APP_URL = "https://baobart.test";
});

afterEach(() => {
  if (AVANT === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = AVANT;
});

const REGLAGES = { lien: lienDeValidation, montant: montantLisible };

let n = 0;

async function abonne(options: { echeance: Date; resilie?: boolean }) {
  n += 1;

  const utilisateur = await db.user.create({
    data: {
      email: `abo-${n}@baobart.test`,
      profile: { create: { username: `abo-${n}`, displayName: `Awa ${n}` } },
    },
    select: { id: true, email: true },
  });

  const plan = await db.plan.create({
    data: {
      // Un seul code suffit : la base est vidée entre chaque test, et
      // `PlanCode` est unique. Deux plans dans le même test se heurteraient.
      code: "DISCOVERY",
      name: `Pass ${n}`,
      priceMonthly: 2_000,
    },
    select: { id: true },
  });

  const abonnement = await db.subscription.create({
    data: {
      userId: utilisateur.id,
      planId: plan.id,
      status: "ACTIVE",
      cycleStart: ajouterJours(options.echeance, -30),
      cycleEnd: options.echeance,
      cadence: "MENSUEL",
      cancelledAt: options.resilie ? new Date() : null,
    },
    select: { id: true },
  });

  return { utilisateur, abonnement };
}

async function etatDe(id: string) {
  return db.subscription.findUniqueOrThrow({
    where: { id },
    select: { status: true, cancelledAt: true },
  });
}

describe("le passage", () => {
  it("ne touche pas un abonnement dont l'échéance est loin", async () => {
    const { abonnement } = await abonne({
      echeance: ajouterJours(new Date(), 20),
    });

    const bilan = await passer(PORTS_BAOBART, REGLAGES);

    // Il n'est même pas remonté : l'index sur (status, cycleEnd) fait son
    // travail, et le moteur n'a rien à écarter.
    expect(bilan.vus).toBe(0);
    expect((await etatDe(abonnement.id)).status).toBe("ACTIVE");
  });

  it("dépose un courriel de relance à l'approche de l'échéance", async () => {
    const { utilisateur, abonnement } = await abonne({
      echeance: ajouterJours(new Date(), 2),
    });

    const bilan = await passer(PORTS_BAOBART, REGLAGES);

    expect(bilan.relances).toBe(1);

    const courriel = await db.emailOutbox.findFirstOrThrow({
      where: { recipient: utilisateur.email },
      select: { template: true, payload: true },
    });
    // Le bon modèle : détourner « avis de versement » ferait recevoir
    // « Versement en route » pour un renouvellement d'abonnement.
    expect(courriel.template).toBe("RELANCE_ABONNEMENT");

    const charge = courriel.payload as { lien: string; offre: string };
    expect(charge.lien).toContain(abonnement.id);
    expect(charge.offre).toContain("Pass");
  });

  it("note la relance, et ne la renvoie pas au passage suivant", async () => {
    // Sans cela, un passage quotidien enverrait sept messages pour une seule
    // échéance.
    const { utilisateur } = await abonne({
      echeance: ajouterJours(new Date(), 2),
    });

    await passer(PORTS_BAOBART, REGLAGES);
    const second = await passer(PORTS_BAOBART, REGLAGES);

    expect(second.relances).toBe(0);
    expect(
      await db.emailOutbox.count({ where: { recipient: utilisateur.email } }),
    ).toBe(1);
  });

  it("suspend une fois la grâce épuisée", async () => {
    const cycle = cycleApresPaiement(ajouterJours(new Date(), -60), "MENSUEL");
    const { abonnement } = await abonne({ echeance: cycle.echeance });

    const bilan = await passer(PORTS_BAOBART, REGLAGES);

    expect(bilan.suspendus).toBe(1);
    expect((await etatDe(abonnement.id)).status).toBe("EXPIRED");
  });

  it("clôt une fois la fenêtre de reprise passée", async () => {
    const { abonnement } = await abonne({
      echeance: ajouterJours(new Date(), -120),
    });

    const bilan = await passer(PORTS_BAOBART, REGLAGES);

    expect(bilan.clos).toBe(1);
    const apres = await etatDe(abonnement.id);
    expect(apres.status).toBe("CANCELLED");
    expect(apres.cancelledAt).not.toBeNull();
  });

  it("laisse tranquille un abonnement résilié par son abonné", async () => {
    // Il a dit non : plus aucun message ne doit partir, même si son échéance
    // tombe demain.
    const { utilisateur } = await abonne({
      echeance: ajouterJours(new Date(), 1),
      resilie: true,
    });

    const bilan = await passer(PORTS_BAOBART, REGLAGES);

    expect(bilan.relances).toBe(0);
    expect(
      await db.emailOutbox.count({ where: { recipient: utilisateur.email } }),
    ).toBe(0);
  });

  it("peut être rejoué sans rien casser", async () => {
    // Un ordonnanceur rejoue. Trois passages dans la même journée doivent
    // produire exactement ce qu'un seul aurait produit.
    const { utilisateur } = await abonne({
      echeance: ajouterJours(new Date(), 2),
    });

    await passer(PORTS_BAOBART, REGLAGES);
    await passer(PORTS_BAOBART, REGLAGES);
    await passer(PORTS_BAOBART, REGLAGES);

    expect(
      await db.emailOutbox.count({ where: { recipient: utilisateur.email } }),
    ).toBe(1);
  });
});
