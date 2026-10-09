/**
 * Qui a une vitrine, et qui n'en a pas.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TROIS ABSENCES QUI SE RESSEMBLENT ET N'ONT RIEN À VOIR
 *
 * Un nom d'utilisateur inconnu, un acheteur qui n'a rien publié, un compte
 * suspendu : les trois rendent `null`, et c'est délibéré. Distinguer « ce
 * compte est suspendu » d'un inconnu apprendrait à un curieux qu'il existe, et
 * pourquoi.
 *
 * Mais les trois doivent VRAIMENT rendre `null`. Laisser la vitrine d'un compte
 * suspendu debout reviendrait à continuer de le recommander pendant l'enquête.
 */

import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  famillesDesCreateurs,
  listerCreateurs,
  profilPublic,
  suitCeCreateur,
  suivisParmi,
} from "@/lib/createurs/queries";
import type { ProductFamily } from "@/lib/domain/prisma-types";

let n = 0;

async function compte(options: { suspendu?: boolean } = {}) {
  n += 1;
  return db.user.create({
    data: {
      email: `vitrine-${n}@baobart.test`,
      suspendedAt: options.suspendu ? new Date() : null,
      profile: {
        create: {
          username: `awa-${n}`,
          displayName: `Awa ${n}`,
          speciality: "Illustration",
          city: "Abidjan",
          followerCount: 10 * n,
        },
      },
    },
    select: { id: true },
  });
}

async function publier(vendeurId: string, ventes = 0, famille?: ProductFamily) {
  n += 1;
  return db.product.create({
    data: {
      sellerId: vendeurId,
      name: `Ressource ${n}`,
      slug: `ressource-vitrine-${n}`,
      price: 5_000,
      currency: "XOF",
      status: "PUBLISHED",
      salesCount: ventes,
      family: famille ?? null,
      // Une seconde d'écart par ressource : l'ordre « la plus récente
      // d'abord » ne dépend pas de deux créations tombées sur la même
      // milliseconde.
      createdAt: new Date(Date.UTC(2026, 0, 1) + n * 1_000),
    },
    select: { id: true, slug: true },
  });
}

describe("le profil public", () => {
  it("existe dès qu'on a publié", async () => {
    const c = await compte();
    await publier(c.id, 7);
    await publier(c.id, 5);

    const profil = await profilPublic(`awa-${n - 2}`);
    expect(profil).not.toBeNull();
    expect(profil!.ressourcesPubliees).toBe(2);
    // Les ventes s'additionnent depuis les compteurs dénormalisés des
    // ressources : c'est ce que la maquette appelle « ventes à vie ».
    expect(profil!.ventes).toBe(12);
  });

  it("n'existe pas pour un acheteur", async () => {
    // On devient créateur en publiant, pas en s'inscrivant. Une page vide au
    // nom de quelqu'un lui ferait du tort.
    const c = await compte();
    const nom = `awa-${n}`;
    expect(c.id).toBeTruthy();

    expect(await profilPublic(nom)).toBeNull();
  });

  it("disparaît quand le compte est suspendu", async () => {
    // Laisser la vitrine debout pendant l'enquête reviendrait à continuer de
    // le recommander.
    const c = await compte({ suspendu: true });
    const nom = `awa-${n}`;
    await publier(c.id);

    expect(await profilPublic(nom)).toBeNull();
  });

  it("ne compte pas les brouillons", async () => {
    // `Profile.workCount` compte les créations, brouillons compris. Afficher
    // « 3 ressources » sur une page qui en montre une ferait douter du reste.
    const c = await compte();
    const nom = `awa-${n}`;
    await publier(c.id);

    n += 1;
    await db.product.create({
      data: {
        sellerId: c.id,
        name: "Brouillon",
        slug: `brouillon-${n}`,
        price: 1_000,
        currency: "XOF",
        status: "DRAFT",
      },
    });

    const profil = await profilPublic(nom);
    expect(profil!.ressourcesPubliees).toBe(1);
  });

  it("rend null sur un nom inconnu", async () => {
    expect(await profilPublic("personne-de-ce-nom")).toBeNull();
  });
});

describe("l'annuaire", () => {
  it("ne liste que ceux qui ont publié", async () => {
    const publiant = await compte();
    await publier(publiant.id);
    await compte(); // un acheteur, qui ne doit pas y figurer

    const liste = await listerCreateurs();
    expect(liste).toHaveLength(1);
    expect(liste[0]!.ressourcesPubliees).toBe(1);
  });

  it("écarte les comptes suspendus", async () => {
    const suspendu = await compte({ suspendu: true });
    await publier(suspendu.id);

    expect(await listerCreateurs()).toHaveLength(0);
  });

  it("classe par abonnés, pas par ventes", async () => {
    // Trier par ventes mettrait en avant ceux qui vendent cher plutôt que ceux
    // qu'on suit, et ferait de la page un classement commercial.
    const petit = await compte(); // followerCount plus faible
    await publier(petit.id, 500);
    const grand = await compte(); // followerCount plus élevé
    await publier(grand.id, 1);

    const liste = await listerCreateurs();
    expect(liste[0]!.abonnes).toBeGreaterThan(liste[1]!.abonnes);
  });

  it("ne casse pas sur une base vide", async () => {
    expect(await listerCreateurs()).toEqual([]);
  });
});

describe("le suivi", () => {
  it("se lit sans passer par une fiche produit", async () => {
    const createur = await compte();
    const visiteur = await compte();

    expect(await suitCeCreateur(visiteur.id, createur.id)).toBe(false);

    await db.follow.create({
      data: { followerId: visiteur.id, followingId: createur.id },
    });

    expect(await suitCeCreateur(visiteur.id, createur.id)).toBe(true);
  });

  it("rend faux sans visiteur, et sur soi-même", async () => {
    const c = await compte();
    expect(await suitCeCreateur(null, c.id)).toBe(false);
    expect(await suitCeCreateur(c.id, c.id)).toBe(false);
  });

  it("se lit pour tout l'annuaire d'un coup", async () => {
    const suivi = await compte();
    const pasSuivi = await compte();
    const visiteur = await compte();
    await db.follow.create({ data: { followerId: visiteur.id, followingId: suivi.id } });

    const ensemble = await suivisParmi(visiteur.id, [suivi.id, pasSuivi.id]);
    expect([...ensemble]).toEqual([suivi.id]);
    expect((await suivisParmi(null, [suivi.id])).size).toBe(0);
  });
});

// Ajouté le 09/10, avec la page Créateurs reprise de la maquette (bande de
// travaux, filtre par famille).
describe("l'annuaire, par famille et avec ses travaux", () => {
  it("ne garde que ceux qui publient dans la famille, et compte tout leur catalogue", async () => {
    const polyvalent = await compte();
    await publier(polyvalent.id, 0, "PHOTO");
    await publier(polyvalent.id, 0, "FONT");
    const photographe = await compte();
    await publier(photographe.id, 0, "PHOTO");

    const liste = await listerCreateurs({ famille: "FONT" });
    expect(liste.map((c) => c.id)).toEqual([polyvalent.id]);
    // Le total reste celui du créateur, toutes familles confondues…
    expect(liste[0]!.ressourcesPubliees).toBe(2);
    // … mais les vignettes montrent ce qui l'a fait entrer dans la liste.
    expect(liste[0]!.travaux).toHaveLength(1);
  });

  it("montre au plus cinq travaux, le plus récent d'abord", async () => {
    const c = await compte();
    const publies = [];
    for (let i = 0; i < 7; i += 1) publies.push(await publier(c.id));

    const [vitrine] = await listerCreateurs();
    expect(vitrine!.travaux).toHaveLength(5);
    expect(vitrine!.travaux.map((t) => t.slug)).toEqual(
      publies.slice(2).reverse().map((p) => p.slug),
    );
  });

  it("ne propose que les familles où publie un compte visible", async () => {
    const actif = await compte();
    await publier(actif.id, 0, "ILLUSTRATION");
    const suspendu = await compte({ suspendu: true });
    await publier(suspendu.id, 0, "AUDIO");

    expect(await famillesDesCreateurs()).toEqual(["ILLUSTRATION"]);
  });
});
