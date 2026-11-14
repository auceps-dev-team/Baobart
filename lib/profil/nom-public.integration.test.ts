/**
 * Aucune lecture publique ne rend l'adresse d'un compte.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE SEULE PROPRIÉTÉ, ET LA LISTE DE CEUX QUI DOIVENT LA TENIR
 *
 * Jusqu'au 13/11/2026 (B14), neuf lectures ouvertes à tous nommaient l'auteur
 * par `profile?.displayName ?? email`. Un compte sans profil y voyait donc son
 * adresse publiée — sur la fiche d'une offre d'emploi, dans le JSON-LD d'un
 * article, sur un sujet de forum lisible sans compte.
 *
 * Ce fichier les appelle toutes, pour un compte sans profil, et cherche
 * l'adresse dans **toute** la valeur rendue, pas dans un champ : un champ
 * ajouté demain qui la porterait serait attrapé aussi.
 *
 * Une nouvelle lecture publique qui nomme une personne s'ajoute ici.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LE PIÈGE DU TEST QUI PASSE À VIDE
 *
 * `JSON.stringify(null)` ne contient aucune adresse. Chaque cas vérifie donc
 * d'abord que la lecture a **trouvé** ce qu'on lui a donné, et qu'elle l'a
 * nommé « Membre Baobart » : sans cela, une clause de visibilité cassée ferait
 * passer ce test en ne lisant rien.
 */

import { beforeEach, describe, expect, it } from "vitest";

import * as blog from "@/lib/blog/queries";
import { db } from "@/lib/db";
import * as evenements from "@/lib/evenements/queries";
import { collectionsDe } from "@/lib/forum/collections";
import { filDe } from "@/lib/forum/fil";
import { contexteDe, sujetAvecMessages, sujetsDe } from "@/lib/forum/queries";
import * as jobs from "@/lib/jobs/queries";
import * as services from "@/lib/services/queries";

/** Écrit en clair, pas importé : le test doit échouer sur l'ancien code pour la bonne raison. */
const DEFAUT = "Membre Baobart";

let n = 0;

beforeEach(() => {
  n = 0;
});

/**
 * Un compte comme en laisse l'effacement RGPD, un import ou un script : une
 * adresse, aucun profil. L'inscription, elle, crée toujours le profil.
 */
async function sansProfil() {
  n += 1;
  const email = `sans-profil-${n}@baobart.test`;
  const u = await db.user.create({ data: { email }, select: { id: true } });
  return { id: u.id, email };
}

/** Combien de fois l'adresse apparaît dans la valeur entière, sérialisée. */
function occurrences(valeur: unknown, email: string): number {
  return JSON.stringify(valeur).split(email).length - 1;
}

describe("aucune lecture publique ne rend l'adresse d'un compte sans profil", () => {
  it("une offre d'emploi — la fiche et la liste (B14)", async () => {
    const recruteur = await sansProfil();
    const offre = await db.jobPosting.create({
      data: {
        recruiterId: recruteur.id,
        title: "Illustrateur pour une campagne",
        description:
          "Une description assez longue pour ressembler à une vraie offre d'emploi publiée sur la plateforme.",
        type: "FREELANCE",
        mode: "REMOTE",
        state: "PUBLIE",
      },
      select: { id: true },
    });

    const fiche = await jobs.offrePublique(offre.id);
    expect(fiche?.recruteur).toBe(DEFAUT);
    expect(fiche?.recruteurUsername).toBeNull();
    expect(occurrences(fiche, recruteur.email)).toBe(0);

    const liste = await jobs.listerOffres();
    expect(liste.map((o) => o.id)).toEqual([offre.id]);
    expect(occurrences(liste, recruteur.email)).toBe(0);
  });

  it("un service — la liste", async () => {
    const createur = await sansProfil();
    const categorie = await db.serviceCategory.create({
      data: { slug: "affiches", name: "Affiches", position: 1, isActive: true },
      select: { id: true },
    });
    const svc = await db.serviceOffer.create({
      data: {
        creatorId: createur.id,
        categoryId: categorie.id,
        title: "Affiche de concert",
        description: "Prestation sérieusement décrite.",
        startingPrice: 180_000,
        deliveryDays: 10,
        state: "PUBLIE",
      },
      select: { id: true },
    });

    const liste = await services.listerOffres();
    expect(liste.map((o) => o.id)).toEqual([svc.id]);
    expect(liste[0]?.createur).toBe(DEFAUT);
    expect(occurrences(liste, createur.email)).toBe(0);
  });

  it("un service — la fiche garde l'adresse de contact, et seulement elle", async () => {
    // L'adresse en clair sous « Commander » est un choix écrit dans
    // `app/services/[id]/page.tsx` : faute de messagerie, c'est ainsi qu'on
    // joint le créateur. Elle reste — mais une fois, dans `createurEmail`,
    // pas une seconde fois à la place du nom.
    const createur = await sansProfil();
    const categorie = await db.serviceCategory.create({
      data: { slug: "logos", name: "Logos", position: 1, isActive: true },
      select: { id: true },
    });
    const svc = await db.serviceOffer.create({
      data: {
        creatorId: createur.id,
        categoryId: categorie.id,
        title: "Logo d'association",
        description: "Prestation sérieusement décrite.",
        startingPrice: 90_000,
        deliveryDays: 7,
        state: "PUBLIE",
      },
      select: { id: true },
    });

    const fiche = await services.offrePublique(svc.id);
    expect(fiche?.createur).toBe(DEFAUT);
    expect(fiche?.createurEmail).toBe(createur.email);
    expect(occurrences(fiche, createur.email)).toBe(1);
  });

  it("un article de blog — la liste, la une et la fiche (dont le JSON-LD)", async () => {
    // `app/blog/[slug]/page.tsx` recopie `auteur` dans le JSON-LD : ce qui
    // sort d'ici est lu par les moteurs de recherche, pas seulement affiché.
    const auteur = await sansProfil();
    await db.blogPost.create({
      data: {
        authorId: auteur.id,
        title: "Imprimer sur du wax",
        slug: "imprimer-sur-du-wax",
        excerpt: "Trois encres comparées.",
        body: "Un corps d'article.",
        state: "PUBLIE",
        publishedAt: new Date(),
      },
    });

    const liste = await blog.listerPublics();
    const une = await blog.articleALaUne();
    const fiche = await blog.articlePublic("imprimer-sur-du-wax");

    expect(liste).toHaveLength(1);
    for (const a of [liste[0], une, fiche]) {
      expect(a?.auteur).toBe(DEFAUT);
      expect(occurrences(a, auteur.email)).toBe(0);
    }
  });

  it("un événement — la liste, le prochain et la fiche", async () => {
    const organisateur = await sansProfil();
    const debut = new Date(Date.now() + 7 * 86_400_000);
    const e = await db.event.create({
      data: {
        organizerId: organisateur.id,
        title: "Atelier de sérigraphie",
        kind: "WORKSHOP",
        description: "Un atelier décrit avec assez de mots pour être publiable.",
        startsAt: debut,
        endsAt: new Date(debut.getTime() + 3 * 3_600_000),
        state: "PUBLIE",
      },
      select: { id: true },
    });

    const liste = await evenements.listerPublics();
    const prochain = await evenements.prochainEvenement();
    const fiche = await evenements.evenementPublic(e.id);

    expect(liste).toHaveLength(1);
    for (const x of [liste[0], prochain, fiche]) {
      expect(x?.organisateur).toBe(DEFAUT);
      expect(occurrences(x, organisateur.email)).toBe(0);
    }
  });

  it("une communauté publique — sujets, messages, fil et collections, lus sans compte", async () => {
    const membre = await sansProfil();
    const communaute = await db.community.create({
      data: {
        creatorId: membre.id,
        name: "Sérigraphes de Dakar",
        slug: "serigraphes-de-dakar",
        description: "Un endroit pour parler de sérigraphie.",
        visibility: "PUBLIC",
        status: "active",
      },
      select: { id: true },
    });
    const categorie = await db.forumCategory.create({
      data: { communityId: communaute.id, name: "Général", slug: "general" },
      select: { id: true },
    });
    const sujet = await db.forumTopic.create({
      data: { categoryId: categorie.id, authorId: membre.id, title: "Quelle encre pour du wax ?" },
      select: { id: true },
    });
    await db.forumPost.create({
      data: { topicId: sujet.id, authorId: membre.id, body: "J'utilise de la plastisol." },
    });
    await db.communityChatMessage.create({
      data: { communityId: communaute.id, authorId: membre.id, body: "Bonjour à tous." },
    });
    await db.board.create({
      data: { ownerId: membre.id, communityId: communaute.id, title: "Références", isPublic: true },
    });

    // `null` : un visiteur sans compte. C'est lui que la propriété protège.
    const ctx = await contexteDe("serigraphes-de-dakar", null);
    expect(ctx).not.toBeNull();

    const sujets = await sujetsDe(ctx!, categorie.id);
    const lu = await sujetAvecMessages(ctx!, sujet.id);
    const fil = await filDe(ctx!);
    const collections = await collectionsDe(ctx!);

    expect(sujets.map((s) => s.auteur)).toEqual([DEFAUT]);
    expect(lu?.messages.map((m) => m.auteur)).toEqual([DEFAUT]);
    expect(fil.map((m) => m.auteur)).toEqual([DEFAUT]);
    expect(collections.map((c) => c.proprietaire)).toEqual([DEFAUT]);
    for (const valeur of [sujets, lu, fil, collections]) {
      expect(occurrences(valeur, membre.email)).toBe(0);
    }
  });
});
