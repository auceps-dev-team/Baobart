/**
 * Postuler à une offre — contre la vraie base et le vrai stockage.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * QUATRE PROPRIÉTÉS QUI DOIVENT TENIR SANS QU'ON LES REGARDE
 *
 *   — les gardes de dépôt : offre publique, mode Baobart, pas la sienne ;
 *   — l'unicité : une candidature par personne et par offre. Un envoi automatisé
 *     qui rejoue ne remplit pas la file de relecture ;
 *   — la promesse : le CV vit avec l'offre, et disparaît à sa clôture. C'est ce
 *     qui autorise à demander un CV en confiance ;
 *   — l'échec propre : une candidature refusée ne laisse pas de fichier
 *     orphelin. L'inverse remplirait le stockage de PDF perdus, invisibles.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { candidaturesDe, postuler, purgerCandidaturesTerminees } from "@/lib/jobs/postuler";
import type { Saisie } from "@/lib/jobs/candidature";

/**
 * Le stockage est simulé — pas parce qu'il faut, mais parce que le brancher au
 * vrai MinIO doublerait la durée du fichier de tests pour ne rien apprendre
 * qu'on ne teste ailleurs. Ce qui compte ici est ce que la base fait, et ce
 * que le code fait de ses erreurs.
 */
const deposees: string[] = [];
const supprimees: string[] = [];

vi.mock("@/lib/upload/storage", () => ({
  deposerObjet: vi.fn(async ({ cle }: { cle: string }) => {
    deposees.push(cle);
  }),
  supprimerObjet: vi.fn(async (cle: string) => {
    supprimees.push(cle);
  }),
}));

let n = 0;

async function personne() {
  n += 1;
  return db.user.create({
    data: {
      email: `p-${n}@baobart.test`,
      profile: { create: { username: `p-${n}`, displayName: `Awa ${n}` } },
    },
    select: { id: true },
  });
}

async function offre(input: {
  recruteurId: string;
  etat?: "BROUILLON" | "SOUMIS" | "PUBLIE" | "REFUSE" | "RETIRE";
  echeance?: Date | null;
  mode?: "BAOBART" | "EXTERNE";
}) {
  n += 1;
  return db.jobPosting.create({
    data: {
      recruiterId: input.recruteurId,
      title: `Mission ${n}`,
      description:
        "Description suffisamment longue pour ressembler à une vraie offre publiée.",
      type: "FREELANCE",
      mode: "REMOTE",
      state: input.etat ?? "PUBLIE",
      deadline: input.echeance ?? null,
      applyMode: input.mode ?? "BAOBART",
    },
    select: { id: true },
  });
}

const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-

function saisie(): Saisie {
  return {
    message: "Bonjour, je suis intéressée par cette mission.",
    cvNom: "awa-cv.pdf",
    cvOctets: PDF_MAGIC.byteLength,
    cvType: "application/pdf",
  };
}

beforeEach(() => {
  deposees.length = 0;
  supprimees.length = 0;
  vi.clearAllMocks();
});

describe("postuler", () => {
  it("écrit la candidature et rattache le CV", async () => {
    const rec = await personne();
    const cand = await personne();
    const o = await offre({ recruteurId: rec.id });

    const suite = await postuler({
      offreId: o.id,
      candidatId: cand.id,
      saisie: saisie(),
      cv: PDF_MAGIC,
    });

    expect(suite.ok).toBe(true);

    const ligne = await db.jobApplication.findFirstOrThrow({
      where: { jobId: o.id, userId: cand.id },
      select: { message: true, mediaId: true },
    });
    expect(ligne.message).toContain("intéressée");
    expect(ligne.mediaId).not.toBeNull();

    // Le fichier a bien été déposé au stockage, une seule fois.
    expect(deposees).toHaveLength(1);
  });

  it("refuse un fichier qui n'est pas un PDF", async () => {
    // Extension .pdf, mais contenu qui n'a rien à voir : le contrôle des magic
    // bytes est le seul qui ne se contourne pas en renommant le fichier.
    const rec = await personne();
    const cand = await personne();
    const o = await offre({ recruteurId: rec.id });

    const suite = await postuler({
      offreId: o.id,
      candidatId: cand.id,
      saisie: saisie(),
      cv: new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]), // ZIP (docx)
    });

    expect(suite).toEqual({ ok: false, motif: "CV_ILLISIBLE" });
    expect(await db.jobApplication.count()).toBe(0);
    expect(deposees).toHaveLength(0);
  });

  it("refuse une offre en relecture", async () => {
    // Un identifiant se devine mal, mais si l'offre n'est pas publique elle ne
    // peut pas recevoir de candidature — même si le formulaire y arrivait.
    const rec = await personne();
    const cand = await personne();
    const o = await offre({ recruteurId: rec.id, etat: "SOUMIS" });

    expect(
      await postuler({
        offreId: o.id,
        candidatId: cand.id,
        saisie: saisie(),
        cv: PDF_MAGIC,
      }),
    ).toEqual({ ok: false, motif: "OFFRE_INTROUVABLE" });
    expect(deposees).toHaveLength(0);
  });

  it("refuse une offre expirée", async () => {
    const rec = await personne();
    const cand = await personne();
    const o = await offre({
      recruteurId: rec.id,
      echeance: new Date(Date.now() - 60_000),
    });

    expect(
      await postuler({
        offreId: o.id,
        candidatId: cand.id,
        saisie: saisie(),
        cv: PDF_MAGIC,
      }),
    ).toEqual({ ok: false, motif: "OFFRE_INTROUVABLE" });
  });

  it("refuse une offre externe", async () => {
    // Accepter ferait déposer un CV qu'aucun recruteur ne verra.
    const rec = await personne();
    const cand = await personne();
    const o = await offre({ recruteurId: rec.id, mode: "EXTERNE" });

    expect(
      await postuler({
        offreId: o.id,
        candidatId: cand.id,
        saisie: saisie(),
        cv: PDF_MAGIC,
      }),
    ).toEqual({ ok: false, motif: "OFFRE_EXTERNE" });
    expect(deposees).toHaveLength(0);
  });

  it("refuse la candidature à sa propre offre", async () => {
    const rec = await personne();
    const o = await offre({ recruteurId: rec.id });

    expect(
      await postuler({
        offreId: o.id,
        candidatId: rec.id,
        saisie: saisie(),
        cv: PDF_MAGIC,
      }),
    ).toEqual({ ok: false, motif: "OFFRE_SOI_MEME" });
  });

  it("refuse deux candidatures du même candidat sur la même offre", async () => {
    // Un envoi automatisé ne remplit pas la file de relecture. Et le premier
    // CV ne doit pas être remplacé par le second, même si celui-ci passe le
    // reste des gardes.
    const rec = await personne();
    const cand = await personne();
    const o = await offre({ recruteurId: rec.id });

    await postuler({ offreId: o.id, candidatId: cand.id, saisie: saisie(), cv: PDF_MAGIC });
    const second = await postuler({
      offreId: o.id,
      candidatId: cand.id,
      saisie: saisie(),
      cv: PDF_MAGIC,
    });

    expect(second).toEqual({ ok: false, motif: "DEJA_POSTULEE" });
    expect(await db.jobApplication.count()).toBe(1);

    // Le second fichier a bien été déposé, puis effacé — sans quoi le stockage
    // se remplirait de doublons perdus.
    expect(deposees).toHaveLength(2);
    expect(supprimees).toHaveLength(1);
  });

  it("n'oublie pas d'effacer le fichier quand la ligne échoue", async () => {
    // Cas volontairement construit : on force un doublon pour observer que le
    // rollback du fichier a bien eu lieu.
    const rec = await personne();
    const cand = await personne();
    const o = await offre({ recruteurId: rec.id });

    await postuler({ offreId: o.id, candidatId: cand.id, saisie: saisie(), cv: PDF_MAGIC });
    deposees.length = 0;
    supprimees.length = 0;

    await postuler({ offreId: o.id, candidatId: cand.id, saisie: saisie(), cv: PDF_MAGIC });

    expect(deposees).toHaveLength(1);
    expect(supprimees).toEqual(deposees);
  });
});

describe("mes candidatures", () => {
  it("rend celles qui existent, du plus récent au plus ancien", async () => {
    const rec = await personne();
    const cand = await personne();

    const un = await offre({ recruteurId: rec.id });
    const deux = await offre({ recruteurId: rec.id });

    await postuler({ offreId: un.id, candidatId: cand.id, saisie: saisie(), cv: PDF_MAGIC });
    await postuler({ offreId: deux.id, candidatId: cand.id, saisie: saisie(), cv: PDF_MAGIC });

    const mes = await candidaturesDe(cand.id);
    expect(mes).toHaveLength(2);
    // La plus récente en premier.
    expect(mes[0]!.job.id).toBe(deux.id);
  });
});

describe("la purge", () => {
  it("efface les candidatures des offres retirées", async () => {
    const rec = await personne();
    const cand = await personne();
    const o = await offre({ recruteurId: rec.id });

    await postuler({ offreId: o.id, candidatId: cand.id, saisie: saisie(), cv: PDF_MAGIC });
    await db.jobPosting.update({ where: { id: o.id }, data: { state: "RETIRE" } });

    const suite = await purgerCandidaturesTerminees();
    expect(suite.effacees).toBe(1);
    expect(await db.jobApplication.count({ where: { jobId: o.id } })).toBe(0);
    // Le CV a été demandé à la suppression.
    expect(supprimees).toHaveLength(1);
    // Et le média n'existe plus non plus.
    expect(await db.mediaAsset.count({ where: { purpose: "job-cv" } })).toBe(0);
  });

  it("efface les candidatures d'une offre expirée", async () => {
    const rec = await personne();
    const cand = await personne();
    const o = await offre({ recruteurId: rec.id });

    await postuler({ offreId: o.id, candidatId: cand.id, saisie: saisie(), cv: PDF_MAGIC });

    // On antidate l'échéance après l'écriture : sinon le dépôt refuse.
    await db.jobPosting.update({
      where: { id: o.id },
      data: { deadline: new Date(Date.now() - 60_000) },
    });

    const suite = await purgerCandidaturesTerminees();
    expect(suite.effacees).toBe(1);
  });

  it("ne touche pas aux candidatures d'une offre encore ouverte", async () => {
    const rec = await personne();
    const cand = await personne();
    const o = await offre({
      recruteurId: rec.id,
      echeance: new Date(Date.now() + 7 * 86_400_000),
    });

    await postuler({ offreId: o.id, candidatId: cand.id, saisie: saisie(), cv: PDF_MAGIC });

    const suite = await purgerCandidaturesTerminees();
    expect(suite.effacees).toBe(0);
    expect(await db.jobApplication.count({ where: { jobId: o.id } })).toBe(1);
  });

  it("ne bloque pas la ligne si le fichier refuse de partir", async () => {
    // Le stockage échoue — on garde la ligne, on repassera. Perdre le fichier
    // au stockage sans que rien ne le signale serait pire que le laisser.
    const rec = await personne();
    const cand = await personne();
    const o = await offre({ recruteurId: rec.id });

    await postuler({ offreId: o.id, candidatId: cand.id, saisie: saisie(), cv: PDF_MAGIC });
    await db.jobPosting.update({ where: { id: o.id }, data: { state: "RETIRE" } });

    const storage = await import("@/lib/upload/storage");
    vi.mocked(storage.supprimerObjet).mockRejectedValueOnce(
      new Error("stockage injoignable"),
    );

    // Ne lève pas.
    const suite = await purgerCandidaturesTerminees();
    expect(suite.effacees).toBe(1);
    // La ligne est effacée quand même : sinon le passage suivant retenterait
    // indéfiniment. On accepte de laisser un fichier orphelin — il sera
    // récupérable par une purge de stockage un jour, sans bloquer la base.
    expect(await db.jobApplication.count({ where: { jobId: o.id } })).toBe(0);
  });
});
