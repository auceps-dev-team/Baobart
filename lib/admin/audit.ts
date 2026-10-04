import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";

/**
 * Qui a fait quoi, dans le back-office.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA TABLE EXISTAIT, ET PERSONNE N'Y ÉCRIVAIT
 *
 * `AuditLog` est au schéma depuis le début du projet. Aucun appel ne l'a jamais
 * remplie. C'est le pire état possible : un écran d'audit aurait affiché une
 * liste vide, et vide se lit « rien ne s'est passé » — pas « on ne consigne
 * rien ». Une traçabilité qui ment est pire qu'une traçabilité absente.
 *
 * `SPEC_ADMIN_CMS_BAOBART.md` en fait son principe n° 2 : *tout est audité*.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CONSIGNER NE DOIT JAMAIS FAIRE ÉCHOUER L'ACTE
 *
 * Un administrateur qui suspend un compte frauduleux ne doit pas voir son geste
 * refusé parce que l'écriture d'audit a échoué. On consigne donc **après**, hors
 * transaction, et l'échec se journalise au lieu de remonter.
 *
 * Le revers est assumé : une trace peut manquer. C'est le bon compromis pour un
 * journal de consultation — l'inverse (bloquer l'acte) transformerait un
 * incident de base en panne d'exploitation.
 *
 * ⚠️ Ce raisonnement ne vaut PAS pour les écritures qui portent de l'argent.
 * `RiskStateChange` et le grand livre s'écrivent dans la transaction de leur
 * acte, et doivent y rester.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON N'Y MET PAS DE SECRET
 *
 * Le détail est du JSON libre, lisible par tout porteur de `consulter_l_audit`.
 * Les jetons, mots de passe, clés d'opérateur et références de compte complètes
 * n'y ont rien à faire : un journal d'audit est fait pour être relu longtemps,
 * par des gens qui n'étaient pas là.
 */

/**
 * Ce qu'un administrateur peut faire, nommé une fois pour toutes.
 *
 * Une union plutôt qu'une chaîne libre : deux orthographes de la même action
 * rendraient l'audit inutilisable au moment précis où l'on cherche à savoir
 * combien de fois elle a eu lieu.
 */
export type ActionAdmin =
  | "role.promouvoir"
  | "role.revoquer"
  | "compte.suspendre"
  | "compte.retablir"
  | "risque.changer"
  | "versement.rejouer"
  | "versement.annuler"
  | "courriel.rejouer"
  | "courriel.abandonner"
  | "commande.rembourser"
  | "paiement.rejouer"
  | "contenu.publier"
  | "contenu.retirer"
  | "contenu.approuver"
  | "contenu.refuser"
  // Liste de blocage (§3.6). Deux actions et non une : lever un blocage est
  // un geste distinct de le poser, et c'est celui qu'on cherche quand on
  // relit « qui a rouvert la porte à cette adresse ».
  | "blocage.poser"
  | "blocage.lever"
  // ADS manager. La pause et la reprise sont deux actions pour la même raison
  // que le blocage : c'est la reprise qu'on cherche quand une bannière
  // reparaît sans que personne s'en souvienne.
  | "publicite.creer"
  | "publicite.modifier"
  | "publicite.suspendre"
  | "publicite.reprendre"
  | "publicite.archiver"
  | "publicite.restaurer"
  // Plus émise depuis v1.71.1 : l'écran archive au lieu de supprimer. Gardée
  // pour relire les traces d'avant.
  | "publicite.supprimer"
  | "publicite.regler"
  // Témoignages (04/10). Retirer un témoignage publié est un geste à part :
  // c'est lui qu'on cherche quand un avis disparaît de l'accueil.
  | "temoignage.publier"
  | "temoignage.refuser"
  | "temoignage.retirer";

export interface Trace {
  /** L'administrateur qui a agi. Jamais « le système ». */
  acteurId: string;
  action: ActionAdmin;
  /**
   * Sur quoi : « user:clx… », « payout:clx… », « order:clx… ».
   *
   * Préfixé par type, parce qu'un identifiant nu ne dit pas de quelle table il
   * vient — et qu'on cherche souvent « tout ce qui a touché ce compte ».
   */
  ressource: string;
  /** Le contexte utile à quelqu'un qui relira dans six mois. Sans secret. */
  details?: Record<string, unknown>;
}

/**
 * Écrit la trace, ou la journalise si elle ne passe pas.
 *
 * À appeler APRÈS que l'acte a réussi, jamais avant : consigner une suspension
 * qui échoue ensuite laisserait croire qu'elle a eu lieu.
 */
export async function consigner(trace: Trace): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: trace.acteurId,
        action: trace.action,
        resource: trace.ressource,
        details: (trace.details ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (cause) {
    // La trace est perdue. On la crie dans le journal applicatif plutôt que de
    // faire échouer un acte déjà accompli — mais on la crie, parce qu'un audit
    // qui perd des lignes en silence ne vaut rien.
    journal.erreur("TRACE D'AUDIT PERDUE", {
      acteur: trace.acteurId,
      action: trace.action,
      ressource: trace.ressource,
      cause: cause instanceof Error ? cause.message : String(cause),
      remede:
        "L'acte a bien eu lieu, sa trace non. Vérifier la base avant de conclure sur un dossier.",
    });
  }
}

/** Une ressource, écrite comme l'audit l'attend. */
export function ressource(type: string, id: string): string {
  return `${type}:${id}`;
}

export interface LigneAudit {
  id: string;
  acteurId: string;
  /** Le nom de l'acteur, quand son compte existe encore. */
  acteur: string | null;
  action: string;
  ressource: string;
  details: unknown;
  quand: Date;
}

/**
 * Les dernières traces, du plus récent au plus ancien.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * L'ACTEUR EST RÉSOLU À LA LECTURE, PAS À L'ÉCRITURE
 *
 * On range un identifiant, jamais un nom. Un nom recopié à l'écriture fige
 * l'orthographe d'un jour ; pire, il diverge du compte réel dès que la personne
 * change de nom d'affichage, et l'on ne sait plus si deux lignes désignent la
 * même personne.
 *
 * Le revers : un compte supprimé laisse un identifiant sans nom. C'est
 * préférable — la trace reste, et elle dit franchement qu'elle ne sait plus.
 */
export async function dernieresTraces(input: {
  limite?: number;
  /** Filtrer sur une ressource précise : « user:clx… ». */
  ressource?: string;
  acteurId?: string;
}): Promise<LigneAudit[]> {
  const lignes = await db.auditLog.findMany({
    where: {
      ...(input.ressource ? { resource: input.ressource } : {}),
      ...(input.acteurId ? { actorId: input.acteurId } : {}),
    },
    // L'identifiant départage : deux traces écrites dans la même milliseconde
    // sortiraient sinon dans un ordre indifférent, et l'écran d'audit
    // montrerait l'avant-dernière action en premier une fois sur deux.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.min(input.limite ?? 100, 500),
  });

  const acteurs = await db.user.findMany({
    where: { id: { in: [...new Set(lignes.map((l) => l.actorId))] } },
    select: {
      id: true,
      email: true,
      profile: { select: { displayName: true } },
    },
  });

  const parId = new Map(
    acteurs.map((a) => [a.id, a.profile?.displayName ?? a.email]),
  );

  return lignes.map((l) => ({
    id: l.id,
    acteurId: l.actorId,
    acteur: parId.get(l.actorId) ?? null,
    action: l.action,
    ressource: l.resource,
    details: l.details,
    quand: l.createdAt,
  }));
}
