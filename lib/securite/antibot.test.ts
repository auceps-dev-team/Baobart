/**
 * L'anti-bot, sans base et sans réseau.
 *
 * Le service tiers est simulé, parce que ce qu'on veut éprouver n'est pas
 * reCAPTCHA : c'est **ce qu'on fait de ses réponses**, y compris quand il n'en
 * donne aucune. Les trois cas qui comptent — pas de clé, pas de réponse,
 * réponse d'une autre action — sont précisément ceux qu'un appel réel ne
 * produirait jamais à la demande.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DELAI_MINIMUM_MS,
  SEUIL_SCORE,
  UN_FORMULAIRE_TRANSMET_LE_JETON,
  VALIDITE_OUVERTURE_MS,
  etatAntiBot,
  evaluerUnGeste,
  ouvertureSignee,
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

  it("refuse un horodatage absent ou vide quand delaiRequis est actif", async () => {
    const verdictAbsent = await evaluerUnGeste(humain({ ouvertLe: null, delaiRequis: true }));
    expect(verdictAbsent.laisserPasser).toBe(false);
    expect(verdictAbsent.motif).toBe("trop_rapide");

    const verdictVide = await evaluerUnGeste(humain({ ouvertLe: "  ", delaiRequis: true }));
    expect(verdictVide.laisserPasser).toBe(false);
    expect(verdictVide.motif).toBe("trop_rapide");
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

describe("l'instant signé par la page", () => {
  const secretAvant = process.env.AUTH_SECRET;
  beforeEach(() => {
    process.env.AUTH_SECRET = "un-secret-de-test-assez-long-0123";
  });
  afterEach(() => {
    if (secretAvant === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = secretAvant;
  });

  const requis = (ouvertLe: string | null) => evaluerUnGeste(humain({ ouvertLe, delaiRequis: true }));

  it("laisse passer un instant signé il y a une minute", async () => {
    expect((await requis(ouvertureSignee(Date.now() - 60_000))).laisserPasser).toBe(true);
  });

  it("refuse un instant signé trop récent : la page vient d'être chargée", async () => {
    expect((await requis(ouvertureSignee(Date.now() - 500))).laisserPasser).toBe(false);
  });

  it("refuse l'instant forgé qu'un script écrivait en une ligne", async () => {
    // Le contournement du 18/10 : `maintenant - 3 s`, sans signature.
    expect((await requis(String(Date.now() - 3_000))).laisserPasser).toBe(false);
  });

  it("refuse un instant reculé sous une vraie signature", async () => {
    const vraie = ouvertureSignee(Date.now() - 500)!;
    const recule = vraie.replace(/^\d+/, String(Date.now() - 60_000));
    // Sans quoi le test passerait pour une autre raison (instant trop récent).
    expect(recule).not.toBe(vraie);
    expect((await requis(recule)).laisserPasser).toBe(false);
  });

  it("refuse un instant signé il y a plus de six heures", async () => {
    expect((await requis(ouvertureSignee(Date.now() - VALIDITE_OUVERTURE_MS - 60_000))).laisserPasser).toBe(false);
  });

  it("ne change rien là où le délai n'est pas requis", async () => {
    expect((await evaluerUnGeste(humain())).laisserPasser).toBe(true);
    expect((await evaluerUnGeste(humain({ ouvertLe: null }))).laisserPasser).toBe(true);
  });

  it("sans secret, ne signe rien et retombe sur l'instant du navigateur", async () => {
    delete process.env.AUTH_SECRET;
    expect(ouvertureSignee()).toBeNull();
    expect((await requis(String(Date.now() - 60_000))).laisserPasser).toBe(true);
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
  it("dit franchement quand aucune clé n'est posée", () => {
    expect(etatAntiBot().tiers).toBe("absent");
  });

  it("ne compte pas une clé seule comme un tiers branché", () => {
    process.env.RECAPTCHA_SECRET = "clé-de-test";
    expect(etatAntiBot(false).tiers).toBe("sans_jeton");
  });

  it("dit actif quand la clé est posée et qu'un formulaire transmet le jeton", () => {
    process.env.RECAPTCHA_SECRET = "clé-de-test";
    expect(etatAntiBot(true).tiers).toBe("actif");
  });

  it("aujourd'hui, une clé posée reste sans jeton", () => {
    process.env.RECAPTCHA_SECRET = "clé-de-test";
    expect(etatAntiBot().tiers).toBe(
      UN_FORMULAIRE_TRANSMET_LE_JETON ? "actif" : "sans_jeton",
    );
  });
});

/**
 * La constante `UN_FORMULAIRE_TRANSMET_LE_JETON` décrit ce que font d'autres
 * modules. Sans ce test, elle ne serait qu'un souvenir : on relit donc chaque
 * appel à `evaluerUnGeste` hors de ce dossier, et l'on vérifie qu'elle dit vrai.
 */
describe("la constante dit ce que font les appelants", () => {
  const racine = process.cwd();

  function sources(dossier: string): string[] {
    return readdirSync(dossier).flatMap((nom) => {
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) return sources(chemin);
      return /\.tsx?$/.test(nom) && !/\.test\.tsx?$/.test(nom) ? [chemin] : [];
    });
  }

  const appels = ["lib", "app", "components"]
    .flatMap((d) => sources(join(racine, d)))
    .filter((f) => !f.endsWith(join("securite", "antibot.ts")))
    .flatMap((f) => {
      const texte = readFileSync(f, "utf8");
      return [...texte.matchAll(/evaluerUnGeste\(\{([\s\S]*?)\}\)/g)].map(
        (m) => ({ fichier: relative(racine, f), corps: m[1] }),
      );
    });

  it("trouve les appelants connus", () => {
    // Si ce nombre baisse, l'expression ne lit plus les appels : le test
    // suivant passerait alors sans rien vérifier.
    expect(appels.map((a) => a.fichier).sort()).toEqual(
      [
        join("lib", "auth", "gestes.ts"),
        join("lib", "contact", "actions.ts"),
        // Le bouton « Contact » d'une vitrine, depuis le 27/10 : sans jeton,
        // avec `delaiRequis`, comme le formulaire de l'équipe.
        join("lib", "contact", "actions-createur.ts"),
        join("lib", "infolettre", "actions.ts"),
      ].sort(),
    );
  });

  it("concorde avec la présence d'un jeton dans les appels", () => {
    const avecJeton = appels.filter((a) => /\bjeton\b/.test(a.corps ?? ""));
    expect(avecJeton.length > 0).toBe(UN_FORMULAIRE_TRANSMET_LE_JETON);
  });
});
