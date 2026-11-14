import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { etapesVendeur, type FaitsVendeur } from "@/lib/dashboard/devenir-vendeur";
import { VERIFICATION_MS } from "@/lib/payments/eligibilite";

const MAINTENANT = new Date("2026-11-09T12:00:00.000Z");

const VIDE: FaitsVendeur = {
  profil: null,
  versement: { enregistreLe: null },
  ressourcesPubliees: 0,
  maintenant: MAINTENANT,
};

describe("etapesVendeur — progression vers la boutique", () => {
  it("compte vide : 0 étape sur 3, et l'étape 1 mène à /dashboard/boutique tant que spécialité et liens manquent", () => {
    const res = etapesVendeur(VIDE);

    expect(res.faites).toBe(0);
    expect(res.total).toBe(3);
    expect(res.etapes.map((e) => ({ cle: e.cle, faite: e.faite, href: e.action.href }))).toEqual([
      { cle: "profil", faite: false, href: "/dashboard/boutique" },
      { cle: "versement", faite: false, href: "/dashboard/versements" },
      { cle: "ressources", faite: false, href: "/dashboard/produits/nouveau" },
    ]);
    expect(res.etapes[2].detail).toBe("0 / 3");
  });

  it("oriente l'étape 1 vers /dashboard/profil quand seules la photo ou la bio manquent, et vers /dashboard/boutique sinon", () => {
    const manquePhotoSeulement = etapesVendeur({
      ...VIDE,
      profil: {
        avatarUrl: null,
        bio: "Illustratrice éditoriale à Dakar.",
        speciality: "Illustration & motifs",
        portfolioUrl: "https://awa.design",
        liens: [],
      },
    });
    expect(manquePhotoSeulement.etapes[0].faite).toBe(false);
    expect(manquePhotoSeulement.etapes[0].action.href).toBe("/dashboard/profil");

    const manqueSpecialite = etapesVendeur({
      ...VIDE,
      profil: {
        avatarUrl: "https://cdn.baobart.test/avatars/awa.webp",
        bio: "Illustratrice éditoriale à Dakar.",
        speciality: null,
        portfolioUrl: "https://awa.design",
        liens: [],
      },
    });
    expect(manqueSpecialite.etapes[0].faite).toBe(false);
    expect(manqueSpecialite.etapes[0].action.href).toBe("/dashboard/boutique");
  });

  it("refuse un portfolio sans https:// ou un réseau hors domaine, comme la vitrine publique", () => {
    const portfolioSansHttps = etapesVendeur({
      ...VIDE,
      profil: {
        avatarUrl: "https://cdn.baobart.test/avatars/awa.webp",
        bio: "Illustratrice éditoriale à Dakar.",
        speciality: "Illustration & motifs",
        portfolioUrl: "awadiallo.com",
        liens: [],
      },
    });

    expect(portfolioSansHttps.etapes[0].faite).toBe(false);
    expect(portfolioSansHttps.etapes[0].detail).toBe("Ton portfolio doit commencer par https://");
    expect(portfolioSansHttps.etapes[0].action.href).toBe("/dashboard/boutique");

    const lienHorsDomaine = etapesVendeur({
      ...VIDE,
      profil: {
        avatarUrl: "https://cdn.baobart.test/avatars/awa.webp",
        bio: "Illustratrice éditoriale à Dakar.",
        speciality: "Illustration & motifs",
        portfolioUrl: null,
        liens: [{ network: "BEHANCE", url: "https://exemple.test/awa" }],
      },
    });

    expect(lienHorsDomaine.etapes[0].faite).toBe(false);
    expect(lienHorsDomaine.etapes[0].detail).toContain("lien ou portfolio");

    const avecLienValide = etapesVendeur({
      ...VIDE,
      profil: {
        avatarUrl: "https://cdn.baobart.test/avatars/awa.webp",
        bio: "Illustratrice éditoriale à Dakar.",
        speciality: "Illustration & motifs",
        portfolioUrl: null,
        liens: [{ network: "BEHANCE", url: "https://www.behance.net/awadiallo" }],
      },
    });
    expect(avecLienValide.etapes[0].faite).toBe(true);
    expect(avecLienValide.faites).toBe(1);
  });

  it("compte de versement au bord exact : 23 h 59 → « utilisable le … », 24 h 00 → « faite » sans attente", () => {
    const ilYA23h59 = new Date(MAINTENANT.getTime() - (VERIFICATION_MS - 60_000));
    const recent = etapesVendeur({
      ...VIDE,
      versement: { enregistreLe: ilYA23h59 },
      maintenant: MAINTENANT,
    });

    expect(recent.etapes[1].faite).toBe(true);
    expect(recent.etapes[1].enAttente).toBe(true);
    expect(recent.etapes[1].detail).toBe("Faite, utilisable le 09/11/2026 à 12:01");
    expect(recent.faites).toBe(1);

    const ilYA24h00 = new Date(MAINTENANT.getTime() - VERIFICATION_MS);
    const pret = etapesVendeur({
      ...VIDE,
      versement: { enregistreLe: ilYA24h00 },
      maintenant: MAINTENANT,
    });

    expect(pret.etapes[1].faite).toBe(true);
    expect(pret.etapes[1].enAttente).toBe(false);
    expect(pret.etapes[1].detail).toBe("Faite");
  });

  it("2 ressources publiées : affiche « 2 / 3 » et l'étape reste non faite", () => {
    const res = etapesVendeur({
      ...VIDE,
      ressourcesPubliees: 2,
    });

    expect(res.etapes[2].faite).toBe(false);
    expect(res.etapes[2].detail).toBe("2 / 3");
    expect(res.faites).toBe(0);
  });

  it("3 ressources publiées : l'étape est faite", () => {
    const res = etapesVendeur({
      ...VIDE,
      ressourcesPubliees: 3,
    });

    expect(res.etapes[2].faite).toBe(true);
    expect(res.etapes[2].detail).toContain("3 / 3");
    expect(res.faites).toBe(1);
  });

  it("propriété (fast-check) : monotonie en ressourcesPubliees et rejet de tout portfolio hors https:// sans lien réseau", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        fc.string().filter((s) => !s.trim().startsWith("https://")),
        (n, delta, fauxPortfolio) => {
          const avant = etapesVendeur({ ...VIDE, ressourcesPubliees: n });
          const apres = etapesVendeur({ ...VIDE, ressourcesPubliees: n + delta });
          expect(apres.faites).toBeGreaterThanOrEqual(avant.faites);
          expect(avant.faites).toBeGreaterThanOrEqual(0);
          expect(avant.faites).toBeLessThanOrEqual(3);

          const sansHttps = etapesVendeur({
            ...VIDE,
            profil: {
              avatarUrl: "https://cdn.baobart.test/a.webp",
              bio: "Bio",
              speciality: "Design",
              portfolioUrl: fauxPortfolio,
              liens: [],
            },
          });
          expect(sansHttps.etapes[0].faite).toBe(false);
        },
      ),
    );
  });
});
