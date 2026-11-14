import { describe, expect, it } from "vitest";

import { lireProgressionVendeur } from "@/lib/dashboard/devenir-vendeur-lecture";
import { db } from "@/lib/db";

let n = 0;

function suffixe(): string {
  n += 1;
  return `${n}-${Math.random().toString(36).slice(2, 7)}`;
}

describe("lireProgressionVendeur — décompte réel en base", () => {
  it("refuse un portfolio sans https:// ('awadiallo.com') tant qu'aucun réseau affichable n'est présent", async () => {
    const s = suffixe();
    const user = await db.user.create({
      data: {
        email: `vendeur-portfolio-${s}@baobart.test`,
        profile: {
          create: {
            username: `vendeur-portfolio-${s}`,
            displayName: "Awa Diallo",
            avatarUrl: "https://cdn.baobart.test/avatars/awa.webp",
            bio: "Illustratrice et directrice artistique à Dakar.",
            speciality: "Illustration éditoriale",
            portfolioUrl: "awadiallo.com",
          },
        },
      },
      select: { id: true },
    });

    const progression = await lireProgressionVendeur(user.id);
    expect(progression.etapes[0].faite).toBe(false);
    expect(progression.etapes[0].detail).toBe("Ton portfolio doit commencer par https://");
    expect(progression.etapes[0].action.href).toBe("/dashboard/boutique");
  });

  it("distingue un compte de versement créé il y a 2 h (« utilisable le … ») d'un compte créé il y a 3 jours (« faite » sans attente), et compte seules les ressources publiées", async () => {
    const s = suffixe();
    const maintenant = new Date("2026-11-09T12:00:00.000Z");
    const ilYA2Heures = new Date(maintenant.getTime() - 2 * 3_600_000);
    const ilYA3Jours = new Date(maintenant.getTime() - 3 * 24 * 3_600_000);

    const user = await db.user.create({
      data: {
        email: `vendeur-${s}@baobart.test`,
        profile: {
          create: {
            username: `vendeur-${s}`,
            displayName: "Awa Diallo",
          },
        },
      },
      select: { id: true, profile: { select: { id: true } } },
    });

    // 1. Compte tout juste créé : 0 étape sur 3
    const depart = await lireProgressionVendeur(user.id, maintenant);
    expect(depart.faites).toBe(0);
    expect(depart.etapes.map((e) => e.faite)).toEqual([false, false, false]);

    // 2. Profil rempli avec un lien réseau valide, un compte de versement
    //    enregistré il y a 2 h (donc dans le délai de 24 h), et 2 produits publiés
    //    + 2 non publiés.
    await db.profile.update({
      where: { id: user.profile!.id },
      data: {
        avatarUrl: "https://cdn.baobart.test/avatars/awa.webp",
        bio: "Illustratrice et directrice artistique à Abidjan.",
        speciality: "Illustration éditoriale",
        links: {
          create: {
            network: "BEHANCE",
            url: "https://www.behance.net/awadiallo",
          },
        },
      },
    });

    const compteRecent = await db.payoutAccount.create({
      data: {
        userId: user.id,
        method: "MOBILE_MONEY",
        provider: "om",
        accountRef: "+2250700000002",
        holderName: "Awa Diallo",
        createdAt: ilYA2Heures,
        deletedAt: null,
      },
      select: { id: true },
    });

    await db.product.createMany({
      data: [
        { sellerId: user.id, name: "Publié 1", slug: `pub-1-${s}`, price: 2_000, currency: "XOF", status: "PUBLISHED" },
        { sellerId: user.id, name: "Publié 2", slug: `pub-2-${s}`, price: 3_000, currency: "XOF", status: "PUBLISHED" },
        { sellerId: user.id, name: "Brouillon 1", slug: `drf-1-${s}`, price: 1_000, currency: "XOF", status: "DRAFT" },
        { sellerId: user.id, name: "Brouillon 2", slug: `drf-2-${s}`, price: 1_500, currency: "XOF", status: "ARCHIVED" },
      ],
    });

    const milieu = await lireProgressionVendeur(user.id, maintenant);
    expect(milieu.faites).toBe(2);
    expect(milieu.etapes[0]).toMatchObject({ cle: "profil", faite: true });
    expect(milieu.etapes[1]).toMatchObject({ cle: "versement", faite: true, enAttente: true });
    expect(milieu.etapes[1].detail).toBe("Faite, utilisable le 10/11/2026 à 10:00");
    expect(milieu.etapes[2]).toMatchObject({ cle: "ressources", faite: false, detail: "2 / 3" });

    // 3. On retire le compte de 2 h et on a un compte actif créé il y a 3 jours
    //    (il a purgé ses 24 h) + 3e ressource publiée.
    await db.payoutAccount.update({
      where: { id: compteRecent.id },
      data: { deletedAt: maintenant },
    });
    await db.payoutAccount.create({
      data: {
        userId: user.id,
        method: "MOBILE_MONEY",
        provider: "wave",
        accountRef: "+2250700000001",
        holderName: "Awa Diallo",
        createdAt: ilYA3Jours,
        deletedAt: null,
      },
    });
    await db.product.create({
      data: { sellerId: user.id, name: "Publié 3", slug: `pub-3-${s}`, price: 4_000, currency: "XOF", status: "PUBLISHED" },
    });

    const complet = await lireProgressionVendeur(user.id, maintenant);
    expect(complet.faites).toBe(3);
    expect(complet.etapes.map((e) => e.faite)).toEqual([true, true, true]);
    expect(complet.etapes[1].enAttente).toBe(false);
    expect(complet.etapes[1].detail).toBe("Faite");
    expect(complet.etapes[2].detail).toContain("3 / 3");
  });
});
