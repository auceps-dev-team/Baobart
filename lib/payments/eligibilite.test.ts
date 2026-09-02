import { describe, expect, it } from "vitest";

import {
  VERIFICATION_MS,
  peutEtrePaye,
  type EligibiliteInput,
} from "./eligibilite";

/** Un compte enregistré hier : il a purgé sa vérification. */
const VEILLE = new Date(Date.now() - VERIFICATION_MS - 60_000);

const BASE: EligibiliteInput = {
  riskState: "COMPLIANT",
  suspenduLe: null,
  versementsSuspendusLe: null,
  compte: {
    provider: "wave",
    accountRef: "+221770000000",
    enregistreLe: VEILLE,
  },
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
      avec({
        compte: {
          provider: "disparu",
          accountRef: "x",
          enregistreLe: VEILLE,
        },
      }),
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
      { compte: { provider: "inconnu", accountRef: "x", enregistreLe: VEILLE } },
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

describe("la retenue de vérification", () => {
  it("retient un compte enregistré à l'instant", () => {
    // Le scénario que cette règle existe pour empêcher : quelqu'un entre dans
    // un compte, remplace le numéro de versement, et le prochain cycle envoie
    // l'argent chez lui. Rien d'autre ne le verrait — le compte est sain, le
    // solde est bien à lui, le rail est connu.
    const d = avec({
      compte: {
        provider: "wave",
        accountRef: "+221770000000",
        enregistreLe: new Date(),
      },
    });

    expect(d).toMatchObject({ raison: "COMPTE_TROP_RECENT" });
  });

  it("laisse partir un compte qui a passé les vingt-quatre heures", () => {
    expect(avec({})).toEqual({ payable: true });
  });

  it("bascule exactement au seuil, sans zone grise", () => {
    const maintenant = new Date("2026-09-02T12:00:00Z");
    const juste = new Date(maintenant.getTime() - VERIFICATION_MS);
    const presque = new Date(maintenant.getTime() - VERIFICATION_MS + 1);

    expect(
      avec({
        maintenant,
        compte: { provider: "wave", accountRef: "x", enregistreLe: juste },
      }),
    ).toEqual({ payable: true });

    expect(
      avec({
        maintenant,
        compte: { provider: "wave", accountRef: "x", enregistreLe: presque },
      }),
    ).toMatchObject({ raison: "COMPTE_TROP_RECENT" });
  });

  it("ne se lève pas à la main", () => {
    // Un versement déclenché au support sur un compte qu'on vient de changer
    // est exactement ce que l'attaquant demanderait. Le seuil et l'enquête se
    // lèvent ; celui-ci non.
    const d = avec({
      parAdministrateur: true,
      compte: {
        provider: "wave",
        accountRef: "+221770000000",
        enregistreLe: new Date(),
      },
    });

    expect(d).toMatchObject({ raison: "COMPTE_TROP_RECENT" });
  });
});

describe("l'ordre des refus", () => {
  it("annonce l'enquête plutôt que la vérification du compte", () => {
    // Les deux sont vrais en même temps. Dire « compte en cours de
    // vérification » à quelqu'un sous enquête laisserait croire qu'attendre
    // vingt-quatre heures suffira — et il attendrait pour rien.
    const d = avec({
      riskState: "FLAGGED_FRAUD",
      compte: {
        provider: "wave",
        accountRef: "x",
        enregistreLe: new Date(),
      },
    });

    expect(d).toMatchObject({ raison: "SOUS_ENQUETE" });
  });

  it("annonce la suspension plutôt que la vérification du compte", () => {
    const d = avec({
      suspenduLe: new Date(),
      compte: { provider: "wave", accountRef: "x", enregistreLe: new Date() },
    });

    expect(d).toMatchObject({ raison: "SUSPENDU" });
  });

  it("n'annonce pas une vérification à qui n'a rien à toucher", () => {
    // Annoncer un obstacle à quelqu'un qui n'aurait rien reçu de toute façon,
    // c'est fabriquer un incident qui n'existe pas.
    const d = avec({
      soldeVersable: 0,
      compte: { provider: "wave", accountRef: "x", enregistreLe: new Date() },
    });

    expect(d).toMatchObject({ raison: "RIEN_A_VERSER" });
  });
});
