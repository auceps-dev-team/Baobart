import "server-only";

import { Prisma } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

import { estPublic } from "@/lib/cms/cycle";
import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";
import { deposerObjet, supprimerObjet } from "@/lib/upload/storage";
import {
  CV_TAILLE_MAX,
  depotAcceptable,
  valider,
  type Refus,
  type Saisie,
} from "@/lib/jobs/candidature";

/**
 * Postuler à une offre d'emploi.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TROIS GARDES QUI DOIVENT TOUTES TENIR
 *
 *   — **l'offre est publique.** État `PUBLIE` ET échéance non passée. Personne
 *     ne postule à un brouillon retrouvé par identifiant, ni à une offre
 *     retirée hier ;
 *   — **elle reçoit les candidatures ici.** `applyMode = BAOBART`. Sur une
 *     offre externe, la candidature part sur le site de l'annonceur ; en
 *     accepter une chez nous ferait déposer un CV qu'aucun recruteur ne verra ;
 *   — **on ne postule pas chez soi.** Une garde par politesse — mais surtout
 *     par cohérence : l'annonceur reçoit alors sa propre alerte, et le
 *     compteur devient absurde.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE CV VIT AVEC L'OFFRE
 *
 * Décision du 2 septembre 2026 : le CV est conservé pendant la durée de
 * l'offre, effacé quand elle se termine — expirée, retirée, ou refusée après
 * publication. C'est ce que fait `purgerCandidaturesTerminees`.
 *
 * Un candidat n'a donc pas à s'inquiéter de laisser traîner son CV : il part
 * en même temps que la mission à laquelle il a répondu. En revanche, il ne peut
 * pas non plus le retirer d'une candidature acceptée : ce n'est pas un espace
 * de stockage, c'est un envoi.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'IDENTIFIANT DU CV NE VIENT PAS DU CANDIDAT
 *
 * Le nom du fichier envoyé est du texte libre — « CV.pdf » ou pire. La clé de
 * stockage est tirée localement : quatorze octets aléatoires, suffisants pour
 * qu'aucune collision ne l'atteigne, et impossible à deviner.
 */

export type EchecPostuler =
  | { motif: "REFUS"; refus: Refus }
  | { motif: "OFFRE_INTROUVABLE" }
  | { motif: "OFFRE_EXTERNE" }
  | { motif: "OFFRE_SOI_MEME" }
  | { motif: "CV_ILLISIBLE" }
  | { motif: "DEJA_POSTULEE" };

export type SuitePostuler =
  | { ok: true; candidatureId: string }
  | ({ ok: false } & EchecPostuler);

/**
 * Enregistre la candidature.
 *
 * Le CV est reçu comme un `Uint8Array` — c'est ce qu'un `File` produit dans une
 * action serveur. On lit les cinq premiers octets, on refuse ce qui n'est pas
 * un PDF, on écrit au stockage privé, puis on écrit la ligne.
 */
export async function postuler(input: {
  offreId: string;
  candidatId: string;
  saisie: Saisie;
  cv: Uint8Array;
}): Promise<SuitePostuler> {
  const v = valider(input.saisie);
  if (!v.ok) return { ok: false, motif: "REFUS", refus: v.refus };

  // Un candidat qui remplirait un formulaire falsifié peut envoyer plus que la
  // taille annoncée. Le vrai contrôle est ici.
  if (input.cv.byteLength === 0 || input.cv.byteLength > CV_TAILLE_MAX) {
    return { ok: false, motif: "CV_ILLISIBLE" };
  }

  if (!depotAcceptable(input.cv.slice(0, 5))) {
    return { ok: false, motif: "CV_ILLISIBLE" };
  }

  const offre = await db.jobPosting.findUnique({
    where: { id: input.offreId },
    select: {
      id: true,
      state: true,
      deadline: true,
      applyMode: true,
      recruiterId: true,
    },
  });

  if (!offre || !estPublic(offre.state, offre.deadline)) {
    return { ok: false, motif: "OFFRE_INTROUVABLE" };
  }

  if (offre.applyMode !== "BAOBART") {
    return { ok: false, motif: "OFFRE_EXTERNE" };
  }

  if (offre.recruiterId === input.candidatId) {
    return { ok: false, motif: "OFFRE_SOI_MEME" };
  }

  // La clé porte l'offre, puis un identifiant tiré ici — impossible à deviner,
  // et suffisamment court pour être lisible dans un journal.
  const cle = `jobs/${offre.id}/cv-${randomBytes(14).toString("base64url")}.pdf`;

  await deposerObjet({ cle, corps: Buffer.from(input.cv), contentType: "application/pdf" });

  const checksum = createHash("sha256").update(input.cv).digest("hex");

  try {
    // Le média est écrit avant la candidature : si celle-ci échoue sur
    // l'unicité, on l'efface juste après. L'inverse laisserait des lignes qui
    // pointent vers du vide.
    const media = await db.mediaAsset.create({
      data: {
        ownerId: input.candidatId,
        purpose: "job-cv",
        s3Key: cle,
        checksum,
        sizeBytes: input.cv.byteLength,
        contentType: "application/pdf",
        status: "READY",
      },
      select: { id: true },
    });

    const candidature = await db.jobApplication.create({
      data: {
        jobId: offre.id,
        userId: input.candidatId,
        message: v.message.length > 0 ? v.message : null,
        mediaId: media.id,
      },
      select: { id: true },
    });

    return { ok: true, candidatureId: candidature.id };
  } catch (cause) {
    // On ne laisse pas de trace matérielle d'un envoi qui n'a pas eu lieu.
    await supprimerObjet(cle).catch(() => {});

    if (
      cause instanceof Prisma.PrismaClientKnownRequestError &&
      cause.code === "P2002"
    ) {
      return { ok: false, motif: "DEJA_POSTULEE" };
    }
    throw cause;
  }
}

export const MESSAGES_ECHEC: Record<EchecPostuler["motif"], string> = {
  REFUS: "",
  OFFRE_INTROUVABLE:
    "Cette offre n'est plus disponible. Elle a peut-être été retirée ou sa clôture est passée.",
  OFFRE_EXTERNE:
    "Les candidatures pour cette mission passent par le site de l'annonceur.",
  OFFRE_SOI_MEME: "On ne postule pas à sa propre offre.",
  CV_ILLISIBLE:
    "Le fichier envoyé n'est pas un PDF valide. Vérifie qu'il s'ouvre bien chez toi.",
  DEJA_POSTULEE: "Tu as déjà postulé à cette offre.",
};

/**
 * Les candidatures qu'une personne a envoyées.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ON N'AFFICHE QUE CE QUI EXISTE ENCORE
 *
 * Une candidature effacée par la purge disparaît d'elle-même. C'est cohérent
 * avec la promesse : le CV vit avec l'offre.
 */
export async function candidaturesDe(candidatId: string) {
  return db.jobApplication.findMany({
    where: { userId: candidatId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      createdAt: true,
      message: true,
      job: {
        select: {
          id: true,
          title: true,
          state: true,
          deadline: true,
          recruiter: {
            select: { profile: { select: { displayName: true } } },
          },
        },
      },
    },
  });
}

/**
 * Les candidatures reçues sur une offre — pour son propre auteur, uniquement.
 *
 * La garde de propriété n'est PAS dans la page ; elle est ici, dans la clause.
 * Un modérateur ou un curieux qui appellerait cette fonction avec l'identifiant
 * d'un autre recruteur ne verrait rien.
 */
export async function candidaturesRecues(input: {
  offreId: string;
  recruteurId: string;
}) {
  return db.jobApplication.findMany({
    where: { jobId: input.offreId, job: { recruiterId: input.recruteurId } },
    orderBy: { createdAt: "asc" },
    take: 500,
    select: {
      id: true,
      createdAt: true,
      message: true,
      mediaId: true,
      user: {
        select: {
          id: true,
          email: true,
          profile: { select: { displayName: true, username: true } },
        },
      },
    },
  });
}

/**
 * Efface les candidatures des offres qui ne recrutent plus.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * QUAND UNE OFFRE SE TERMINE, LES CV S'EN VONT AVEC
 *
 * Trois fins possibles :
 *
 *   — **retirée** par la modération ou son auteur ;
 *   — **refusée** en relecture — les candidatures ne peuvent y arriver que si
 *     l'offre a été publiée puis dégradée, ce qui peut arriver après un signalement ;
 *   — **expirée** — sa clôture est passée.
 *
 * Le passage lit d'abord les candidatures à effacer, retire les fichiers du
 * stockage, puis efface les lignes. L'ordre importe : si le stockage échoue, la
 * ligne reste — on la retrouvera au passage suivant et on réessaiera. L'inverse
 * laisserait des fichiers orphelins que rien ne signalerait.
 */
export async function purgerCandidaturesTerminees(
  maintenant = new Date(),
): Promise<{ effacees: number }> {
  const candidatures = await db.jobApplication.findMany({
    where: {
      OR: [
        { job: { state: { in: ["RETIRE", "REFUSE"] } } },
        {
          job: {
            state: "PUBLIE",
            deadline: { not: null, lte: maintenant },
          },
        },
      ],
    },
    select: { id: true, mediaId: true },
    take: 500,
  });

  if (candidatures.length === 0) return { effacees: 0 };

  // `JobApplication` porte un `mediaId` scalaire, pas une relation Prisma. On
  // relit les médias en un lot pour retrouver leur clé de stockage — une
  // seule requête pour cinq cents lignes, plutôt que cinq cents jointures.
  const mediasIds = candidatures
    .map((c) => c.mediaId)
    .filter((id): id is string => id !== null);

  const medias = mediasIds.length
    ? await db.mediaAsset.findMany({
        where: { id: { in: mediasIds } },
        select: { id: true, s3Key: true },
      })
    : [];

  const cleParMedia = new Map(medias.map((m) => [m.id, m.s3Key]));

  for (const c of candidatures) {
    if (!c.mediaId) continue;
    const cle = cleParMedia.get(c.mediaId);
    if (!cle) continue;

    await supprimerObjet(cle).catch((cause) => {
      // On laisse la ligne : le passage suivant repassera. Perdre le fichier
      // au stockage sans le savoir serait pire.
      journal.avertissement("suppression du CV échouée", {
        candidature: c.id,
        cause: cause instanceof Error ? cause.message : String(cause),
      });
    });
  }

  const aEffacer = candidatures.map((c) => c.id);
  await db.jobApplication.deleteMany({ where: { id: { in: aEffacer } } });

  // Le média est effacé après la candidature qui le référençait — rien ne le
  // retient plus.
  if (mediasIds.length > 0) {
    await db.mediaAsset.deleteMany({ where: { id: { in: mediasIds } } });
  }

  journal.info("candidatures purgées", { effacees: candidatures.length });
  return { effacees: candidatures.length };
}
