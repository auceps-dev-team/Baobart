/**
 * Ndank branché sur Baobart, contre la vraie base.
 *
 * Le moteur est déjà éprouvé sans base — c'est tout l'intérêt des ports. Ce
 * fichier vérifie autre chose : que l'adaptateur lit et écrit vraiment ce que
 * le moteur croit. Un port qui ment est pire qu'un moteur faux, parce que rien
 * ne le montre.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { ajouterJours, cycleApresPaiement } from "@/lib/ndank/cycle";
import {
  PORTS_BAOBART,
  lienDeValidation,
  montantLisible,
} from "@/lib/ndank/baobart";
import { passer } from "@/lib/ndank/moteur";

const AVANT = { ...process.env };

beforeEach(() => {
  process.env.APP_URL = "https://baobart.test";
  // Le pilote « console » écrit au lieu d'envoyer. Sans lui, `SMS_DRIVER` vaut
  // « aucun » et les paliers SMS ne prouveraient rien.
  process.env.SMS_DRIVER = "console";
});

afterEach(() => {
  process.env = { ...AVANT };
});

const REGLAGES = { lien: lienDeValidation, montant: montantLisible };

let n = 0;

async function abonne(options: {
  echeance: Date;
  resilie?: boolean;
  telephone?: string | null;
  pays?: string;
}) {
  n += 1;

  const utilisateur = await db.user.create({
    data: {
      email: `abo-${n}@baobart.test`,
      phone: options.telephone ?? null,
      profile: {
        create: {
          username: `abo-${n}`,
          displayName: `Awa ${n}`,
          country: options.pays ?? "CI",
        },
      },
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

describe("le canal SMS", () => {
  it("relance par SMS une fois l'échéance dépassée", async () => {
    // Le palier J+2 monte au SMS : le courriel n'a rien donné, et l'accès va
    // être coupé. C'est le moment où le coût d'un SMS se justifie.
    const { abonnement } = await abonne({
      echeance: ajouterJours(new Date(), -2),
      telephone: "0707070707",
    });

    const bilan = await passer(PORTS_BAOBART, REGLAGES);
    expect(bilan.relances).toBe(1);

    const relance = await db.subscriptionReminder.findFirstOrThrow({
      where: { subscriptionId: abonnement.id },
      select: { canaux: true },
    });
    expect(relance.canaux).toContain("sms");
  });

  it("ne compte pas comme joignable un abonné dont le numéro est illisible", async () => {
    // Un numéro qu'on ne sait pas mettre en forme doit remonter comme un
    // incident, pas disparaître : on s'apprête à couper l'accès de quelqu'un
    // qu'on ne peut plus prévenir.
    const { abonnement } = await abonne({
      echeance: ajouterJours(new Date(), -5),
      telephone: "12",
    });

    const bilan = await passer(PORTS_BAOBART, REGLAGES);

    expect(bilan.injoignables).toBe(1);
    expect(bilan.relances).toBe(0);

    // Et surtout : rien n'a été noté. Demain on réessaiera, au lieu de croire
    // l'avoir prévenu.
    expect(
      await db.subscriptionReminder.count({
        where: { subscriptionId: abonnement.id },
      }),
    ).toBe(0);
  });

  it("garde le zéro de tête d'un numéro ivoirien jusqu'à l'opérateur", async () => {
    // Le défaut qui ne se voit nulle part : le message part, il est facturé,
    // et il n'atteint personne.
    const journal = await import("@/lib/observabilite/journal");
    const espion = vi.spyOn(journal.journal, "info");

    await abonne({
      echeance: ajouterJours(new Date(), -2),
      telephone: "0707070708",
      pays: "CI",
    });

    await passer(PORTS_BAOBART, REGLAGES);

    const envoi = espion.mock.calls.find((c) => String(c[0]).includes("SMS envoy"));
    expect(envoi?.[1]).toMatchObject({ vers: "···· 0708" });
  });
});
