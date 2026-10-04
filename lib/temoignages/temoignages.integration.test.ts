/**
 * Les témoignages contre une vraie base : rien ne paraît sans relecture, et
 * personne ne relit le sien.
 */

import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { proposer, temoignagesPublies, trancher } from "@/lib/temoignages/service";

let n = 0;
async function membre(specialite: string | null = null) {
  n += 1;
  return db.user.create({
    data: {
      email: `temoin-${n}-${Math.random().toString(36).slice(2, 7)}@baobart.test`,
      profile: { create: { username: `temoin-${n}-${Math.random().toString(36).slice(2, 7)}`, displayName: `Témoin ${n}`, speciality: specialite } },
    },
    select: { id: true },
  });
}
const idDe = async (auteurId: string) => (await db.testimonial.findUniqueOrThrow({ where: { authorId: auteurId } })).id;

describe("un témoignage", () => {
  it("ne paraît qu'une fois publié, avec le nom de son auteur", async () => {
    const auteur = await membre("Typographe");
    const equipe = await membre();
    await proposer(auteur.id, { body: "J'ai vendu mon premier pack ici.", role: null });

    expect(await temoignagesPublies()).toEqual([]);
    expect(await trancher({ id: await idDe(auteur.id), decision: "PUBLIER", moderateurId: equipe.id })).toMatchObject({ ok: true });

    const [publie] = await temoignagesPublies();
    // Sans présentation saisie, on reprend la spécialité du profil.
    expect(publie).toMatchObject({ texte: "J'ai vendu mon premier pack ici.", nom: `Témoin ${n - 1}`, presentation: "Typographe" });
  });

  it("repart en relecture quand son auteur le corrige", async () => {
    const auteur = await membre();
    const equipe = await membre();
    await proposer(auteur.id, { body: "Première version du texte.", role: null });
    await trancher({ id: await idDe(auteur.id), decision: "PUBLIER", moderateurId: equipe.id });

    await proposer(auteur.id, { body: "Seconde version, jamais relue.", role: null });
    expect(await temoignagesPublies()).toEqual([]);
    expect((await db.testimonial.findUniqueOrThrow({ where: { authorId: auteur.id } })).status).toBe("PENDING");
  });

  it("ne se publie pas soi-même, même administrateur", async () => {
    const admin = await membre();
    await proposer(admin.id, { body: "Je suis à la fois l'auteur et l'équipe.", role: null });
    expect(await trancher({ id: await idDe(admin.id), decision: "PUBLIER", moderateurId: admin.id })).toEqual({
      ok: false,
      motif: "PROPRE_TEMOIGNAGE",
    });
  });

  it("ne se tranche qu'une fois, et se retire avec un motif", async () => {
    const auteur = await membre();
    const a = await membre();
    const b = await membre();
    await proposer(auteur.id, { body: "Deux relecteurs en même temps.", role: null });
    const id = await idDe(auteur.id);

    expect(await trancher({ id, decision: "PUBLIER", moderateurId: a.id })).toMatchObject({ ok: true });
    expect(await trancher({ id, decision: "REFUSER", moderateurId: b.id, motif: "Hors sujet." })).toEqual({ ok: false, motif: "DEJA_TRANCHE" });

    expect(await trancher({ id, decision: "RETIRER", moderateurId: b.id, motif: "L'auteur a demandé le retrait." })).toMatchObject({ ok: true });
    const relu = await db.testimonial.findUniqueOrThrow({ where: { id } });
    expect(relu).toMatchObject({ status: "REJECTED", refusedReason: "L'auteur a demandé le retrait.", publishedAt: null });
  });

  it("disparaît de l'accueil quand son auteur est suspendu", async () => {
    const auteur = await membre();
    const equipe = await membre();
    await proposer(auteur.id, { body: "Avant ma suspension.", role: null });
    await trancher({ id: await idDe(auteur.id), decision: "PUBLIER", moderateurId: equipe.id });
    await db.user.update({ where: { id: auteur.id }, data: { suspendedAt: new Date() } });

    expect(await temoignagesPublies()).toEqual([]);
  });
});
