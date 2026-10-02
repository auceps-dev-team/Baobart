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
 *   — l'audit est écrit APRÈS l'acte, jamais avant ;
 *   — la portée borne CHAQUE écriture : une agence n'écrit que sur les siens,
 *     et ne met jamais rien en ligne elle-même (v1.51.0).
 */

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import type { Portee } from "@/lib/evenements/acces";
import {
  annuler,
  creer,
  modifier,
  retablir,
  trancher,
} from "@/lib/evenements/redaction";
import type { Saisie } from "@/lib/evenements/validation";

/**
 * La portée de l'équipe : aucune contrainte d'organisateur.
 *
 * Chaque écriture en prend une depuis v1.51.0. La déclarer une fois ici garde
 * les tests existants lisibles — ils éprouvent la machine, pas les droits —
 * et laisse le bloc « la portée » plus bas éprouver ce qu'elle borne.
 */
const TOUT: Portee = { etendue: "TOUT" };

/** La portée d'une agence : ses propres événements, et rien d'autre. */
const miens = (moi: string): Portee => ({ etendue: "LES_MIENS", moi });

let n = 0;

async function redacteur() {
  n += 1;
  return db.user.create({
    data: { email: `redac-${n}@baobart.test`, platformRole: "CONTENT_MANAGER" },
    select: { id: true },
  });
}

/** Une agence badgée : un MEMBER ordinaire, côté base. Le badge vit ailleurs. */
async function organisateur() {
  n += 1;
  return db.user.create({
    data: { email: `agence-${n}@baobart.test` },
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
      portee: TOUT,
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
    await modifier({ evenementId: e.id, saisie: saisie({ enLigne: "on" }), portee: TOUT });

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
      portee: TOUT,
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
      portee: TOUT,
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
      await trancher({ evenementId: e.id, geste: "retirer", acteurId: e.auteurId, portee: TOUT }),
    ).toEqual({ ok: true, vers: "RETIRE" });
  });

  it("refuse de publier ce qui est déjà publié", async () => {
    const e = await evenement("PUBLIE");

    expect(
      await trancher({ evenementId: e.id, geste: "publier", acteurId: e.auteurId, portee: TOUT }),
    ).toEqual({ ok: false, motif: "TRANSITION_INTERDITE" });
  });

  it("refuse un geste que la machine n'autorise pas", async () => {
    // « soumettre » n'a pas de sens ici — mais il existe dans le type Geste,
    // et rien n'empêche un appelant de le passer.
    const e = await evenement("PUBLIE");

    expect(
      await trancher({ evenementId: e.id, geste: "soumettre", acteurId: e.auteurId, portee: TOUT }),
    ).toEqual({ ok: false, motif: "TRANSITION_INTERDITE" });
  });

  it("ne laisse pas deux personnes trancher la même fiche", async () => {
    const e = await evenement("BROUILLON");

    await trancher({ evenementId: e.id, geste: "publier", acteurId: e.auteurId, portee: TOUT });
    // La seconde a ouvert son écran avant, elle croit voir un brouillon.
    const seconde = await trancher({
      evenementId: e.id,
      geste: "publier",
      acteurId: e.auteurId,
      portee: TOUT,
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
        portee: TOUT,
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
      portee: TOUT,
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
      await annuler({ evenementId: e.id, raison: "  ", acteurId: e.auteurId, portee: TOUT }),
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
      portee: TOUT,
    });
    const seconde = await annuler({
      evenementId: e.id,
      raison: "Seconde raison, en trop.",
      acteurId: e.auteurId,
      portee: TOUT,
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
      portee: TOUT,
    });

    const suite = await retablir({ evenementId: e.id, acteurId: e.auteurId, portee: TOUT });
    expect(suite.ok).toBe(true);

    const apres = await db.event.findUniqueOrThrow({
      where: { id: e.id },
      select: { cancelledAt: true, cancelReason: true },
    });
    expect(apres.cancelledAt).toBeNull();
    expect(apres.cancelReason).toBeNull();
  });

  it("prévient les inscrits à chaque annulation et à chaque levée", async () => {
    // Mesuré le 25/09 (Qualitytest S6) : trois annulations dans la journée,
    // chacune levée ; seul le premier avis partait, et aucune levée n'était
    // annoncée. Un inscrit qui avait lu « annulé » ne savait jamais que
    // l'événement revenait, ni qu'il était annulé de nouveau.
    const e = await evenement("PUBLIE");
    const inscrit = await organisateur();
    await db.eventRegistration.create({ data: { eventId: e.id, userId: inscrit.id } });
    const avis = (type: string) =>
      db.notification.count({ where: { userId: inscrit.id, type } });

    for (let tour = 1; tour <= 2; tour += 1) {
      await annuler({ evenementId: e.id, raison: `Salle indisponible, tour ${tour}.`, acteurId: e.auteurId, portee: TOUT });
      await retablir({ evenementId: e.id, acteurId: e.auteurId, portee: TOUT });
      expect(await avis("EVENEMENT_ANNULE")).toBe(tour);
      expect(await avis("EVENEMENT_MAINTENU")).toBe(tour);
    }

    const courriels = await db.emailOutbox.count({
      where: { template: { in: ["EVENEMENT_ANNULE", "EVENEMENT_MAINTENU"] } },
    });
    expect(courriels).toBe(4);
  });

  it("refuse de rétablir ce qui n'est pas annulé", async () => {
    const e = await evenement("PUBLIE");
    expect(await retablir({ evenementId: e.id, acteurId: e.auteurId, portee: TOUT })).toEqual({
      ok: false,
      motif: "INTROUVABLE",
    });
  });
});

// ═══════════════════════════════════════════════════════════════════ la portée ══

/**
 * Ce bloc éprouve ce que le module de rédaction refuse **sans rien savoir des
 * badges**.
 *
 * C'est la division du travail : `lib/evenements/garde.ts` décide de la portée
 * en lisant la base, et ce module l'applique. Lui passer une portée forgée est
 * donc exactement ce qu'on veut tester — la garde peut être parfaite, si la
 * clause n'atteint pas le `WHERE`, tout est ouvert.
 */
describe("la portée", () => {
  it("empêche une agence de modifier l'événement d'un autre", async () => {
    const e = await evenement();
    const intrus = await organisateur();

    const suite = await modifier({
      evenementId: e.id,
      saisie: saisie({ titre: "Titre détourné par quelqu'un d'autre" }),
      portee: miens(intrus.id),
    });

    // « Introuvable », et non « pas à toi » : la réponse ne doit pas apprendre
    // que cet identifiant désigne un vrai événement.
    expect(suite).toEqual({ ok: false, motif: "INTROUVABLE" });

    const apres = await db.event.findUniqueOrThrow({
      where: { id: e.id },
      select: { title: true },
    });
    expect(apres.title).toBe("Atelier sérigraphie sur wax");
  });

  it("laisse une agence modifier le sien", async () => {
    const moi = await organisateur();
    const cree = await creer({ auteurId: moi.id, saisie: saisie() });
    if (!cree.ok) throw new Error("création ratée");

    const suite = await modifier({
      evenementId: cree.evenementId,
      saisie: saisie({ capacite: "30" }),
      portee: miens(moi.id),
    });

    expect(suite.ok).toBe(true);
    const apres = await db.event.findUniqueOrThrow({
      where: { id: cree.evenementId },
      select: { capacity: true },
    });
    expect(apres.capacity).toBe(30);
  });

  it("refuse à une agence de publier, même son propre événement", async () => {
    const moi = await organisateur();
    const cree = await creer({ auteurId: moi.id, saisie: saisie() });
    if (!cree.ok) throw new Error("création ratée");

    const suite = await trancher({
      evenementId: cree.evenementId,
      geste: "publier",
      acteurId: moi.id,
      portee: miens(moi.id),
    });

    expect(suite).toEqual({ ok: false, motif: "GESTE_RESERVE" });

    // Et rien n'a bougé en base : le refus est posé AVANT la lecture.
    const apres = await db.event.findUniqueOrThrow({
      where: { id: cree.evenementId },
      select: { state: true },
    });
    expect(apres.state).toBe("BROUILLON");
  });

  it("lui laisse l'envoyer en relecture", async () => {
    const moi = await organisateur();
    const cree = await creer({ auteurId: moi.id, saisie: saisie() });
    if (!cree.ok) throw new Error("création ratée");

    const suite = await trancher({
      evenementId: cree.evenementId,
      geste: "soumettre",
      acteurId: moi.id,
      portee: miens(moi.id),
    });

    expect(suite).toEqual({ ok: true, vers: "SOUMIS" });
  });

  it("répond GESTE_RESERVE avant de dire si l'événement existe", async () => {
    // L'ordre des refus est une garde à lui seul : si l'on testait
    // l'existence d'abord, la différence entre « introuvable » et « réservé »
    // dirait lesquels des identifiants essayés sont réels.
    const intrus = await organisateur();

    const suite = await trancher({
      evenementId: "cl00000000000000000000",
      geste: "publier",
      acteurId: intrus.id,
      portee: miens(intrus.id),
    });

    expect(suite).toEqual({ ok: false, motif: "GESTE_RESERVE" });
  });

  it("empêche une agence d'annuler l'événement d'un autre", async () => {
    const e = await evenement("PUBLIE");
    const intrus = await organisateur();

    const suite = await annuler({
      evenementId: e.id,
      raison: "Sabotage par quelqu'un qui n'organise pas cet événement.",
      acteurId: intrus.id,
      portee: miens(intrus.id),
    });

    expect(suite).toEqual({ ok: false, motif: "INTROUVABLE" });

    const apres = await db.event.findUniqueOrThrow({
      where: { id: e.id },
      select: { cancelledAt: true },
    });
    expect(apres.cancelledAt).toBeNull();
  });

  it("empêche une agence de lever l'annulation d'un autre", async () => {
    const e = await evenement("PUBLIE");
    const proprietaire = e.auteurId;
    await annuler({
      evenementId: e.id,
      raison: "Salle indisponible, report à une date ultérieure.",
      acteurId: proprietaire,
      portee: TOUT,
    });

    const intrus = await organisateur();
    const suite = await retablir({
      evenementId: e.id,
      acteurId: intrus.id,
      portee: miens(intrus.id),
    });

    expect(suite).toEqual({ ok: false, motif: "INTROUVABLE" });

    const apres = await db.event.findUniqueOrThrow({
      where: { id: e.id },
      select: { cancelledAt: true },
    });
    expect(apres.cancelledAt).not.toBeNull();
  });

  it("laisse l'administration agir sur l'événement d'une agence", async () => {
    // L'autre moitié de la règle, et elle compte autant : quelqu'un doit
    // pouvoir relire, publier, et au besoin retirer ce qu'une agence a écrit.
    const moi = await organisateur();
    const cree = await creer({ auteurId: moi.id, saisie: saisie() });
    if (!cree.ok) throw new Error("création ratée");

    const relecteur = await redacteur();
    await trancher({
      evenementId: cree.evenementId,
      geste: "soumettre",
      acteurId: moi.id,
      portee: miens(moi.id),
    });

    const suite = await trancher({
      evenementId: cree.evenementId,
      geste: "publier",
      acteurId: relecteur.id,
      portee: TOUT,
    });

    expect(suite).toEqual({ ok: true, vers: "PUBLIE" });
  });
});

// ══════════════════════════════════════════════════════════════════ le refus ══

/**
 * Un refus sans motif est indéfendable.
 *
 * C'est la règle de Jobs et de Services, et elle pèse davantage ici : une
 * agence qui voit sa fiche disparaître n'a aucun autre canal pour demander
 * pourquoi — il n'y a pas de messagerie dans le produit (§22.6).
 */
describe("refuser", () => {
  /** Un événement écrit par une agence, envoyé en relecture. */
  async function soumis() {
    const moi = await organisateur();
    const cree = await creer({ auteurId: moi.id, saisie: saisie() });
    if (!cree.ok) throw new Error("création ratée");

    const envoi = await trancher({
      evenementId: cree.evenementId,
      geste: "soumettre",
      acteurId: moi.id,
      portee: miens(moi.id),
    });
    if (!envoi.ok) throw new Error("soumission ratée");

    return { id: cree.evenementId, organisateurId: moi.id };
  }

  it("exige un motif, et n'écrit rien sans lui", async () => {
    const e = await soumis();
    const relecteur = await redacteur();

    const suite = await trancher({
      evenementId: e.id,
      geste: "refuser",
      acteurId: relecteur.id,
      portee: TOUT,
      // Cinq caractères, sous le seuil de huit. « trop court » en faisait
      // onze — le test passait pour un refus alors qu'il décrivait un
      // acceptation, et c'est le code qui avait raison.
      motif: "court",
    });

    expect(suite).toEqual({ ok: false, motif: "MOTIF_REQUIS" });

    // L'état n'a pas bougé : le refus du motif intervient AVANT l'écriture.
    const apres = await db.event.findUniqueOrThrow({
      where: { id: e.id },
      select: { state: true, refusedReason: true, moderatedAt: true },
    });
    expect(apres.state).toBe("SOUMIS");
    expect(apres.refusedReason).toBeNull();
    // Rien de relu non plus : envoyer sa fiche en relecture n'est pas la
    // relire. Poser la date sur `soumettre` faisait de l'organisateur le
    // relecteur de son propre travail.
    expect(apres.moderatedAt).toBeNull();
  });

  it("ne marque pas « relu » quand l'auteur envoie ou reprend sa fiche", async () => {
    // Le pendant du test précédent, sur le chemin qui réussit : après une
    // soumission, la fiche attend — personne ne l'a encore lue.
    const e = await soumis();

    const apresSoumission = await db.event.findUniqueOrThrow({
      where: { id: e.id },
      select: { moderatedAt: true, moderatorId: true },
    });
    expect(apresSoumission.moderatedAt).toBeNull();
    expect(apresSoumission.moderatorId).toBeNull();

    // Et après un vrai verdict, la trace est là.
    const relecteur = await redacteur();
    await trancher({
      evenementId: e.id,
      geste: "publier",
      acteurId: relecteur.id,
      portee: TOUT,
    });

    const apresVerdict = await db.event.findUniqueOrThrow({
      where: { id: e.id },
      select: { moderatedAt: true, moderatorId: true },
    });
    expect(apresVerdict.moderatedAt).not.toBeNull();
    expect(apresVerdict.moderatorId).toBe(relecteur.id);
  });

  it("range le motif, l'état et la trace de relecture", async () => {
    const e = await soumis();
    const relecteur = await redacteur();

    const suite = await trancher({
      evenementId: e.id,
      geste: "refuser",
      acteurId: relecteur.id,
      portee: TOUT,
      motif: "La date est déjà passée, et le lieu n'est pas renseigné.",
    });

    expect(suite).toEqual({ ok: true, vers: "REFUSE" });

    const apres = await db.event.findUniqueOrThrow({
      where: { id: e.id },
      select: { state: true, refusedReason: true, moderatorId: true, moderatedAt: true },
    });
    expect(apres.state).toBe("REFUSE");
    expect(apres.refusedReason).toContain("déjà passée");
    expect(apres.moderatorId).toBe(relecteur.id);
    expect(apres.moderatedAt).not.toBeNull();
  });

  it("efface le motif dès qu'une autre décision est prise", async () => {
    // Garder l'ancien ferait afficher « refusée pour X » sur une fiche
    // finalement publiée — le genre de détail qui fait douter de tout l'écran.
    const e = await soumis();
    const relecteur = await redacteur();

    await trancher({
      evenementId: e.id,
      geste: "refuser",
      acteurId: relecteur.id,
      portee: TOUT,
      motif: "Il manque le lieu exact de l'atelier.",
    });

    // L'organisateur reprend sa fiche en brouillon pour la corriger.
    const reprise = await trancher({
      evenementId: e.id,
      geste: "reprendre",
      acteurId: e.organisateurId,
      portee: miens(e.organisateurId),
    });
    expect(reprise).toEqual({ ok: true, vers: "BROUILLON" });

    const apres = await db.event.findUniqueOrThrow({
      where: { id: e.id },
      select: { state: true, refusedReason: true },
    });
    expect(apres.state).toBe("BROUILLON");
    expect(apres.refusedReason).toBeNull();
  });

  it("reste fermé à l'organisateur, motif ou pas", async () => {
    // On ne se refuse pas à soi-même. Et le refus du GESTE passe avant celui
    // du motif : fournir un texte valable ne contourne pas la portée.
    const e = await soumis();

    const suite = await trancher({
      evenementId: e.id,
      geste: "refuser",
      acteurId: e.organisateurId,
      portee: miens(e.organisateurId),
      motif: "Un motif parfaitement valable et assez long.",
    });

    expect(suite).toEqual({ ok: false, motif: "GESTE_RESERVE" });
  });

  it("laisse l'organisateur corriger puis renvoyer", async () => {
    // Le circuit complet : soumis → refusé → brouillon → soumis. C'est ce qui
    // fait que le refus n'est pas une impasse.
    const e = await soumis();
    const relecteur = await redacteur();

    await trancher({
      evenementId: e.id,
      geste: "refuser",
      acteurId: relecteur.id,
      portee: TOUT,
      motif: "La description ne dit pas ce qu'on apprend.",
    });
    await trancher({
      evenementId: e.id,
      geste: "reprendre",
      acteurId: e.organisateurId,
      portee: miens(e.organisateurId),
    });
    await modifier({
      evenementId: e.id,
      saisie: saisie({ description: "Deux jours d'atelier : préparation de l'écran, encres, séchage. On repart avec trois tirages sur tissu, et le matériel est fourni." }),
      portee: miens(e.organisateurId),
    });

    const renvoi = await trancher({
      evenementId: e.id,
      geste: "soumettre",
      acteurId: e.organisateurId,
      portee: miens(e.organisateurId),
    });

    expect(renvoi).toEqual({ ok: true, vers: "SOUMIS" });
  });
});
