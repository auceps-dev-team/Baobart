import { describe, expect, it } from "vitest";

import { aRetirer, balayerLesMedias, nomDuFichier, nomsCites, type Objet } from "@/lib/medias/balayage";

const MAINTENANT = new Date("2026-10-03T12:00:00Z");
const VIEUX = new Date("2026-09-30T12:00:00Z");
const RECENT = new Date("2026-10-03T08:00:00Z");

const U1 = "0b2c4d6e-1111-4a2b-9c3d-000000000001";
const U2 = "0b2c4d6e-2222-4a2b-9c3d-000000000002";
const U3 = "0b2c4d6e-3333-4a2b-9c3d-000000000003";
const URL_PUB = (u: string, ext = "png") => `http://localhost:9000/baobart-media/public/pubs/${u}.${ext}`;

describe("les fichiers cités", () => {
  it("se retrouvent dans un corps d'article, une adresse ou un texte libre", () => {
    const cites = nomsCites([
      `Le wax.\n\n![](http://cdn.ci/public/blog/${U1}.jpg)\n\nFin.`,
      URL_PUB(U2, "webm"),
      null,
      "aucune image ici",
    ]);
    expect([...cites].sort()).toEqual([`${U1}.jpg`, `${U2}.webm`]);
  });

  it("ne confondent pas un nom choisi à la main avec un dépôt", () => {
    // Seuls les noms tirés au sort au dépôt sont les nôtres.
    expect(nomsCites(["/img/blog/couverture.jpg"]).size).toBe(0);
  });

  it("se lisent depuis une clé comme depuis une adresse", () => {
    expect(nomDuFichier(`public/pubs/${U1}.png`)).toBe(`${U1}.png`);
    expect(nomDuFichier(`${URL_PUB(U1)}?v=2`)).toBe(`${U1}.png`);
  });
});

describe("ce qu'on retire", () => {
  const objets: Objet[] = [
    { cle: `public/pubs/${U1}.png`, modifieLe: VIEUX },
    { cle: `public/pubs/${U2}.png`, modifieLe: VIEUX },
    { cle: `public/blog/${U3}.jpg`, modifieLe: RECENT },
  ];

  it("retire le vieux non cité, garde le cité et le récent", () => {
    const d = aRetirer({ objets, cites: new Set([`${U1}.png`]), maintenant: MAINTENANT });
    expect(d).toEqual({ retirer: [`public/pubs/${U2}.png`], recents: 1, cites: 1 });
  });

  it("ne dépasse jamais le plafond d'un passage", () => {
    const beaucoup = Array.from({ length: 10 }, (_, i) => ({ cle: `public/pubs/${i}.png`, modifieLe: VIEUX }));
    expect(aRetirer({ objets: beaucoup, cites: new Set(), maintenant: MAINTENANT, plafond: 3 }).retirer).toHaveLength(3);
  });
});

describe("le passage", () => {
  const stockage = () => {
    const supprimes: string[] = [];
    return {
      supprimes,
      lister: async (prefixe: string) =>
        prefixe === "public/pubs/"
          ? [{ cle: `public/pubs/${U1}.png`, modifieLe: VIEUX }, { cle: `public/pubs/${U2}.png`, modifieLe: VIEUX }]
          : [],
      supprimer: async (cle: string) => {
        supprimes.push(cle);
      },
    };
  };

  it("retire l'orphelin et garde le média d'une bannière", async () => {
    const s = stockage();
    const bilan = await balayerLesMedias({
      ...s,
      textes: async () => [URL_PUB(U1)],
      attendues: async () => [URL_PUB(U1)],
      maintenant: MAINTENANT,
    });
    expect(s.supprimes).toEqual([`public/pubs/${U2}.png`]);
    expect(bilan).toMatchObject({ examines: 2, cites: 1, retires: 1 });
  });

  it("s'arrête sans rien retirer quand l'extraction ne reconnaît plus une adresse rangée", async () => {
    // Le cas qui viderait tout : une extraction qui ne trouve rien « réussit ».
    const s = stockage();
    const bilan = await balayerLesMedias({
      ...s,
      textes: async () => [],
      attendues: async () => [URL_PUB(U1)],
      maintenant: MAINTENANT,
    });
    expect(s.supprimes).toEqual([]);
    expect(bilan.arret).toMatch(/rien n'est retiré/);
  });

  it("en essai, rend la liste et ne supprime rien", async () => {
    const s = stockage();
    const bilan = await balayerLesMedias({
      ...s,
      textes: async () => [URL_PUB(U1)],
      attendues: async () => [],
      maintenant: MAINTENANT,
      essai: true,
    });
    expect(s.supprimes).toEqual([]);
    expect(bilan.aRetirer).toEqual([`public/pubs/${U2}.png`]);
  });
});
