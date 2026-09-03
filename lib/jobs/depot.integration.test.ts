/**
 * Le dépôt d'une offre, contre la vraie base.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE SEULE PROPRIÉTÉ COMPTE VRAIMENT ICI
 *
 * **Rien ne paraît sans avoir été lu.** Jobs est ouvert à tout inscrit, et un
 * compte se crée en deux minutes : l'authentification donne quelqu'un à qui
 * imputer une arnaque, elle ne l'empêche pas. Si une offre déposée pouvait être
 * publique, la première arnaque serait en ligne avant qu'on l'ait ouverte.
 *
 * Le schéma portait exactement ce défaut avant J1 : `status` valait
 * « published » par défaut.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { estPublic } from "@/lib/cms/cycle";
import { db } from "@/lib/db";
import { deposerUneOffre } from "@/lib/jobs/depot";
import type { Saisie } from "@/lib/jobs/validation";

const AVANT = { ...process.env };

beforeEach(() => {
  process.env = { ...AVANT, APP_URL: "https://baobart.test" };
});

let n = 0;

async function inscrit() {
  n += 1;
  return db.user.create({
    data: {
      email: `job-${n}@baobart.test`,
      profile: { create: { username: `job-${n}`, displayName: `Awa ${n}` } },
    },
    select: { id: true },
  });
}

function saisie(p: Partial<Saisie> = {}): Saisie {
  return {
    titre: `Illustrateur jeunesse ${n}`,
    description:
      "Nous cherchons quelqu'un pour illustrer une collection de six albums " +
      "jeunesse, par lots de deux, avec un aller-retour de relecture.",
    type: "FREELANCE",
    mode: "REMOTE",
    pays: "CI",
    ville: "Abidjan",
    salaireMin: "300000",
    salaireMax: "500000",
    echeance: "",
    commentPostuler: "BAOBART",
    urlExterne: "",
    ...p,
  };
}

describe("déposer", () => {
  it("écrit l'offre en relecture, jamais en ligne", async () => {
    const qui = await inscrit();

    const suite = await deposerUneOffre({ auteurId: qui.id, saisie: saisie() });
    expect(suite.ok).toBe(true);
    if (!suite.ok) return;

    const offre = await db.jobPosting.findUniqueOrThrow({
      where: { id: suite.offreId },
      select: { state: true, deadline: true, recruiterId: true },
    });

    expect(offre.state).toBe("SOUMIS");
    // Et la seule porte de visibilité le confirme : personne ne la voit.
    expect(estPublic(offre.state, offre.deadline)).toBe(false);
    expect(offre.recruiterId).toBe(qui.id);
  });

  it("range la fin du jour pour l'échéance", async () => {
    const qui = await inscrit();
    const dans30 = new Date(Date.now() + 30 * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const suite = await deposerUneOffre({
      auteurId: qui.id,
      saisie: saisie({ echeance: dans30 }),
    });
    if (!suite.ok) throw new Error("refusée");

    const offre = await db.jobPosting.findUniqueOrThrow({
      where: { id: suite.offreId },
      select: { deadline: true },
    });
    // « Jusqu'au 31 » veut dire que le 31 compte encore.
    expect(offre.deadline?.toISOString()).toBe(`${dans30}T23:59:59.999Z`);
  });

  it("refuse une adresse externe qui renvoie chez nous", async () => {
    // Une offre « externe » qui pointe sur Baobart emprunte notre nom pour
    // rassurer un candidat.
    const qui = await inscrit();

    const suite = await deposerUneOffre({
      auteurId: qui.id,
      saisie: saisie({
        commentPostuler: "EXTERNE",
        urlExterne: "https://baobart.test/jobs/42",
      }),
    });

    expect(suite).toEqual({ ok: false, motif: "URL_INTERNE" });
    expect(await db.jobPosting.count()).toBe(0);
  });

  it("accepte une vraie adresse externe", async () => {
    const qui = await inscrit();
    const suite = await deposerUneOffre({
      auteurId: qui.id,
      saisie: saisie({
        commentPostuler: "EXTERNE",
        urlExterne: "https://recruteur.africa/offres/42",
      }),
    });
    if (!suite.ok) throw new Error("refusée");

    const offre = await db.jobPosting.findUniqueOrThrow({
      where: { id: suite.offreId },
      select: { applyMode: true, applyUrl: true },
    });
    expect(offre.applyMode).toBe("EXTERNE");
    expect(offre.applyUrl).toContain("recruteur.africa");
  });

  it("arrête un double envoi du même formulaire", async () => {
    // Ce n'est pas la limitation de débit : c'est l'impatience, un clic répété
    // qui produirait deux lignes à relire pour une seule offre.
    const qui = await inscrit();
    const s = saisie();

    const un = await deposerUneOffre({ auteurId: qui.id, saisie: s });
    const deux = await deposerUneOffre({ auteurId: qui.id, saisie: s });

    expect(un.ok).toBe(true);
    expect(deux).toEqual({ ok: false, motif: "DOUBLON" });
    expect(await db.jobPosting.count()).toBe(1);
  });

  it("laisse deux personnes déposer le même intitulé", async () => {
    // La garde anti-doublon porte sur l'auteur : deux studios peuvent chercher
    // le même profil le même jour.
    const un = await inscrit();
    const deux = await inscrit();
    const s = saisie();

    expect((await deposerUneOffre({ auteurId: un.id, saisie: s })).ok).toBe(true);
    expect((await deposerUneOffre({ auteurId: deux.id, saisie: s })).ok).toBe(true);
    expect(await db.jobPosting.count()).toBe(2);
  });

  it("n'écrit rien quand la saisie est refusée", async () => {
    const qui = await inscrit();
    const suite = await deposerUneOffre({
      auteurId: qui.id,
      saisie: saisie({ description: "Recrute, WhatsApp." }),
    });

    expect(suite.ok).toBe(false);
    expect(await db.jobPosting.count()).toBe(0);
  });

  it("emporte les offres d'un compte supprimé", async () => {
    // Suspendre puis supprimer un compte de spam doit emporter ses offres :
    // les laisser derrière ferait paraître le travail d'un compte disparu.
    const qui = await inscrit();
    await deposerUneOffre({ auteurId: qui.id, saisie: saisie() });

    await db.user.delete({ where: { id: qui.id } });

    expect(await db.jobPosting.count()).toBe(0);
  });
});

describe("les listes recopiées du schéma", () => {
  it("couvrent exactement les valeurs que Prisma connaît", async () => {
    // `lib/jobs/enums.ts` recopie les enums pour rester pur. Une valeur ajoutée
    // au schéma et oubliée là-bas serait refusée par la validation sans
    // qu'aucune erreur ne le dise.
    const { MODES, POSTULER, TYPES } = await import("@/lib/jobs/enums");
    const { JobType, JobMode, ApplyMode } = await import("@prisma/client");

    expect([...TYPES].sort()).toEqual(Object.values(JobType).sort());
    expect([...MODES].sort()).toEqual(Object.values(JobMode).sort());
    expect([...POSTULER].sort()).toEqual(Object.values(ApplyMode).sort());
  });
});
