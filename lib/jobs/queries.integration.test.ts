/**
 * Ce que le public voit des offres, contre la vraie base.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE SEULE PROPRIÉTÉ, ET ELLE VAUT TOUT LE FICHIER
 *
 * **Rien qui ne soit publié et non expiré ne doit sortir d'ici.** Jobs est
 * ouvert à tout inscrit et lu sans compte : une offre en relecture qui fuirait
 * mettrait en ligne une annonce que personne n'a lue — exactement ce que la
 * modération existe pour empêcher.
 *
 * Les deux conditions sont testées séparément ET ensemble, parce que le défaut
 * classique est d'en appliquer une et d'oublier l'autre.
 */

import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { joursAvantCloture, listerOffres, offrePublique } from "@/lib/jobs/queries";

let n = 0;

async function recruteur() {
  n += 1;
  return db.user.create({
    data: {
      email: `rec-${n}@baobart.test`,
      profile: { create: { username: `rec-${n}`, displayName: `Studio ${n}` } },
    },
    select: { id: true },
  });
}

async function offre(options: {
  etat?: "BROUILLON" | "SOUMIS" | "PUBLIE" | "REFUSE" | "RETIRE";
  echeance?: Date | null;
  enAvant?: boolean;
  verifiee?: boolean;
  creeeLe?: Date;
  url?: string;
}) {
  n += 1;
  const auteur = await recruteur();

  return db.jobPosting.create({
    data: {
      recruiterId: auteur.id,
      title: `Mission ${n}`,
      description:
        "Une description assez longue pour ressembler à une vraie offre d'emploi publiée sur la plateforme.",
      type: "FREELANCE",
      mode: "REMOTE",
      state: options.etat ?? "PUBLIE",
      deadline: options.echeance ?? null,
      isFeatured: options.enAvant ?? false,
      isVerified: options.verifiee ?? false,
      createdAt: options.creeeLe ?? new Date(),
      applyMode: options.url ? "EXTERNE" : "BAOBART",
      applyUrl: options.url ?? null,
    },
    select: { id: true },
  });
}

describe("ce qui sort au public", () => {
  it("ne montre que les offres publiées", async () => {
    // La garde qui compte : une offre en relecture n'a été lue par personne.
    for (const etat of ["BROUILLON", "SOUMIS", "REFUSE", "RETIRE"] as const) {
      await offre({ etat });
    }
    const visible = await offre({ etat: "PUBLIE" });

    const liste = await listerOffres();
    expect(liste).toHaveLength(1);
    expect(liste[0]!.id).toBe(visible.id);
  });

  it("écarte les offres dont l'échéance est passée", async () => {
    // Un annuaire d'offres périmées se vide de ses lecteurs plus vite qu'il ne
    // se remplit.
    await offre({ echeance: new Date(Date.now() - 60_000) });
    const vivante = await offre({
      echeance: new Date(Date.now() + 7 * 86_400_000),
    });

    const liste = await listerOffres();
    expect(liste).toHaveLength(1);
    expect(liste[0]!.id).toBe(vivante.id);
  });

  it("garde celles qui n'ont pas d'échéance", async () => {
    await offre({ echeance: null });
    expect(await listerOffres()).toHaveLength(1);
  });

  it("bascule exactement à l'échéance", async () => {
    // La seconde qui compte : une offre visible à 23 h 59 et 59 s ne doit plus
    // l'être à minuit pile.
    const echeance = new Date("2026-10-31T23:59:59.999Z");
    await offre({ echeance });

    expect(
      await listerOffres({ maintenant: new Date(echeance.getTime() - 1) }),
    ).toHaveLength(1);
    expect(
      await listerOffres({ maintenant: new Date(echeance.getTime() + 1) }),
    ).toHaveLength(0);
  });

  it("applique les deux conditions ensemble", async () => {
    // Le défaut classique : filtrer l'état et oublier l'échéance, ou l'inverse.
    await offre({ etat: "SOUMIS", echeance: new Date(Date.now() + 86_400_000) });
    await offre({ etat: "PUBLIE", echeance: new Date(Date.now() - 86_400_000) });

    expect(await listerOffres()).toHaveLength(0);
  });
});

describe("l'ordre", () => {
  it("met les offres payantes devant, puis les plus récentes", async () => {
    // La place payante passe devant, et c'est assumé — mais à égalité c'est la
    // fraîcheur qui décide. Un annuaire où l'argent seul ordonne cesse d'être
    // consulté, et la place payante ne vaut alors plus rien.
    const vieille = await offre({ creeeLe: new Date(Date.now() - 5 * 86_400_000) });
    const recente = await offre({ creeeLe: new Date() });
    const payante = await offre({
      creeeLe: new Date(Date.now() - 10 * 86_400_000),
      enAvant: true,
    });

    const liste = await listerOffres();
    expect(liste.map((o) => o.id)).toEqual([payante.id, recente.id, vieille.id]);
  });

  it("marque comme nouvelles celles de moins de trois jours", async () => {
    await offre({ creeeLe: new Date(Date.now() - 10 * 86_400_000) });
    await offre({ creeeLe: new Date() });

    const liste = await listerOffres();
    const nouvelles = liste.filter((o) => o.nouvelle);
    expect(nouvelles).toHaveLength(1);
  });
});

describe("la fiche", () => {
  it("rend l'offre complète quand elle est visible", async () => {
    const o = await offre({ verifiee: true, url: "https://recruteur.africa/42" });

    const fiche = await offrePublique(o.id);
    expect(fiche).not.toBeNull();
    expect(fiche!.verifiee).toBe(true);
    expect(fiche!.commentPostuler).toBe("EXTERNE");
    expect(fiche!.urlExterne).toContain("recruteur.africa");
    expect(fiche!.description.length).toBeGreaterThan(fiche!.extrait.length - 1);
  });

  it("rend null sur tout ce qui n'est pas public", async () => {
    // Un identifiant se devine mal, mais il se partage : un lien envoyé avant
    // un refus ne doit pas continuer de montrer l'offre.
    for (const etat of ["BROUILLON", "SOUMIS", "REFUSE", "RETIRE"] as const) {
      const o = await offre({ etat });
      expect(await offrePublique(o.id)).toBeNull();
    }

    const perimee = await offre({ echeance: new Date(Date.now() - 60_000) });
    expect(await offrePublique(perimee.id)).toBeNull();

    expect(await offrePublique("cet-identifiant-n-existe-pas")).toBeNull();
  });

  it("nomme le recruteur et donne son adresse de profil", async () => {
    const o = await offre({});
    const fiche = await offrePublique(o.id);

    expect(fiche!.recruteur).toContain("Studio");
    expect(fiche!.recruteurUsername).toContain("rec-");
  });
});

describe("les jours avant clôture", () => {
  it("compte, ou rend null quand il n'y a rien à compter", () => {
    const maintenant = new Date("2026-09-02T12:00:00Z");

    expect(joursAvantCloture(null, maintenant)).toBeNull();
    expect(
      joursAvantCloture(new Date("2026-09-05T23:59:59Z"), maintenant),
    ).toBe(4);
    // Une échéance passée ne rend pas un nombre négatif : l'offre n'est plus
    // visible, et « clôture dans -3 jours » n'a aucun sens.
    expect(
      joursAvantCloture(new Date("2026-08-30T12:00:00Z"), maintenant),
    ).toBeNull();
  });
});
