import { describe, expect, it } from "vitest";

import { peutEtrePaye, type EligibiliteInput } from "./eligibilite";

const BASE: EligibiliteInput = {
  riskState: "COMPLIANT",
  suspenduLe: null,
  versementsSuspendusLe: null,
  compte: { provider: "wave", accountRef: "+221770000000" },
  railsConnus: ["wave", "om", "mtn", "moov", "bank"],
  soldeVersable: 25_000,
  minimum: 1_000,
};

const avec = (p: Partial<EligibiliteInput>) => peutEtrePaye({ ...BASE, ...p });

describe("qui peut être payé", () => {
  it("paie un créateur en règle avec un compte et un solde", () => {
    expect(avec({})).toEqual({ payable: true });
  });

  it("paie aussi un compte jamais examiné", () => {
    // « Pas encore examiné » n'est pas « suspect » : exiger un contrôle avant
    // le premier versement ferait attendre tout le monde pour rien.
    expect(avec({ riskState: "NOT_REVIEWED" })).toEqual({ payable: true });
  });

  it("paie un créateur en probation", () => {
    // La probation restreint la vente, pas le droit d'être payé pour ce qui a
    // déjà été vendu.
    expect(avec({ riskState: "ON_PROBATION" })).toEqual({ payable: true });
  });
});

describe("qui ne peut pas, et pourquoi", () => {
  it("arrête tout sur un compte suspendu", () => {
    expect(avec({ suspenduLe: new Date() })).toMatchObject({
      payable: false,
      raison: "SUSPENDU",
    });
    expect(avec({ riskState: "SUSPENDED_FRAUD" })).toMatchObject({
      raison: "SUSPENDU",
    });
    expect(avec({ riskState: "SUSPENDED_TOS" })).toMatchObject({
      raison: "SUSPENDU",
    });
  });

  it("retient le versement d'un compte signalé, sans le lui perdre", () => {
    for (const etat of ["FLAGGED_FRAUD", "FLAGGED_TOS"] as const) {
      const d = avec({ riskState: etat });
      expect(d, etat).toMatchObject({ payable: false, raison: "SOUS_ENQUETE" });
      // Le message doit dire que l'argent est conservé : sans ça, un créateur
      // signalé croit qu'on le lui prend.
      if (!d.payable) expect(d.message).toMatch(/conserv/i);
    }
  });

  it("distingue les versements suspendus de la suspension du compte", () => {
    // Retenir un virement le temps d'une enquête ne doit pas obliger à couper
    // la boutique.
    expect(avec({ versementsSuspendusLe: new Date() })).toMatchObject({
      raison: "VERSEMENTS_SUSPENDUS",
    });
  });

  it("réclame un compte de destination avant tout le reste", () => {
    const d = avec({ compte: null, soldeVersable: 100 });
    // Sous le seuil ET sans compte : on annonce ce que la personne peut
    // corriger, pas ce qu'elle subit.
    expect(d).toMatchObject({ raison: "PAS_DE_COMPTE" });
  });

  it("refuse un rail qu'on ne sait plus exécuter", () => {
    expect(
      avec({ compte: { provider: "disparu", accountRef: "x" } }),
    ).toMatchObject({ raison: "RAIL_INCONNU" });
  });

  it("laisse rouler un solde sous le seuil", () => {
    const d = avec({ soldeVersable: 500 });
    expect(d).toMatchObject({ raison: "SOUS_LE_SEUIL" });
    if (!d.payable) expect(d.message).toMatch(/roulera|prochaine/i);
  });

  it("ne verse rien quand il n'y a rien", () => {
    expect(avec({ soldeVersable: 0 })).toMatchObject({ raison: "RIEN_A_VERSER" });
    expect(avec({ soldeVersable: -4_000 })).toMatchObject({
      raison: "RIEN_A_VERSER",
    });
  });
});

describe("versement déclenché à la main", () => {
  const admin = { parAdministrateur: true };

  it("passe outre le seuil et l'enquête", () => {
    expect(avec({ ...admin, soldeVersable: 500 })).toEqual({ payable: true });
    expect(avec({ ...admin, riskState: "FLAGGED_FRAUD" })).toEqual({
      payable: true,
    });
  });

  it("ne passe pas outre le gel des versements", () => {
    // Ce gel était levable tant qu'il n'était posé que par un humain. Depuis
    // qu'un litige le pose tout seul, le lever ferait repartir l'argent d'un
    // compte dont l'opérateur vient justement de reprendre des fonds.
    expect(avec({ ...admin, versementsSuspendusLe: new Date() })).toMatchObject({
      raison: "VERSEMENTS_SUSPENDUS",
    });
  });

  it("ne passe pas outre la suspension", () => {
    // Une décision de suspension ne se contourne pas par un clic.
    expect(avec({ ...admin, suspenduLe: new Date() })).toMatchObject({
      raison: "SUSPENDU",
    });
  });

  it("ne passe pas outre l'absence de compte", () => {
    // Forcer ici ne créerait pas un virement : il n'irait nulle part.
    expect(avec({ ...admin, compte: null })).toMatchObject({
      raison: "PAS_DE_COMPTE",
    });
  });

  it("ne verse toujours pas un solde nul", () => {
    expect(avec({ ...admin, soldeVersable: 0 })).toMatchObject({
      raison: "RIEN_A_VERSER",
    });
  });
});

describe("messages", () => {
  it("chaque refus dit quelque chose d'utile", () => {
    const cas: Array<Partial<EligibiliteInput>> = [
      { suspenduLe: new Date() },
      { riskState: "FLAGGED_TOS" },
      { versementsSuspendusLe: new Date() },
      { compte: null },
      { compte: { provider: "inconnu", accountRef: "x" } },
      { soldeVersable: 0 },
      { soldeVersable: 10 },
    ];

    for (const c of cas) {
      const d = avec(c);
      expect(d.payable).toBe(false);
      if (!d.payable) expect(d.message.length).toBeGreaterThan(20);
    }
  });
});
