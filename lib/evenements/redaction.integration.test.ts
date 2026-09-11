/**
 * Écrire un événement — contre la vraie base.
 *
 * ─────────────────────────────────────────────────────────────────
 * CINQ PROPRIÉTÉS QUI DOIVENT TENIR
 *
 *   — un événement naît en `BROUILLON`, jamais publié. C'était le défaut du
 *     schéma d'origine (`status` valait `"upcoming"`), et c'est ce qui
 *     mettait en ligne des textes à moitié rédigés ;
 *   — `BROUILLON → PUBLIE` existe sans passer par une file : §18.1, l'auteur
 *     porte déjà le droit de publier ;
 *   — deux personnes sur la même fiche : seule la première tranche ;
 *   — annuler ne retire pas. L'état reste `PUBLIE`, la fiche reste lisible,
 *     et la raison est là pour les inscrits ;
 *   — l'audit est écrit APRÈS l'acte, jamais avant.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  annuler,
  creer,
  modifier,
  retablir,
  trancher,
} from "@/lib/evenements/redaction";
import type { Saisie } from "@/lib/evenements/validation";

let n = 0;

async function redacteur() {
  n += 1;
  return db.user.create({
    data: { email: `redac-${n}@baobart.test`, platformRole: "CONTENT_MANAGER" },
    select: { id: true },
  });
}

function saisie(over: Partial<Saisie> = {}): Saisie {
  return {
    titre: "Atelier sérigraphie sur wax",
    description:
      "Deux jours pour apprendre à imprimer sur tissu : préparation de l'écran, encres, séchage. Matériel fourni, douze places.",
    genre: "WORKSHOP",
    debut: "2026-10-10T14:00",
    fin: "2026-10-11T18:00",
    lieu: "Abidjan, Cocody",
    enLigne: "",
    capacite: "12",
    prixBillet: "",
    dotation: "",
    ...over,
  };
}

/** Crée un événement et le laisse dans l'état demandé. */
async function evenement(etat: "BROUILLON" | "PUBLIE" | "RETIRE" = "BROUILLON") {
  const auteur = await redacteur();
  const suite = await creer({ auteurId: auteur.id, saisie: saisie() });
  if (!suite.ok) throw new Error("création ratée dans le montage du test");

  if (etat !== "BROUILLON") {
    await db.event.update({ where: { id: suite.evenementId }, data: { state: etat } });
  }
  return { id: suite.evenementId, auteurId: auteur.id };
}

beforeEach(() => {
  n = 0;
});

describe("créer", () => {
  it("naît en BROUILLON, jamais publié", async () => {
    const auteur = await redacteur();
    const suite = await creer({ auteurId: auteur.id, saisie: saisie() });

    expect(suite.ok).toBe(true);
    if (!suite.ok) return;

    const e = await db.event.findUniqueOrThrow({
      where: { id: suite.evenementId },
      select: {
        state: true,
        title: true,
        organizerId: true,
        startsAt: true,
        capacity: true,
        isOnline: true,
        location: true,
        ticketPrice: true,
      },
    });

    expect(e.state).toBe("BROUILLON");
    expect(e.organizerId).toBe(auteur.id);
    expect(e.capacity).toBe(12);
    expect(e.isOnline).toBe(false);
    expect(e.location).toBe("Abidjan, Cocody");
    // Gratuit : rangé `null`, jamais zéro.
    expect(e.ticketPrice).toBeNull();
    // L'heure est lue en GMT — voir l'en-tête de la validation.
    expect(e.startsAt.toISOString()).toBe("2026-10-10T14:00:00.000Z");
  });

  it("refuse une saisie invalide et n'écrit rien", async () => {
    const auteur = await redacteur();
    const suite = await creer({
      auteurId: auteur.id,
      saisie: saisie({ fin: "2026-10-09T10:00" }),
    });

    expect(suite.ok).toBe(false);
    if (suite.ok) return;
    expect(suite.motif).toBe("REFUS");
    expect(await db.event.count()).toBe(0);
  });
});

describe("modifier", () => {
  it("écrit les nouvelles valeurs", async () => {
    const e = await evenement();

    const suite = await modifier({
      evenementId: e.id,
      saisie: saisie({ titre: "Atelier sérigraphie — deuxième édition", capacite: "20" }),
    });

    expect(suite.ok).toBe(true);
    const apres = await db.event.findUniqueOrThrow({
      where: { id: e.id },
      select: { title: true, capacity: true },
    });
    expect(apres.title).toContain("deuxième");
    expect(apres.capacity).toBe(20);
  });

  it("efface le lieu quand l'événement passe en ligne", async () => {
    // Sinon la fiche annonce une adresse ET un lien.
    const e = await evenement();
    await modifier({ evenementId: e.id, saisie: saisie({ enLigne: "on" }) });

    const apres = await db.event.findUniqueOrThrow({
      where: { id: e.id },
      select: { isOnline: true, location: true },
    });
    expect(apres.isOnline).toBe(true);
    expect(apres.location).toBeNull();
  });

  it("refuse un événement qui n'existe plus", async () => {
    const suite = await modifier({
      evenementId: "cl00000000000000000000",
      saisie: saisie(),
    });
    expect(suite).toEqual({ ok: false, motif: "INTROUVABLE" });
  });
});

describe("trancher", () => {
  it("publie un brouillon sans passer par une file", async () => {
    const e = await evenement("BROUILLON");

    const suite = await trancher({
      evenementId: e.id,
      geste: "publier",
      acteurId: e.auteurId,
    });

    expect(suite).toEqual({ ok: true, vers: "PUBLIE" });

    const trace = await db.auditLog.findFirst({
      where: { actorId: e.auteurId, resource: `evenement:${e.id}` },
    });
    expect(trace?.action).toBe("contenu.publier");
  });

  it("retire un événement publié", async () => {
    const e = await evenement("PUBLIE");

    expect(
      await trancher({ evenementId: e.id, geste: "retirer", acteurId: e.auteurId }),
    ).toEqual({ ok: true, vers: "RETIRE" });
  });

  it("refuse de publier ce qui est déjà publié", async () => {
    const e = await evenement("PUBLIE");

    expect(
      await trancher({ evenementId: e.id, geste: "publier", acteurId: e.auteurId }),
    ).toEqual({ ok: false, motif: "TRANSITION_INTERDITE" });
  });

  it("refuse un geste que la machine n'autorise pas", async () => {
    // « soumettre » n'a pas de sens ici — mais il existe dans le type Geste,
    // et rien n'empêche un appelant de le passer.
    const e = await evenement("PUBLIE");

    expect(
      await trancher({ evenementId: e.id, geste: "soumettre", acteurId: e.auteurId }),
    ).toEqual({ ok: false, motif: "TRANSITION_INTERDITE" });
  });

  it("ne laisse pas deux personnes trancher la même fiche", async () => {
    const e = await evenement("BROUILLON");

    await trancher({ evenementId: e.id, geste: "publier", acteurId: e.auteurId });
    // La seconde a ouvert son écran avant, elle croit voir un brouillon.
    const seconde = await trancher({
      evenementId: e.id,
      geste: "publier",
      acteurId: e.auteurId,
    });

    expect(seconde).toEqual({ ok: false, motif: "TRANSITION_INTERDITE" });
  });

  it("refuse un événement introuvable", async () => {
    const auteur = await redacteur();
    expect(
      await trancher({
        evenementId: "cl00000000000000000000",
        geste: "publier",
        acteurId: auteur.id,
      }),
    ).toEqual({ ok: false, motif: "INTROUVABLE" });
  });
});

describe("annuler", () => {
  it("pose la date et la raison SANS retirer la fiche", async () => {
    // C'est toute la décision : un annulé reste lisible pour ses inscrits.
    const e = await evenement("PUBLIE");

    const suite = await annuler({
      evenementId: e.id,
      raison: "La salle est inondée, on reprogramme en novembre.",
      acteurId: e.auteurId,
    });

    expect(suite.ok).toBe(true);

    const apres = await db.event.findUniqueOrThrow({
      where: { id: e.id },
      select: { state: true, cancelledAt: true, cancelReason: true },
    });

    expect(apres.state).toBe("PUBLIE");
    expect(apres.cancelledAt).not.toBeNull();
    expect(apres.cancelReason).toContain("inondée");
  });

  it("refuse sans raison", async () => {
    const e = await evenement("PUBLIE");

    expect(
      await annuler({ evenementId: e.id, raison: "  ", acteurId: e.auteurId }),
    ).toEqual({ ok: false, motif: "RAISON_REQUISE" });

    const apres = await db.event.findUniqueOrThrow({
      where: { id: e.id },
      select: { cancelledAt: true },
    });
    expect(apres.cancelledAt).toBeNull();
    expect(await db.auditLog.count()).toBe(0);
  });

  it("n'écrase pas la première raison par une seconde annulation", async () => {
    const e = await evenement("PUBLIE");

    await annuler({
      evenementId: e.id,
      raison: "Première raison, la vraie.",
      acteurId: e.auteurId,
    });
    const seconde = await annuler({
      evenementId: e.id,
      raison: "Seconde raison, en trop.",
      acteurId: e.auteurId,
    });

    expect(seconde).toEqual({ ok: false, motif: "DEJA_ANNULE" });

    const apres = await db.event.findUniqueOrThrow({
      where: { id: e.id },
      select: { cancelReason: true },
    });
    expect(apres.cancelReason).toContain("Première");
  });
});

describe("rétablir", () => {
  it("lève l'annulation et efface la raison avec elle", async () => {
    // Sinon la fiche afficherait « annulé pour X » sur un événement qui a lieu.
    const e = await evenement("PUBLIE");
    await annuler({
      evenementId: e.id,
      raison: "Annulation posée par erreur.",
      acteurId: e.auteurId,
    });

    const suite = await retablir({ evenementId: e.id, acteurId: e.auteurId });
    expect(suite.ok).toBe(true);

    const apres = await db.event.findUniqueOrThrow({
      where: { id: e.id },
      select: { cancelledAt: true, cancelReason: true },
    });
    expect(apres.cancelledAt).toBeNull();
    expect(apres.cancelReason).toBeNull();
  });

  it("refuse de rétablir ce qui n'est pas annulé", async () => {
    const e = await evenement("PUBLIE");
    expect(await retablir({ evenementId: e.id, acteurId: e.auteurId })).toEqual({
      ok: false,
      motif: "INTROUVABLE",
    });
  });
});
