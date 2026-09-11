/**
 * S'inscrire à un événement — contre la vraie base, concurrence comprise.
 *
 * ─────────────────────────────────────────────────────────────────
 * CE QUE CES TESTS GARDENT
 *
 *   — **la dernière place ne se donne pas deux fois.** C'est le seul test de
 *     ce fichier qui ne pouvait pas s'écrire contre un faux : il faut deux
 *     écritures concurrentes sur une vraie ligne PostgreSQL pour que le
 *     verrou ait quelque chose à verrouiller ;
 *   — un double-clic ne mange pas une place : la transaction rend ce qu'elle
 *     avait réservé ;
 *   — se désinscrire rend la place, et permet de se réinscrire — c'est ce que
 *     `EventRegistration` sans colonne d'état achète (§24.6) ;
 *   — le compteur dénormalisé reste d'accord avec le nombre de lignes. Un
 *     compteur qui dérive est une faute qu'on ne voit jamais en lisant le
 *     code.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { desinscrire, estInscrit, inscrire } from "@/lib/evenements/inscription";

let n = 0;

async function personne() {
  n += 1;
  return db.user.create({
    data: { email: `insc-${n}-${Date.now()}@baobart.test` },
    select: { id: true },
  });
}

async function evenement(input: {
  capacite?: number | null;
  etat?: "BROUILLON" | "PUBLIE" | "RETIRE";
  annule?: boolean;
  passe?: boolean;
  prixBillet?: number | null;
} = {}) {
  const organisateur = await personne();
  n += 1;

  const j = 86_400_000;
  const debut = input.passe ? new Date(Date.now() - 10 * j) : new Date(Date.now() + 5 * j);
  const fin = input.passe ? new Date(Date.now() - 9 * j) : new Date(Date.now() + 6 * j);

  return db.event.create({
    data: {
      organizerId: organisateur.id,
      title: `Événement ${n}`,
      kind: "WORKSHOP",
      description: "Un atelier décrit avec assez de mots pour être publiable.",
      startsAt: debut,
      endsAt: fin,
      capacity: input.capacite ?? null,
      state: input.etat ?? "PUBLIE",
      cancelledAt: input.annule ? new Date() : null,
      cancelReason: input.annule ? "La salle est indisponible." : null,
      ticketPrice: input.prixBillet ?? null,
    },
    select: { id: true, capacity: true },
  });
}

/** Le compteur dénormalisé ET le nombre réel de lignes. */
async function comptes(evenementId: string) {
  const [e, lignes] = await Promise.all([
    db.event.findUniqueOrThrow({
      where: { id: evenementId },
      select: { participantsCount: true },
    }),
    db.eventRegistration.count({ where: { eventId: evenementId } }),
  ]);
  return { compteur: e.participantsCount, lignes };
}

beforeEach(() => {
  n = 0;
});

describe("s'inscrire", () => {
  it("écrit la ligne et avance le compteur", async () => {
    const e = await evenement({ capacite: 10 });
    const p = await personne();

    expect(await inscrire({ evenementId: e.id, userId: p.id })).toEqual({ ok: true });

    const c = await comptes(e.id);
    expect(c).toEqual({ compteur: 1, lignes: 1 });
    expect(await estInscrit(e.id, p.id)).toBe(true);
  });

  it("accepte sans plafond", async () => {
    const e = await evenement({ capacite: null });
    const p = await personne();
    expect(await inscrire({ evenementId: e.id, userId: p.id })).toEqual({ ok: true });
  });

  it("refuse deux fois la même personne, sans manger de place", async () => {
    // Le double-clic : la transaction défait la réservation, la place reste
    // disponible pour quelqu'un d'autre.
    const e = await evenement({ capacite: 10 });
    const p = await personne();

    await inscrire({ evenementId: e.id, userId: p.id });
    const second = await inscrire({ evenementId: e.id, userId: p.id });

    expect(second).toEqual({ ok: false, motif: "DEJA_INSCRIT" });
    expect(await comptes(e.id)).toEqual({ compteur: 1, lignes: 1 });
  });

  it("refuse quand le plafond est atteint", async () => {
    const e = await evenement({ capacite: 1 });
    const premier = await personne();
    const second = await personne();

    expect(await inscrire({ evenementId: e.id, userId: premier.id })).toEqual({ ok: true });
    expect(await inscrire({ evenementId: e.id, userId: second.id })).toEqual({
      ok: false,
      motif: "COMPLET",
    });

    expect(await comptes(e.id)).toEqual({ compteur: 1, lignes: 1 });
  });

  it("refuse un brouillon, un retiré, un annulé, un terminé", async () => {
    const cas = [
      { fabrique: () => evenement({ etat: "BROUILLON" }), motif: "INTROUVABLE" },
      { fabrique: () => evenement({ etat: "RETIRE" }), motif: "INTROUVABLE" },
      { fabrique: () => evenement({ annule: true }), motif: "ANNULE" },
      { fabrique: () => evenement({ passe: true }), motif: "TERMINE" },
    ] as const;

    for (const c of cas) {
      const e = await c.fabrique();
      const p = await personne();
      expect(await inscrire({ evenementId: e.id, userId: p.id })).toEqual({
        ok: false,
        motif: c.motif,
      });
      expect(await comptes(e.id)).toEqual({ compteur: 0, lignes: 0 });
    }
  });

  it("refuse un billet payant — l'encaissement n'est pas branché", async () => {
    // Donner des places sans les faire payer serait pire que ne pas en donner.
    const e = await evenement({ prixBillet: 5000 });
    const p = await personne();

    expect(await inscrire({ evenementId: e.id, userId: p.id })).toEqual({
      ok: false,
      motif: "INTROUVABLE",
    });
  });

  it("refuse un événement qui n'existe pas", async () => {
    const p = await personne();
    expect(
      await inscrire({ evenementId: "cl00000000000000000000", userId: p.id }),
    ).toEqual({ ok: false, motif: "INTROUVABLE" });
  });
});

describe("la dernière place, prise par deux personnes en même temps", () => {
  it("n'est attribuée qu'une fois", async () => {
    // ══════════════════════════════════════════════════════════════════════
    // LE TEST QUI JUSTIFIE TOUT LE FICHIER
    //
    // Deux inscriptions lancées SANS `await` entre elles : elles partent
    // ensemble et se disputent la même ligne. Avec un « lire puis écrire »
    // naïf, les deux passeraient — et le compteur afficherait 1 pour
    // 2 inscrits.
    //
    // Ce qu'on vérifie n'est pas qu'une des deux échoue : c'est que le
    // compteur et le nombre de lignes soient **d'accord**, et qu'ils valent
    // exactement la capacité.
    // ══════════════════════════════════════════════════════════════════════
    const e = await evenement({ capacite: 1 });
    const a = await personne();
    const b = await personne();

    const [ra, rb] = await Promise.all([
      inscrire({ evenementId: e.id, userId: a.id }),
      inscrire({ evenementId: e.id, userId: b.id }),
    ]);

    const reussites = [ra, rb].filter((r) => r.ok).length;
    expect(reussites).toBe(1);

    const c = await comptes(e.id);
    expect(c.lignes).toBe(1);
    expect(c.compteur).toBe(1);
  });

  it("ne dépasse jamais la capacité, même à dix candidats pour trois places", async () => {
    const e = await evenement({ capacite: 3 });
    const gens = await Promise.all(Array.from({ length: 10 }, () => personne()));

    const suites = await Promise.all(
      gens.map((p) => inscrire({ evenementId: e.id, userId: p.id })),
    );

    expect(suites.filter((s) => s.ok).length).toBe(3);

    const c = await comptes(e.id);
    expect(c.lignes).toBe(3);
    expect(c.compteur).toBe(3);
  });
});

describe("se désinscrire", () => {
  it("efface la ligne et rend la place", async () => {
    const e = await evenement({ capacite: 5 });
    const p = await personne();

    await inscrire({ evenementId: e.id, userId: p.id });
    expect(await desinscrire({ evenementId: e.id, userId: p.id })).toEqual({ ok: true });

    expect(await comptes(e.id)).toEqual({ compteur: 0, lignes: 0 });
    expect(await estInscrit(e.id, p.id)).toBe(false);
  });

  it("permet de se réinscrire après s'être désisté", async () => {
    // C'est ce que « pas de colonne d'état » achète (§24.6) : une ligne
    // marquée « annulée » aurait buté sur l'unicité (eventId, userId).
    const e = await evenement({ capacite: 5 });
    const p = await personne();

    await inscrire({ evenementId: e.id, userId: p.id });
    await desinscrire({ evenementId: e.id, userId: p.id });

    expect(await inscrire({ evenementId: e.id, userId: p.id })).toEqual({ ok: true });
    expect(await comptes(e.id)).toEqual({ compteur: 1, lignes: 1 });
  });

  it("libère une place que quelqu'un d'autre peut prendre", async () => {
    const e = await evenement({ capacite: 1 });
    const premier = await personne();
    const second = await personne();

    await inscrire({ evenementId: e.id, userId: premier.id });
    expect(await inscrire({ evenementId: e.id, userId: second.id })).toEqual({
      ok: false,
      motif: "COMPLET",
    });

    await desinscrire({ evenementId: e.id, userId: premier.id });
    expect(await inscrire({ evenementId: e.id, userId: second.id })).toEqual({ ok: true });
  });

  it("ne décrémente pas deux fois sur un double clic", async () => {
    const e = await evenement({ capacite: 5 });
    const p = await personne();

    await inscrire({ evenementId: e.id, userId: p.id });
    await desinscrire({ evenementId: e.id, userId: p.id });
    const second = await desinscrire({ evenementId: e.id, userId: p.id });

    expect(second).toEqual({ ok: false, motif: "INTROUVABLE" });
    // Et surtout : le compteur n'est pas descendu à -1.
    expect(await comptes(e.id)).toEqual({ compteur: 0, lignes: 0 });
  });
});
