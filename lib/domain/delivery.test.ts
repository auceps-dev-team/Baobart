import { describe, expect, it } from "vitest";

import {
  VALIDITE_PAR_DEFAUT,
  decideAcces,
  dureeUrlSignee,
  periodeQuota,
  plateformeDepuisUserAgent,
} from "./delivery";

const MO = 1024 * 1024;

describe("durée de validité d'une URL signée", () => {
  it("ne descend jamais sous le plancher, même pour un fichier minuscule", () => {
    expect(dureeUrlSignee(1024)).toBe(VALIDITE_PAR_DEFAUT.minimum);
    expect(dureeUrlSignee(0)).toBe(VALIDITE_PAR_DEFAUT.minimum);
  });

  it("s'allonge avec la taille du fichier", () => {
    expect(dureeUrlSignee(50 * MO)).toBeGreaterThan(dureeUrlSignee(5 * MO));
  });

  it("laisse le temps de télécharger un pack de 200 Mo sur une connexion lente", () => {
    // 200 Mo à 12,8 ko/s ≈ 4 h 33. C'est le cas qui motive tout ce calcul :
    // avec l'hypothèse de débit de Gumroad, l'URL expirerait avant la fin.
    const duree = dureeUrlSignee(200 * MO);

    expect(duree).toBeGreaterThan(4 * 3600);
    expect(duree).toBeLessThanOrEqual(VALIDITE_PAR_DEFAUT.maximum);
  });

  it("plafonne pour ne pas laisser une URL vivre indéfiniment", () => {
    expect(dureeUrlSignee(10_000 * MO)).toBe(VALIDITE_PAR_DEFAUT.maximum);
  });

  it("applique une durée fixe aux vidéos", () => {
    expect(dureeUrlSignee(1 * MO, { isVideo: true })).toBe(
      VALIDITE_PAR_DEFAUT.video,
    );
    expect(dureeUrlSignee(900 * MO, { isVideo: true })).toBe(
      VALIDITE_PAR_DEFAUT.video,
    );
  });

  it("respecte une configuration explicite", () => {
    const config = { ...VALIDITE_PAR_DEFAUT, assumedBytesPerSecond: 51_200 };
    expect(dureeUrlSignee(200 * MO, { config })).toBeLessThan(
      dureeUrlSignee(200 * MO),
    );
  });
});

describe("droit de télécharger — refus", () => {
  it("refuse une commande non aboutie", () => {
    expect(
      decideAcces({ source: "ACHAT", achatAbouti: false }),
    ).toEqual({ autorise: false, raison: "COMMANDE_NON_PAYEE" });
  });

  it("refuse après un remboursement intégral", () => {
    expect(
      decideAcces({
        source: "ACHAT",
        achatAbouti: true,
        rembourseIntegralement: true,
      }),
    ).toEqual({ autorise: false, raison: "REMBOURSE" });
  });

  it("laisse l'accès après un remboursement PARTIEL", () => {
    // Un geste commercial ne retire pas ce qui a été acheté.
    expect(
      decideAcces({
        source: "ACHAT",
        achatAbouti: true,
        rembourseIntegralement: false,
      }),
    ).toMatchObject({ autorise: true });
  });

  it("refuse quand l'abonnement n'est plus actif", () => {
    expect(
      decideAcces({
        source: "ABONNEMENT",
        achatAbouti: true,
        abonnementActif: false,
      }),
    ).toEqual({ autorise: false, raison: "ABONNEMENT_INACTIF" });
  });

  it("refuse quand l'accès a expiré", () => {
    expect(
      decideAcces({
        source: "ACHAT",
        achatAbouti: true,
        accesExpireLe: new Date("2026-01-01"),
        now: new Date("2026-08-02"),
      }),
    ).toEqual({ autorise: false, raison: "ACCES_EXPIRE" });
  });

  it("laisse passer tant que la date d'expiration n'est pas atteinte", () => {
    expect(
      decideAcces({
        source: "ACHAT",
        achatAbouti: true,
        accesExpireLe: new Date("2026-12-31"),
        now: new Date("2026-08-02"),
      }),
    ).toMatchObject({ autorise: true });
  });

  it("répond d'abord ce qui relève du paiement", () => {
    // Tout est faux à la fois : le message doit parler du paiement, pas du quota.
    expect(
      decideAcces({
        source: "ABONNEMENT",
        achatAbouti: false,
        abonnementActif: false,
        quota: { utilises: 99, limite: 3 },
      }),
    ).toEqual({ autorise: false, raison: "COMMANDE_NON_PAYEE" });
  });
});

describe("droit de télécharger — quotas", () => {
  it("ne décompte JAMAIS un achat à l'unité", () => {
    expect(
      decideAcces({
        source: "ACHAT",
        achatAbouti: true,
        quota: { utilises: 3, limite: 3 }, // quota déjà épuisé
      }),
    ).toEqual({ autorise: true, consommeQuota: false });
  });

  it("décompte un téléchargement au titre de l'abonnement", () => {
    expect(
      decideAcces({
        source: "ABONNEMENT",
        achatAbouti: true,
        quota: { utilises: 0, limite: 3 },
      }),
    ).toEqual({ autorise: true, consommeQuota: true });
  });

  it("refuse quand le quota du mois est épuisé", () => {
    expect(
      decideAcces({
        source: "ABONNEMENT",
        achatAbouti: true,
        quota: { utilises: 3, limite: 3 },
      }),
    ).toEqual({ autorise: false, raison: "QUOTA_EPUISE" });
  });

  it("ne redécompte pas un re-téléchargement, même quota épuisé", () => {
    // Une connexion qui coupe ne doit pas coûter un second téléchargement.
    expect(
      decideAcces({
        source: "ABONNEMENT",
        achatAbouti: true,
        dejaTelecharge: true,
        quota: { utilises: 3, limite: 3 },
      }),
    ).toEqual({ autorise: true, consommeQuota: false });
  });

  it("ne décompte rien pour un palier illimité", () => {
    expect(
      decideAcces({
        source: "ABONNEMENT",
        achatAbouti: true,
        quota: { utilises: 900, limite: null },
      }),
    ).toEqual({ autorise: true, consommeQuota: false });
  });

  it("laisse passer le tout dernier téléchargement du quota", () => {
    expect(
      decideAcces({
        source: "ABONNEMENT",
        achatAbouti: true,
        quota: { utilises: 2, limite: 3 },
      }),
    ).toEqual({ autorise: true, consommeQuota: true });
  });
});

describe("période de quota", () => {
  it("suit le format AAAA-MM du modèle DownloadQuota", () => {
    expect(periodeQuota(new Date("2026-08-02T23:00:00Z"))).toBe("2026-08");
    expect(periodeQuota(new Date("2026-01-31T00:00:00Z"))).toBe("2026-01");
  });
});

describe("plateforme", () => {
  it("distingue le mobile du reste", () => {
    expect(plateformeDepuisUserAgent("Mozilla/5.0 (Linux; Android 14)")).toBe(
      "ANDROID",
    );
    expect(plateformeDepuisUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS)")).toBe(
      "IPHONE",
    );
    expect(plateformeDepuisUserAgent("Mozilla/5.0 (Windows NT 10.0)")).toBe(
      "AUTRE",
    );
    expect(plateformeDepuisUserAgent(null)).toBe("AUTRE");
  });
});
