/**
 * L'anti-bot, sans base et sans réseau.
 *
 * Le service tiers est simulé, parce que ce qu'on veut éprouver n'est pas
 * reCAPTCHA : c'est **ce qu'on fait de ses réponses**, y compris quand il n'en
 * donne aucune. Les trois cas qui comptent — pas de clé, pas de réponse,
 * réponse d'une autre action — sont précisément ceux qu'un appel réel ne
 * produirait jamais à la demande.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DELAI_MINIMUM_MS,
  SEUIL_SCORE,
  etatAntiBot,
  evaluerUnGeste,
} from "@/lib/securite/antibot";

const secretOrigine = process.env.RECAPTCHA_SECRET;

/** Un geste d'humain : leurre vide, formulaire ouvert il y a une minute. */
function humain(extra: Record<string, unknown> = {}) {
  return {
    action: "inscription",
    leurre: "",
    ouvertLe: String(Date.now() - 60_000),
    ...extra,
  };
}

beforeEach(() => {
  delete process.env.RECAPTCHA_SECRET;
  vi.restoreAllMocks();
});

afterEach(() => {
  if (secretOrigine === undefined) delete process.env.RECAPTCHA_SECRET;
  else process.env.RECAPTCHA_SECRET = secretOrigine;
});

describe("le leurre", () => {
  it("refuse dès qu'il est rempli", async () => {
    const v = await evaluerUnGeste(humain({ leurre: "Acme SARL" }));

    expect(v.laisserPasser).toBe(false);
    expect(v.motif).toBe("leurre");
  });

  it("ne se laisse pas contourner par des espaces", async () => {
    // Un robot qui remplit tout avec un espace passerait un simple
    // `length > 0`.
    const v = await evaluerUnGeste(humain({ leurre: "   x  " }));
    expect(v.laisserPasser).toBe(false);
  });

  it("laisse passer un leurre vide, ou absent", async () => {
    expect((await evaluerUnGeste(humain({ leurre: "  " }))).laisserPasser).toBe(
      true,
    );
    expect(
      (await evaluerUnGeste(humain({ leurre: null }))).laisserPasser,
    ).toBe(true);
  });

  it("refuse sans appeler le service tiers", async () => {
    // L'ordre a un coût : refuser après l'appel ferait payer un aller-retour
    // réseau et une unité de quota pour un robot qui s'est déjà trahi.
    process.env.RECAPTCHA_SECRET = "clé-de-test";
    const appel = vi.spyOn(globalThis, "fetch");

    await evaluerUnGeste(humain({ leurre: "rempli", jeton: "jt" }));

    expect(appel).not.toHaveBeenCalled();
  });
});

describe("le temps de remplissage", () => {
  it("refuse une soumission immédiate", async () => {
    const v = await evaluerUnGeste(humain({ ouvertLe: String(Date.now()) }));

    expect(v.laisserPasser).toBe(false);
    expect(v.motif).toBe("trop_rapide");
  });

  it("laisse passer juste au-dessus du plancher", async () => {
    const v = await evaluerUnGeste(
      humain({ ouvertLe: String(Date.now() - DELAI_MINIMUM_MS - 50) }),
    );

    expect(v.laisserPasser).toBe(true);
  });

  it("laisse passer quand l'horodatage manque", async () => {
    // Il manque dans un test, dans une page pas encore équipée, dans une
    // requête forgée à la main pendant le développement. Refuser fermerait
    // ces trois cas sans rien dire du quatrième.
    expect(
      (await evaluerUnGeste(humain({ ouvertLe: null }))).laisserPasser,
    ).toBe(true);
    expect((await evaluerUnGeste(humain({ ouvertLe: "" }))).laisserPasser).toBe(
      true,
    );
  });

  it("laisse passer un horodatage illisible", async () => {
    expect(
      (await evaluerUnGeste(humain({ ouvertLe: "hier" }))).laisserPasser,
    ).toBe(true);
  });

  it("refuse un horodatage nettement dans l'avenir", async () => {
    // Le champ vient du client : y écrire l'an prochain ferait paraître
    // l'écart énorme et passerait le plancher.
    const v = await evaluerUnGeste(
      humain({ ouvertLe: String(Date.now() + 3_600_000) }),
    );

    expect(v.laisserPasser).toBe(false);
    expect(v.motif).toBe("trop_rapide");
  });

  it("tolère une horloge locale légèrement en avance", async () => {
    // Elles le sont souvent de quelques secondes. Refuser là-dessus ferait
    // des victimes sans attraper un seul robot.
    const v = await evaluerUnGeste(
      humain({ ouvertLe: String(Date.now() + 3_000) }),
    );

    expect(v.laisserPasser).toBe(true);
  });
});

describe("le score du tiers", () => {
  function repondre(corps: unknown, ok = true) {
    return vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok,
      status: ok ? 200 : 503,
      json: async () => corps,
    } as Response);
  }

  it("n'appelle personne sans clé configurée", async () => {
    const appel = vi.spyOn(globalThis, "fetch");

    const v = await evaluerUnGeste(humain({ jeton: "jt" }));

    expect(appel).not.toHaveBeenCalled();
    expect(v.score).toBeNull();
    expect(v.laisserPasser).toBe(true);
  });

  it("n'appelle personne sans jeton, même avec une clé", async () => {
    process.env.RECAPTCHA_SECRET = "clé-de-test";
    const appel = vi.spyOn(globalThis, "fetch");

    const v = await evaluerUnGeste(humain());

    expect(appel).not.toHaveBeenCalled();
    expect(v.laisserPasser).toBe(true);
  });

  it("refuse sous le seuil", async () => {
    process.env.RECAPTCHA_SECRET = "clé-de-test";
    repondre({ success: true, score: SEUIL_SCORE - 0.1, action: "inscription" });

    const v = await evaluerUnGeste(humain({ jeton: "jt" }));

    expect(v.laisserPasser).toBe(false);
    expect(v.motif).toBe("score_bas");
  });

  it("laisse passer au seuil exactement", async () => {
    // La comparaison est `< SEUIL`, pas `<=` : un score pile au seuil est
    // recommandé comme acceptable, et l'écrire à l'envers ferait refuser
    // toute une population sans que rien ne le signale.
    process.env.RECAPTCHA_SECRET = "clé-de-test";
    repondre({ success: true, score: SEUIL_SCORE, action: "inscription" });

    expect((await evaluerUnGeste(humain({ jeton: "jt" }))).laisserPasser).toBe(
      true,
    );
  });

  it("refuse un jeton présenté pour une autre action", async () => {
    // Sans ce contrôle, un jeton obtenu sur le formulaire de contact vaudrait
    // pour l'inscription : le score serait bon et le geste, tout autre.
    process.env.RECAPTCHA_SECRET = "clé-de-test";
    repondre({ success: true, score: 0.9, action: "contact" });

    const v = await evaluerUnGeste(humain({ jeton: "jt" }));

    expect(v.laisserPasser).toBe(false);
    expect(v.score).toBe(0);
  });

  it("laisse passer quand le service ne répond pas", async () => {
    // Un anti-bot en panne ne doit pas devenir une panne d'inscription.
    process.env.RECAPTCHA_SECRET = "clé-de-test";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("injoignable"));

    const v = await evaluerUnGeste(humain({ jeton: "jt" }));

    expect(v.laisserPasser).toBe(true);
    expect(v.score).toBeNull();
  });

  it("laisse passer sur une réponse en erreur", async () => {
    process.env.RECAPTCHA_SECRET = "clé-de-test";
    repondre({}, false);

    expect((await evaluerUnGeste(humain({ jeton: "jt" }))).laisserPasser).toBe(
      true,
    );
  });

  it("laisse passer sur une réponse sans score", async () => {
    process.env.RECAPTCHA_SECRET = "clé-de-test";
    repondre({ success: true });

    const v = await evaluerUnGeste(humain({ jeton: "jt" }));

    expect(v.laisserPasser).toBe(true);
    expect(v.score).toBeNull();
  });

  it("laisse passer quand `success` est faux", async () => {
    process.env.RECAPTCHA_SECRET = "clé-de-test";
    repondre({ success: false, "error-codes": ["timeout-or-duplicate"] });

    expect((await evaluerUnGeste(humain({ jeton: "jt" }))).laisserPasser).toBe(
      true,
    );
  });
});

describe("l'état affiché à la configuration", () => {
  it("dit franchement quand aucun tiers n'est branché", () => {
    expect(etatAntiBot().tiers).toBe(false);
  });

  it("le dit quand il l'est", () => {
    process.env.RECAPTCHA_SECRET = "clé-de-test";
    expect(etatAntiBot().tiers).toBe(true);
  });
});
