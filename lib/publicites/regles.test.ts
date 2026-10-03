import { describe, expect, it } from "vitest";

import {
  etatDeLaPublicite,
  lienAcceptable,
  tauxDeClic,
  validerEcart,
  validerPublicite,
  type SaisiePub,
} from "@/lib/publicites/regles";

const RACINE = "http://localhost:9000/baobart/public/pubs/";

const saisie = (s: Partial<SaisiePub> = {}): SaisiePub => ({
  titre: "Pack wax de la rentrée",
  lien: "/products/pack-wax",
  nature: "IMAGE",
  imageUrl: `${RACINE}a.png`,
  imageLargeur: "1200",
  imageHauteur: "600",
  videoUrl: "",
  frequence: "10",
  debut: "",
  fin: "",
  ...s,
});

describe("la validation d'une publicité", () => {
  it("accepte une bannière image complète", () => {
    const v = validerPublicite(saisie(), RACINE);
    expect(v).toMatchObject({ ok: true, pub: { frequency: 10, imageWidth: 1200, videoUrl: null } });
  });

  it("refuse un média qui ne vient pas de notre stockage", () => {
    // Un pixel de suivi tiers, déguisé en bannière.
    expect(validerPublicite(saisie({ imageUrl: "https://traqueur.example/p.gif" }), RACINE)).toMatchObject({ ok: false, champ: "imageUrl" });
    expect(validerPublicite(saisie({ nature: "VIDEO", videoUrl: "https://youtube.com/watch?v=x" }), RACINE)).toMatchObject({ ok: false, champ: "videoUrl" });
  });

  it("borne la fréquence entre trois et cent", () => {
    expect(validerPublicite(saisie({ frequence: "2" }), RACINE)).toMatchObject({ ok: false, champ: "frequence" });
    expect(validerPublicite(saisie({ frequence: "101" }), RACINE)).toMatchObject({ ok: false, champ: "frequence" });
    expect(validerPublicite(saisie({ frequence: "3" }), RACINE).ok).toBe(true);
  });

  it("lit les dates en GMT et exige une fin après le début", () => {
    const v = validerPublicite(saisie({ debut: "2026-10-10T08:00", fin: "2026-10-20T08:00" }), RACINE);
    expect(v.ok && v.pub.startsAt?.toISOString()).toBe("2026-10-10T08:00:00.000Z");
    expect(validerPublicite(saisie({ debut: "2026-10-10T08:00", fin: "2026-10-10T08:00" }), RACINE)).toMatchObject({ ok: false, champ: "fin" });
  });

  it("oublie la vidéo quand on repasse à une image", () => {
    const v = validerPublicite(saisie({ videoUrl: `${RACINE}v.mp4` }), RACINE);
    expect(v.ok && v.pub.videoUrl).toBeNull();
  });
});

describe("le lien d'une bannière", () => {
  it("accepte un chemin de Baobart ou une adresse https", () => {
    expect(lienAcceptable("/products/pack-wax")).toBe(true);
    expect(lienAcceptable("https://exemple.ci/offre")).toBe(true);
  });

  it("refuse ce qui exécute, ce qui se réécrit et ce qui se déguise", () => {
    expect(lienAcceptable("javascript:alert(1)")).toBe(false);
    expect(lienAcceptable("http://exemple.ci")).toBe(false);
    expect(lienAcceptable("//ailleurs.com")).toBe(false);
    expect(lienAcceptable("/\\ailleurs.com")).toBe(false);
    expect(lienAcceptable("https://moi:secret@exemple.ci")).toBe(false);
  });
});

describe("l'état et les chiffres", () => {
  const maintenant = new Date("2026-10-03T12:00:00Z");
  const hier = new Date("2026-10-02T12:00:00Z");
  const demain = new Date("2026-10-04T12:00:00Z");

  it("dit terminée avant en pause, et programmée avant le début", () => {
    expect(etatDeLaPublicite({ pausedAt: hier, startsAt: null, endsAt: hier }, maintenant)).toBe("TERMINEE");
    expect(etatDeLaPublicite({ pausedAt: hier, startsAt: null, endsAt: demain }, maintenant)).toBe("EN_PAUSE");
    expect(etatDeLaPublicite({ pausedAt: null, startsAt: demain, endsAt: null }, maintenant)).toBe("PROGRAMMEE");
    expect(etatDeLaPublicite({ pausedAt: null, startsAt: hier, endsAt: demain }, maintenant)).toBe("ACTIVE");
  });

  it("ne donne pas de taux de clic sans affichage", () => {
    expect(tauxDeClic(0, 0)).toBeNull();
    expect(tauxDeClic(1000, 25)).toBe(2.5);
  });

  it("borne l'écart minimal", () => {
    expect(validerEcart("4")).toBe(4);
    expect(validerEcart("0")).toBeNull();
    expect(validerEcart("abc")).toBeNull();
  });
});
