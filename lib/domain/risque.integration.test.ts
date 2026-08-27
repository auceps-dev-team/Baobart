/**
 * Les décisions de confiance, contre une vraie base.
 *
 * Une suspension a deux effets qu'on ne voit pas en lisant le code : la session
 * ouverte doit tomber, et les produits doivent quitter la vente. Sans le
 * premier, le compte continue de vendre jusqu'à l'expiration de son jeton ; le
 * second est la sanction elle-même.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { appliquerEvenementRisque } from "@/lib/domain/risque";

let n = 0;

async function compteVerifie(etat: "NOT_REVIEWED" | "COMPLIANT" = "NOT_REVIEWED") {
  n += 1;
  const user = await db.user.create({
    data: {
      email: `risque-${n}@baobart.test`,
      // Un compte non vérifié ne peut être ni signalé ni suspendu : la machine
      // le refuse, et il n'y aurait rien à sanctionner.
      kycStatus: "VERIFIED",
      riskState: etat,
      profile: { create: { username: `risque-${n}`, displayName: `R${n}` } },
    },
    select: { id: true },
  });
  return user.id;
}

async function produitPublie(userId: string) {
  n += 1;
  return db.product.create({
    data: {
      sellerId: userId,
      name: `Ressource ${n}`,
      slug: `ressource-risque-${n}`,
      price: 5_000,
      currency: "XOF",
      status: "PUBLISHED",
    },
    select: { id: true },
  });
}

async function sessionOuverte(userId: string) {
  n += 1;
  return db.session.create({
    data: {
      userId,
      token: `jeton-risque-${n}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    },
    select: { id: true },
  });
}

beforeEach(() => {
  n = 0;
});

describe("suspendre un compte", () => {
  it("change l'état de risque et pose la date de suspension", async () => {
    const userId = await compteVerifie();

    const r = await appliquerEvenementRisque({
      userId,
      event: "SUSPEND_TOS",
      auteur: "admin-test",
      motif: "revente en masse",
    });

    expect(r.applique).toBe(true);

    const compte = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(compte.riskState).toBe("SUSPENDED_TOS");
    expect(compte.suspendedAt).not.toBeNull();
  });

  it("ferme les sessions ouvertes", async () => {
    // Une suspension qui laisse une session ouverte n'en est pas une : le
    // compte continue de vendre jusqu'à l'expiration de son jeton.
    const userId = await compteVerifie();
    await sessionOuverte(userId);
    expect(await db.session.count({ where: { userId } })).toBe(1);

    await appliquerEvenementRisque({
      userId,
      event: "SUSPEND_FRAUD",
      auteur: "admin-test",
    });

    expect(await db.session.count({ where: { userId } })).toBe(0);
  });

  it("retire les produits de la vente", async () => {
    const userId = await compteVerifie();
    const produit = await produitPublie(userId);

    await appliquerEvenementRisque({
      userId,
      event: "SUSPEND_TOS",
      auteur: "admin-test",
    });

    const relu = await db.product.findUniqueOrThrow({ where: { id: produit.id } });
    expect(relu.status).toBe("ARCHIVED");
  });

  it("consigne qui a décidé et pourquoi", async () => {
    const userId = await compteVerifie();

    await appliquerEvenementRisque({
      userId,
      event: "SUSPEND_TOS",
      auteur: "fatou@baobart.test",
      motif: "contenu volé signalé trois fois",
    });

    const trace = await db.riskStateChange.findFirstOrThrow({ where: { userId } });
    expect(trace.author).toBe("fatou@baobart.test");
    expect(trace.reason).toContain("volé");
    expect(trace.fromState).toBe("NOT_REVIEWED");
    expect(trace.toState).toBe("SUSPENDED_TOS");
  });
});

describe("lever une suspension", () => {
  it("refuse sans demande explicite", async () => {
    // Lever une suspension remet les produits en vente. Une revue de routine
    // ne doit pas défaire une sanction qu'elle n'a jamais examinée.
    const userId = await compteVerifie();
    await appliquerEvenementRisque({
      userId,
      event: "SUSPEND_TOS",
      auteur: "admin-test",
    });

    const r = await appliquerEvenementRisque({
      userId,
      event: "MARK_COMPLIANT",
      auteur: "admin-test",
    });

    expect(r.applique).toBe(false);
    if (r.applique) return;
    expect(r.motif).toBe("SUSPENSION_NON_LEVEE");

    const compte = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(compte.suspendedAt).not.toBeNull();
  });

  it("accepte quand la levée est demandée, et efface la date", async () => {
    const userId = await compteVerifie();
    await appliquerEvenementRisque({
      userId,
      event: "SUSPEND_TOS",
      auteur: "admin-test",
    });

    const r = await appliquerEvenementRisque({
      userId,
      event: "MARK_COMPLIANT",
      auteur: "admin-test",
      clearSuspension: true,
      motif: "dossier revu, signalement infondé",
    });

    expect(r.applique).toBe(true);

    const compte = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(compte.riskState).toBe("COMPLIANT");
    expect(compte.suspendedAt).toBeNull();
  });

  it("ne remet pas les produits en vente tout seul", async () => {
    // On ne sait pas lesquels étaient publiés avant la sanction : tout
    // republier remettrait en vente ce que le créateur avait lui-même retiré.
    const userId = await compteVerifie();
    const produit = await produitPublie(userId);
    await appliquerEvenementRisque({ userId, event: "SUSPEND_TOS", auteur: "a" });
    await appliquerEvenementRisque({
      userId,
      event: "MARK_COMPLIANT",
      auteur: "a",
      clearSuspension: true,
    });

    const relu = await db.product.findUniqueOrThrow({ where: { id: produit.id } });
    expect(relu.status).toBe("ARCHIVED");
  });
});

describe("refus", () => {
  it("refuse un compte inconnu", async () => {
    const r = await appliquerEvenementRisque({
      userId: "inexistant",
      event: "SUSPEND_TOS",
      auteur: "admin-test",
    });
    expect(r.applique).toBe(false);
    if (!r.applique) expect(r.motif).toBe("COMPTE_INTROUVABLE");
  });

  it("refuse une transition que la machine n'autorise pas", async () => {
    const userId = await compteVerifie("COMPLIANT");

    const r = await appliquerEvenementRisque({
      userId,
      event: "MARK_COMPLIANT",
      auteur: "admin-test",
    });

    expect(r.applique).toBe(false);
    if (!r.applique) {
      expect(["TRANSITION_INTERDITE", "DEJA_DANS_CET_ETAT"]).toContain(r.motif);
    }
  });

  it("n'écrit aucune trace quand la transition est refusée", async () => {
    const userId = await compteVerifie("COMPLIANT");
    await appliquerEvenementRisque({
      userId,
      event: "MARK_COMPLIANT",
      auteur: "admin-test",
    });

    expect(await db.riskStateChange.count({ where: { userId } })).toBe(0);
  });
});
