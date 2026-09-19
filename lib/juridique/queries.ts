import "server-only";

import { db } from "@/lib/db";

/**
 * Lire les dossiers juridiques.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX LECTEURS, DEUX VUES, ET PAS LES MÊMES CHAMPS
 *
 * L'administration voit tout : l'identité du notifiant, son domicile, sa date
 * de naissance. Elle en a besoin — c'est ce qui rend la notification recevable,
 * et c'est ce qu'il faudra produire si l'affaire va devant un juge.
 *
 * L'auteur visé, lui, voit **ce qui lui est reproché**, pas qui le lui
 * reproche. La loi n'oblige pas à le lui dire, et le dire exposerait le
 * domicile et la date de naissance d'une personne à celle dont elle conteste
 * le travail. Un litige de droit d'auteur n'a pas à devenir un problème de
 * sécurité physique.
 *
 * C'est pour ça que `dossiersDeLAuteur` ne sélectionne pas les colonnes du
 * notifiant, plutôt que de les lire et de les masquer à l'écran : ce qui n'est
 * jamais chargé ne peut pas fuir par une distraction d'affichage.
 */

export interface LigneDossier {
  reference: string;
  etat: string;
  notifieLe: Date;
  notifiantNom: string;
  notifiantCourriel: string;
  cibleNom: string;
  cibleCompteId: string | null;
  faits: string;
  motifs: string;
  adresses: string[];
  contactPrealable: string;
  contactImpossible: boolean;
  manques: string | null;
  retireLe: Date | null;
  reponseAvantLe: Date | null;
  decideLe: Date | null;
  motifDecision: string | null;
  reponses: number;
}

/** L'ordre de traitement : ce qui attend, le plus ancien d'abord. */
const EN_COURS = ["RECUE", "INCOMPLETE", "RETRAIT_PROVISOIRE", "CONTESTEE"] as const;

export async function dossiersEnCours(limite = 50): Promise<LigneDossier[]> {
  return lire({ state: { in: [...EN_COURS] } }, "asc", limite);
}

export async function dossiersTranches(limite = 30): Promise<LigneDossier[]> {
  return lire(
    { state: { in: ["RETIREE", "RESTAUREE", "CLASSEE"] } },
    "desc",
    limite,
  );
}

export async function dossierPar(reference: string): Promise<LigneDossier | null> {
  const lignes = await lire({ reference }, "asc", 1);
  return lignes[0] ?? null;
}

async function lire(
  where: object,
  sens: "asc" | "desc",
  limite: number,
): Promise<LigneDossier[]> {
  const lignes = await db.legalNotice.findMany({
    where,
    // L'identifiant départage : deux dossiers déposés dans la même
    // milliseconde sortiraient sinon dans un ordre indifférent.
    orderBy: [{ notifiedAt: sens }, { id: sens }],
    take: Math.min(limite, 200),
    select: {
      reference: true,
      state: true,
      notifiedAt: true,
      notifierName: true,
      notifierEmail: true,
      targetName: true,
      targetUserId: true,
      factsDescription: true,
      legalGrounds: true,
      targetUrls: true,
      priorContact: true,
      priorContactUnreachable: true,
      missingElements: true,
      suspendedAt: true,
      replyDueAt: true,
      decidedAt: true,
      decisionReason: true,
      _count: { select: { replies: true } },
    },
  });

  return lignes.map((d) => ({
    reference: d.reference,
    etat: d.state,
    notifieLe: d.notifiedAt,
    notifiantNom: d.notifierName,
    notifiantCourriel: d.notifierEmail,
    cibleNom: d.targetName,
    cibleCompteId: d.targetUserId,
    faits: d.factsDescription,
    motifs: d.legalGrounds,
    adresses: d.targetUrls.split("\n").map((l) => l.trim()).filter(Boolean),
    contactPrealable: d.priorContact,
    contactImpossible: d.priorContactUnreachable,
    manques: d.missingElements,
    retireLe: d.suspendedAt,
    reponseAvantLe: d.replyDueAt,
    decideLe: d.decidedAt,
    motifDecision: d.decisionReason,
    reponses: d._count.replies,
  }));
}

export interface DossierDeLAuteur {
  reference: string;
  etat: string;
  notifieLe: Date;
  /** Le motif du notifiant, tel qu'il l'a écrit. */
  motifs: string;
  faits: string;
  adresses: string[];
  reponseAvantLe: Date | null;
  motifDecision: string | null;
  aRepondu: boolean;
}

/**
 * Les dossiers qui visent cette personne.
 *
 * Aucune colonne du notifiant n'est sélectionnée. Voir l'en-tête : ce qui
 * n'est jamais chargé ne peut pas fuir.
 */
export async function dossiersDeLAuteur(
  userId: string,
): Promise<DossierDeLAuteur[]> {
  const lignes = await db.legalNotice.findMany({
    where: { targetUserId: userId },
    orderBy: [{ notifiedAt: "desc" }, { id: "desc" }],
    take: 50,
    select: {
      reference: true,
      state: true,
      notifiedAt: true,
      legalGrounds: true,
      factsDescription: true,
      targetUrls: true,
      replyDueAt: true,
      decisionReason: true,
      replies: { where: { authorId: userId }, select: { id: true }, take: 1 },
    },
  });

  return lignes.map((d) => ({
    reference: d.reference,
    etat: d.state,
    notifieLe: d.notifiedAt,
    motifs: d.legalGrounds,
    faits: d.factsDescription,
    adresses: d.targetUrls.split("\n").map((l) => l.trim()).filter(Boolean),
    reponseAvantLe: d.replyDueAt,
    motifDecision: d.decisionReason,
    aRepondu: d.replies.length > 0,
  }));
}

export interface ReponseLue {
  id: string;
  corps: string;
  conteste: boolean;
  ecriteLe: Date;
  auteur: string | null;
}

/** Les réponses d'un dossier, pour l'administration. */
export async function reponsesDe(reference: string): Promise<ReponseLue[]> {
  const lignes = await db.legalNoticeReply.findMany({
    where: { notice: { reference } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      contests: true,
      createdAt: true,
      authorId: true,
    },
  });

  if (lignes.length === 0) return [];

  const ids = [...new Set(lignes.map((l) => l.authorId).filter(Boolean))] as string[];
  const auteurs = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true, profile: { select: { displayName: true } } },
  });
  const parId = new Map(
    auteurs.map((a) => [a.id, a.profile?.displayName ?? a.email]),
  );

  return lignes.map((l) => ({
    id: l.id,
    corps: l.body,
    conteste: l.contests,
    ecriteLe: l.createdAt,
    // `null` quand la réponse est arrivée par un autre canal et qu'un
    // administrateur l'a consignée, ou quand le compte a disparu.
    auteur: l.authorId ? (parId.get(l.authorId) ?? null) : null,
  }));
}

export interface IndicateursJuridiques {
  enCours: number;
  incomplets: number;
  retraitsProvisoires: number;
  tranchesSur90Jours: number;
}

/**
 * Les quatre tuiles de l'écran, toutes mesurées.
 *
 * La maquette en dessine quatre sur `a_signalements` : « Dossiers ouverts »,
 * « Retraits provisoires », « Classés sans suite », « Comptes suspendus ».
 * Les trois premières existent maintenant pour de vrai — c'était la promesse
 * que l'écran ne tenait pas.
 */
export async function indicateursJuridiques(): Promise<IndicateursJuridiques> {
  const ilYA90Jours = new Date(Date.now() - 90 * 86_400_000);

  const [enCours, incomplets, retraits, tranches] = await Promise.all([
    db.legalNotice.count({ where: { state: { in: [...EN_COURS] } } }),
    db.legalNotice.count({ where: { state: "INCOMPLETE" } }),
    db.legalNotice.count({ where: { state: "RETRAIT_PROVISOIRE" } }),
    db.legalNotice.count({
      where: {
        decidedAt: { gte: ilYA90Jours },
        state: { in: ["RETIREE", "RESTAUREE", "CLASSEE"] },
      },
    }),
  ]);

  return {
    enCours,
    incomplets,
    retraitsProvisoires: retraits,
    tranchesSur90Jours: tranches,
  };
}
