import "server-only";

import type { PlanCode } from "@prisma/client";

import { db } from "@/lib/db";
import { JOURS_DE_CADENCE, ajouterJours, cycleApresPaiement } from "@/lib/ndank/cycle";

/**
 * La souscription d'un forfait.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUI MANQUAIT
 *
 * Lu le 04/10 : aucun code du site ne créait d'abonnement — seul le script des
 * comptes de test le faisait. Un forfait se renouvelait
 * (`/abonnement/[id]/renouveler`), il ne se souscrivait pas.
 *
 * Décidé le 05/10 : un seul forfait s'ouvre, Accès libre, gratuit, « tout
 * sauf le payant », activé d'un clic sans paiement. Les forfaits payants
 * restent dans la grille, grisés. Le parcours est écrit pour tous —
 * `openForSubscription` et `priceMonthly` décident —, et refuse aujourd'hui ce
 * qui demanderait un paiement : quand un forfait payant s'ouvrira, c'est ce
 * refus qu'on remplacera par l'encaissement.
 */

export type Souscription =
  | { ok: true; abonnementId: string }
  | { ok: false; motif: "INTROUVABLE" | "FERME" | "PAIEMENT_NON_OUVERT" | "DEJA_ABONNE" };

export async function souscrire(input: { userId: string; code: PlanCode; maintenant?: Date }): Promise<Souscription> {
  const maintenant = input.maintenant ?? new Date();
  const plan = await db.plan.findUnique({
    where: { code: input.code },
    select: { id: true, priceMonthly: true, openForSubscription: true },
  });
  if (!plan) return { ok: false, motif: "INTROUVABLE" };
  if (!plan.openForSubscription) return { ok: false, motif: "FERME" };
  if (plan.priceMonthly > 0) return { ok: false, motif: "PAIEMENT_NON_OUVERT" };

  const cycle = cycleApresPaiement(maintenant, "MENSUEL");

  return db.$transaction(async (tx) => {
    // Un verrou par compte : deux clics rapprochés liraient tous deux « aucun
    // abonnement », et le compte en aurait deux.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`souscription:${input.userId}`}))`;

    const enCours = await tx.subscription.findFirst({
      where: { userId: input.userId, status: { in: ["ACTIVE", "PENDING_CANCELLATION"] } },
      select: { id: true },
    });
    if (enCours) return { ok: false, motif: "DEJA_ABONNE" } as const;

    const cree = await tx.subscription.create({
      data: {
        userId: input.userId,
        planId: plan.id,
        status: "ACTIVE",
        cycleStart: cycle.debut,
        cycleEnd: cycle.echeance,
        cadence: "MENSUEL",
      },
      select: { id: true },
    });
    return { ok: true, abonnementId: cree.id } as const;
  });
}

export type Depart = { ok: true } | { ok: false; motif: "AUCUN" | "PAYANT" };

/**
 * Quitter un forfait gratuit : tout de suite, sans échéance à attendre — il
 * n'y a rien de payé à laisser courir. Un forfait payant se résilie par
 * l'écran de renouvellement, qui garde l'accès jusqu'à l'échéance.
 */
export async function quitterForfaitGratuit(userId: string, maintenant: Date = new Date()): Promise<Depart> {
  const actif = await db.subscription.findFirst({
    where: { userId, status: { in: ["ACTIVE", "PENDING_CANCELLATION"] } },
    select: { id: true, plan: { select: { priceMonthly: true } } },
  });
  if (!actif) return { ok: false, motif: "AUCUN" };
  if (actif.plan.priceMonthly > 0) return { ok: false, motif: "PAYANT" };

  await db.subscription.updateMany({
    where: { id: actif.id, status: { in: ["ACTIVE", "PENDING_CANCELLATION"] } },
    data: { status: "CANCELLED", cancelledAt: maintenant },
  });
  return { ok: true };
}

/**
 * Fait avancer le cycle des forfaits gratuits arrivés à échéance.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI UN CYCLE POUR UN FORFAIT SANS PAIEMENT
 *
 * L'état d'un abonnement se déduit de ses dates partout dans le code : le
 * droit de publier un service (`lib/services/qualifications.ts`), le quota,
 * les écrans. Un forfait gratuit sans échéance aurait demandé une exception
 * dans chacun ; un cycle qui avance tout seul n'en demande aucune. Ndank, de
 * son côté, ne lit plus les forfaits gratuits (`aRelancer`) : rien ne relance
 * qui n'a rien à payer.
 *
 * Appelé par le passage quotidien des abonnements, avant Ndank. Un jour sauté
 * ne coûte rien : la boucle rattrape autant de cycles qu'il en faut.
 */
export async function renouvelerLesGratuits(maintenant: Date = new Date()): Promise<number> {
  const echus = await db.subscription.findMany({
    where: { status: "ACTIVE", cycleEnd: { lte: maintenant }, plan: { priceMonthly: 0 } },
    select: { id: true, cycleEnd: true },
    take: 1000,
  });

  let renouveles = 0;
  for (const a of echus) {
    let debut = a.cycleEnd;
    let echeance = ajouterJours(a.cycleEnd, JOURS_DE_CADENCE.MENSUEL);
    while (echeance <= maintenant) {
      debut = echeance;
      echeance = ajouterJours(echeance, JOURS_DE_CADENCE.MENSUEL);
    }
    // Conditionnel sur l'ancienne échéance : deux passages concurrents ne font
    // pas avancer le cycle deux fois.
    const { count } = await db.subscription.updateMany({
      where: { id: a.id, status: "ACTIVE", cycleEnd: a.cycleEnd },
      data: { cycleStart: debut, cycleEnd: echeance },
    });
    renouveles += count;
  }
  return renouveles;
}
