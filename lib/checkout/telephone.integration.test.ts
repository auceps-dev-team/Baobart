/**
 * Le numéro de téléphone, du formulaire de paiement jusqu'à l'opérateur.
 *
 * Audit du 31/10/2026 (`Doc/ETAT_DU_PROJET_2026-10.md`, Q2-2) : la page de
 * paiement demandait le numéro quand l'opérateur est Flutterwave, et aucune
 * action ne le lisait. Le pilote ne le recevait jamais, et ouvrait une carte
 * bancaire à la place du mobile money choisi.
 *
 * On passe donc par les deux actions elles-mêmes — l'achat et le
 * renouvellement —, avec un vrai `FormData`, et un opérateur doublure qui
 * note ce qu'on lui demande. Le reste est réel : la base, la commande, le
 * paiement d'abonnement.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DemandePaiement } from "@/lib/payments/encaissement/contrat";

const recu: DemandePaiement[] = [];
let sessionCouranteValeur: { id: string } | null = null;

class Redirection extends Error {
  constructor(public vers: string) {
    super(vers);
  }
}

vi.mock("@/lib/auth/session", () => ({ sessionCourante: async () => sessionCouranteValeur }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({
  redirect: (vers: string) => {
    throw new Redirection(vers);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/payments/encaissement/pilotes", () => ({
  piloteCourant: () => ({
    nom: "flutterwave",
    configure: () => true,
    async ouvrir(demande: DemandePaiement) {
      recu.push(demande);
      return { ok: true, redirection: "https://operateur.test/payer", referenceOperateur: "op-1" };
    },
  }),
}));

import { renouvelerAbonnement } from "@/lib/abonnements/actions";
import { acheterRessource } from "@/lib/checkout/actions";
import { db } from "@/lib/db";

const AVANT = { ...process.env };

beforeEach(() => {
  recu.length = 0;
  sessionCouranteValeur = null;
  delete process.env.CHECKOUT_SIMULATION_ENABLED;
  process.env.APP_URL = "https://baobart.test";
});

afterEach(() => {
  process.env = { ...AVANT };
});

let n = 0;

async function compte(role: string) {
  n += 1;
  const marque = `${role}-tel-${n}-${Math.random().toString(36).slice(2, 7)}`;
  return db.user.create({
    data: { email: `${marque}@baobart.test`, profile: { create: { username: marque, displayName: marque } } },
    select: { id: true },
  });
}

async function ressource(vendeurId: string) {
  n += 1;
  const produit = await db.product.create({
    data: { sellerId: vendeurId, name: `R tel ${n}`, slug: `r-tel-${n}-${Math.random().toString(36).slice(2, 6)}`, price: 5_000, currency: "XOF", status: "PUBLISHED" },
    select: { id: true },
  });
  const media = await db.mediaAsset.create({
    data: { ownerId: vendeurId, purpose: "product", s3Key: `produits/${produit.id}/f.zip`, checksum: "x", contentType: "application/zip", sizeBytes: 1024, status: "READY" },
    select: { id: true },
  });
  await db.productFile.create({ data: { productId: produit.id, mediaId: media.id, filename: "f.zip", sizeBytes: 1024, role: "SOURCE", position: 0 } });
  return produit.id;
}

function formulaire(champs: Record<string, string>) {
  const f = new FormData();
  for (const [cle, valeur] of Object.entries(champs)) f.set(cle, valeur);
  return f;
}

/** Une action serveur finit par `redirect`, qui lève : on garde l'adresse. */
async function jusquALaRedirection(geste: Promise<void>): Promise<string> {
  try {
    await geste;
  } catch (cause) {
    if (cause instanceof Redirection) return cause.vers;
    throw cause;
  }
  throw new Error("aucune redirection");
}

describe("l'achat transmet le numéro à l'opérateur", () => {
  it("en E.164, avec le rail choisi", async () => {
    const vendeur = await compte("vendeur");
    const acheteur = await compte("acheteur");
    const produitId = await ressource(vendeur.id);
    sessionCouranteValeur = { id: acheteur.id };

    const vers = await jusquALaRedirection(
      acheterRessource(produitId, formulaire({ moyen: "mtn", pays: "CI", telephone: "07 00 00 00 00" })),
    );

    expect(vers).toBe("https://operateur.test/payer");
    expect(recu).toHaveLength(1);
    expect(recu[0]).toMatchObject({ moyen: "mtn", telephone: "+2250700000000" });
  });

  it("garde la carte quand l'acheteur a choisi la carte", async () => {
    // La liste des rails acceptés oubliait « carte » : le choix était
    // ignoré et l'achat partait en Orange Money.
    const vendeur = await compte("vendeur");
    const acheteur = await compte("acheteur");
    const produitId = await ressource(vendeur.id);
    sessionCouranteValeur = { id: acheteur.id };

    await jusquALaRedirection(acheterRessource(produitId, formulaire({ moyen: "carte", pays: "CI" })));

    expect(recu[0]).toMatchObject({ moyen: "carte" });
    expect(recu[0]!.telephone).toBeUndefined();
  });
});

describe("le renouvellement transmet le numéro à l'opérateur", () => {
  it("en E.164, avec le rail choisi", async () => {
    const abonne = await compte("abonne");
    const plan = await db.plan.upsert({
      where: { code: "DISCOVERY" },
      update: {},
      create: { code: "DISCOVERY", name: "Pass Découverte", priceMonthly: 2_000 },
      select: { id: true },
    });
    const abonnement = await db.subscription.create({
      data: {
        userId: abonne.id,
        planId: plan.id,
        status: "ACTIVE",
        cycleStart: new Date(Date.now() - 25 * 86_400_000),
        cycleEnd: new Date(Date.now() + 5 * 86_400_000),
        cadence: "MENSUEL",
      },
      select: { id: true },
    });
    sessionCouranteValeur = { id: abonne.id };

    await jusquALaRedirection(
      renouvelerAbonnement(abonnement.id, formulaire({ moyen: "om", pays: "CI", telephone: "+225 07-00-00-00-00" })),
    );

    expect(recu).toHaveLength(1);
    expect(recu[0]).toMatchObject({ moyen: "om", telephone: "+2250700000000" });
  });
});
