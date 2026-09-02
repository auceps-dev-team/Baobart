/**
 * Le canal de notification, dans le passage Ndank.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE FICHIER PROUVE UNE ÉCONOMIE, PAS UNE FONCTIONNALITÉ
 *
 * Au palier J+2, l'échelle prévoit `["push", "sms"]` — dans cet ordre. Le
 * moteur s'arrête au premier canal qui part.
 *
 * Si l'ordre était inversé, ou si la poussée échouait en silence, chaque
 * relance de ce palier partirait en SMS. Sur mille abonnés mensuels, cela fait
 * mille SMS par mois pour des gens qu'une notification gratuite aurait
 * atteints — et rien, nulle part, ne le signalerait : les relances partent,
 * les abonnés sont prévenus, tout a l'air de marcher.
 *
 * On simule ici `web-push` lui-même. Ce n'est pas sa mécanique qu'on éprouve —
 * elle lui appartient — mais le fait que Baobart l'appelle, et qu'il n'appelle
 * pas l'opérateur SMS quand il l'a fait.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const envois: { endpoint: string; charge: string }[] = [];

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: () => {},
    sendNotification: async (
      abonnement: { endpoint: string },
      charge: string,
    ) => {
      envois.push({ endpoint: abonnement.endpoint, charge });
      return { statusCode: 201 };
    },
  },
}));

import { db } from "@/lib/db";
import { PORTS_BAOBART, lienDeValidation, montantLisible } from "@/lib/ndank/baobart";
import { ajouterJours } from "@/lib/ndank/cycle";
import { passer } from "@/lib/ndank/moteur";
import { inscrire } from "@/lib/push/abonnements";

const AVANT = { ...process.env };
const REGLAGES = { lien: lienDeValidation, montant: montantLisible };

beforeEach(() => {
  envois.length = 0;
  process.env.APP_URL = "https://baobart.test";
  process.env.PUSH_DRIVER = "web-push";
  process.env.VAPID_PUBLIC_KEY = "B".repeat(87);
  process.env.VAPID_PRIVATE_KEY = "p".repeat(43);
  process.env.VAPID_SUBJECT = "mailto:contact@baobart.test";
  // Le pilote SMS écrit dans le journal au lieu d'envoyer : s'il part, on le
  // verra dans le décompte des relances sans rien facturer.
  process.env.SMS_DRIVER = "console";
});

afterEach(() => {
  process.env = { ...AVANT };
});

let n = 0;

async function abonne(options: { echeance: Date; avecAppareil: boolean }) {
  n += 1;

  const utilisateur = await db.user.create({
    data: {
      email: `push-abo-${n}@baobart.test`,
      phone: `07070707${String(10 + n).slice(-2)}`,
      profile: {
        create: { username: `push-abo-${n}`, displayName: `Awa ${n}`, country: "CI" },
      },
    },
    select: { id: true },
  });

  if (options.avecAppareil) {
    await inscrire(utilisateur.id, {
      endpoint: `https://fcm.googleapis.com/fcm/send/appareil-${n}`,
      p256dh: "cle-publique-du-navigateur",
      auth: "secret-d-authentification",
    });
  }

  const plan = await db.plan.upsert({
    where: { code: "DISCOVERY" },
    update: {},
    create: { code: "DISCOVERY", name: "Pass Découverte", priceMonthly: 2_000 },
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
    },
    select: { id: true },
  });

  return { utilisateur, abonnement };
}

describe("le canal de notification", () => {
  it("part avant le SMS au palier qui coûte", async () => {
    // J+2 : l'échelle monte à `["push", "sms"]`. La notification est gratuite,
    // le SMS non — l'ordre n'est pas décoratif.
    const { abonnement } = await abonne({
      echeance: ajouterJours(new Date(), -2),
      avecAppareil: true,
    });

    const bilan = await passer(PORTS_BAOBART, REGLAGES);

    expect(bilan.relances).toBe(1);
    expect(envois).toHaveLength(1);

    const relance = await db.subscriptionReminder.findFirstOrThrow({
      where: { subscriptionId: abonnement.id },
      select: { canaux: true },
    });
    // Le SMS n'a PAS été tenté : le moteur s'arrête au premier canal qui part.
    expect(relance.canaux).toEqual(["push"]);
  });

  it("porte le lien de validation et les faits, pas de la prose", async () => {
    const { abonnement } = await abonne({
      echeance: ajouterJours(new Date(), -2),
      avecAppareil: true,
    });

    await passer(PORTS_BAOBART, REGLAGES);

    const charge = JSON.parse(envois[0]!.charge) as {
      titre: string;
      corps: string;
      lien: string;
      etiquette: string;
    };

    expect(charge.lien).toContain(abonnement.id);
    expect(charge.corps).toContain("2");
    // L'étiquette regroupe : deux relances du même abonnement se remplacent
    // au lieu de s'empiler sur l'écran verrouillé.
    expect(charge.etiquette.length).toBeGreaterThan(0);
  });

  it("retombe sur le SMS quand la personne n'a aucun appareil", async () => {
    // Le cas majoritaire au début : personne n'a encore installé
    // l'application. Le canal doit être sauté, pas échouer.
    const { abonnement } = await abonne({
      echeance: ajouterJours(new Date(), -2),
      avecAppareil: false,
    });

    const bilan = await passer(PORTS_BAOBART, REGLAGES);

    expect(bilan.relances).toBe(1);
    expect(envois).toHaveLength(0);

    const relance = await db.subscriptionReminder.findFirstOrThrow({
      where: { subscriptionId: abonnement.id },
      select: { canaux: true },
    });
    expect(relance.canaux).toEqual(["sms"]);
  });

  it("laisse le courriel passer devant tant qu'il reste du temps", async () => {
    // J-3 : `["courriel", "push"]`. Le courriel s'étend, se relit, et se
    // retrouve ; la notification disparaît de l'écran verrouillé. Tant qu'il
    // reste des jours, le courriel est le bon canal.
    await abonne({
      echeance: ajouterJours(new Date(), 2),
      avecAppareil: true,
    });

    const bilan = await passer(PORTS_BAOBART, REGLAGES);

    expect(bilan.relances).toBe(1);
    expect(envois).toHaveLength(0);
  });
});
