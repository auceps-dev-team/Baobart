import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";

/**
 * Droit à l'effacement — article 17 du RGPD, article 12 de la loi ivoirienne
 * n° 2013-450 du 19 juin 2013 relative à la protection des données à caractère
 * personnel.
 *
 * Traduit `gdpr_data_erasure_service.rb` et `email_redactor_service.rb`
 * (antiwork/gumroad, MIT, lus comme spécification), §3.7-C du plan de refonte.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON CAVIARDE, ON NE SUPPRIME PAS — ET CE N'EST PAS UN CHOIX DE CONFORT
 *
 * Cinq tables refusent la suppression d'un compte. Ce n'est pas une opinion :
 * c'est écrit dans le schéma, en `onDelete: Restrict` ou par le défaut de
 * Prisma pour une relation obligatoire.
 *
 *   Order · Balance · BalanceTransaction · Payout · RiskStateChange
 *
 * Autrement dit : quiconque a acheté une fois, vendu une fois, ou seulement
 * été examiné par le moteur de confiance ne **peut pas** être supprimé. Un
 * `db.user.delete()` lèverait une contrainte de clé étrangère — en production,
 * sur la demande de quelqu'un qui attend une réponse.
 *
 * Et c'est juste : un grand livre dont les écritures perdent leur contrepartie
 * n'est plus un grand livre, et la comptabilité se conserve des années après
 * qu'un client est parti.
 *
 * L'effacement consiste donc à vider la coquille : l'adresse devient
 * `efface-<id>@baobart.invalid`, le profil, les messages, les sessions et les
 * moyens de paiement partent. Ce qui reste ne désigne plus personne.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES CASCADES NE SE DÉCLENCHENT PAS, PUISQU'ON NE SUPPRIME RIEN
 *
 * C'est le piège de tout ce module, et il est parfaitement silencieux.
 *
 * Trente-cinq tables portent `onDelete: Cascade` vers `User` : profil,
 * messages de forum, commentaires, communautés, notifications, jetons. Elles
 * disparaîtraient toutes si la ligne `User` disparaissait.
 *
 * Elle ne disparaît pas. **Aucune cascade ne joue.** Se fier au schéma
 * laisserait donc en ligne tout ce qu'on venait de promettre d'effacer — sans
 * la moindre erreur, avec un compte qui affiche « effacé » et des messages de
 * forum toujours signés.
 *
 * On efface donc explicitement, table par table. Et
 * `effacement.integration.test.ts` **interroge la base** pour la liste des
 * tables qui cascadent, et échoue si l'une d'elles n'est pas traitée ici. La
 * liste ci-dessous est recopiée ; le test, lui, est dérivé. C'est le test qui
 * empêche la copie de vieillir.
 */

/** Trente jours, annulables. Voir le commentaire de `DeletionRequest`. */
export const DELAI_EFFACEMENT_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Ce qui part : le modèle Prisma, et la ou les colonnes qui le rattachent.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LA COLONNE NE S'APPELLE PAS TOUJOURS `userId`
 *
 * Première version : `deleteMany({ where: { userId } })` sur toute la liste.
 * Neuf tables sur trente s'appellent autrement — `authorId`, `ownerId`,
 * `sellerId`, `creatorId`, `recruiterId`, `organizerId`, `followerId`,
 * `memberId`. Prisma a levé au premier `communityChatMessage`, ce qui était la
 * bonne réaction : une erreur franche plutôt qu'un effacement qui saute en
 * silence les messages de forum.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DEUX TABLES ONT DEUX COLONNES, ET C'EST LE PIÈGE DISCRET
 *
 * `Follow` porte `followerId` ET `followingId` : ne traiter que la première
 * effacerait ce que la personne suivait, en laissant intacts tous ceux qui la
 * suivaient. `TeamMembership` porte `memberId` et `sellerId`, pareil.
 *
 * Personne ne l'aurait vu : le compte serait caviardé, les compteurs
 * d'abonnés d'autrui continueraient de le compter, et la page « mes abonnés »
 * afficherait une ligne vide.
 *
 * L'ordre de la liste compte : une table référencée par une autre part après
 * elle. `forumPost` avant `forumTopic`.
 */
const A_SUPPRIMER: ReadonlyArray<readonly [modele: string, ...colonnes: string[]]> = [
  // ── Ce qui authentifie ────────────────────────────────────────────────
  ["session", "userId"],
  ["passkey", "userId"],
  ["totpRecoveryCode", "userId"],
  ["totpChallenge", "userId"],
  ["passwordReset", "userId"],
  ["account", "userId"],

  // ── Ce qui identifie ──────────────────────────────────────────────────
  ["profile", "userId"],
  ["billingInfo", "userId"],
  ["payoutAccount", "userId"],
  ["mobileMoneyAccount", "userId"],
  ["pushSubscription", "userId"],
  ["notificationPreference", "userId"],
  ["notification", "userId"],
  ["userBadge", "userId"],

  // ── Ce qui s'exprime ──────────────────────────────────────────────────
  ["communityChatMessage", "authorId"],
  ["forumPost", "authorId"],
  ["forumTopic", "authorId"],
  ["comment", "authorId"],
  ["like", "userId"],
  // Les deux sens : ce qu'on suivait ET ceux qui nous suivaient.
  ["follow", "followerId", "followingId"],
  // `Save` n'est pas listé : il n'a pas de colonne vers `User`. Un
  // enregistrement appartient à un `Board`, et le board à la personne — la
  // cascade depuis `board` l'emporte au passage.
  ["board", "ownerId"],
  ["blogPost", "authorId"],

  // ── Ce qui s'engage ───────────────────────────────────────────────────
  ["cart", "userId"],
  ["eventRegistration", "userId"],
  ["jobApplication", "userId"],
  ["communityMembership", "userId"],
  ["teamMembership", "memberId", "sellerId"],
  ["subscription", "userId"],
] as const;

export interface BilanEffacement {
  /** Combien de lignes retirées, par table. Les tables vides sont omises. */
  supprimees: Record<string, number>;
  /** L'adresse de remplacement, pour la trace. */
  adresseFinale: string;
}

/**
 * Caviarde un compte et retire ce qui lui appartient.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TOUT DANS UNE TRANSACTION, ET UN DÉLAI LARGE
 *
 * Un effacement à moitié fait est le pire des résultats : le profil part, les
 * messages restent, et personne ne sait où reprendre. Trente tables valent
 * bien plus que les cinq secondes par défaut de Prisma.
 */
export async function anonymiser(userId: string): Promise<BilanEffacement> {
  const adresseFinale = `efface-${userId}@baobart.invalid`;
  const supprimees: Record<string, number> = {};

  await db.$transaction(
    async (tx) => {
      for (const [table, ...colonnes] of A_SUPPRIMER) {
        // Le client Prisma est indexé par nom de modèle ; le cast est le prix
        // à payer pour parcourir une liste plutôt que d'écrire trente appels
        // identiques — et trente appels, c'est trente occasions d'en oublier un.
        const delegue = (tx as unknown as Record<string, DelegueSuppression>)[
          table
        ];

        if (!delegue) {
          // Un nom de modèle qui n'existe plus : une table renommée, une
          // entrée mal orthographiée. On s'arrête net plutôt que de sauter
          // en silence — un effacement incomplet qui se déclare réussi est
          // exactement ce que ce module existe pour éviter.
          throw new Error(
            `Effacement impossible : le modèle « ${table} » n'existe pas dans le client Prisma.`,
          );
        }

        // Une seule colonne : l'égalité directe. Plusieurs : un `OR`, parce
        // qu'une ligne rattachée par n'importe laquelle doit partir.
        const where =
          colonnes.length === 1
            ? { [colonnes[0]!]: userId }
            : { OR: colonnes.map((c) => ({ [c]: userId })) };

        const { count } = await delegue.deleteMany({ where });
        if (count > 0) supprimees[table] = count;
      }

      // ── Ce qui se caviarde au lieu de partir ──────────────────────────
      //
      // Les produits d'un créateur ne sont pas à lui seul : ils ont été
      // achetés, et un `OrderItem` les désigne. Les supprimer effacerait ce
      // que des gens ont payé. On les dépublie — invisibles, mais toujours
      // téléchargeables par qui les a acquis.
      const produits = await tx.product.updateMany({
        where: { sellerId: userId, status: { not: "ARCHIVED" } },
        data: { status: "ARCHIVED" },
      });
      if (produits.count > 0) supprimees["product (archivés)"] = produits.count;

      // L'adresse des événements de consommation : c'est une donnée
      // personnelle, et le compteur qu'elle sert ne la relit jamais.
      const evenements = await tx.consumptionEvent.updateMany({
        where: { userId, ipAddress: { not: null } },
        data: { ipAddress: null },
      });
      if (evenements.count > 0) {
        supprimees["consumptionEvent (adresses)"] = evenements.count;
      }

      // ── La coquille ───────────────────────────────────────────────────
      await tx.user.update({
        where: { id: userId },
        data: {
          email: adresseFinale,
          phone: null,
          passwordHash: null,
          totpSecret: null,
          totpActiveLe: null,
          anonymizedAt: new Date(),
          // Suspendu, pour que rien ne rouvre : la session est fermée, mais
          // un lien de réinitialisation déjà parti pourrait encore servir.
          suspendedAt: new Date(),
        },
      });
    },
    {
      // Trente tables sur une connexion froide. Le défaut de cinq secondes
      // ferait échouer l'effacement au milieu.
      timeout: 60_000,
      maxWait: 15_000,
    },
  );

  journal.info("compte effacé", {
    userId,
    tables: Object.keys(supprimees).length,
  });

  return { supprimees, adresseFinale };
}

interface DelegueSuppression {
  deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
}

// ──────────────────────────────────────────────────────── la demande ──

export type SuiteDemande =
  | { ok: true; executeLe: Date }
  | { ok: false; motif: "DEJA_DEMANDE" | "DEJA_EFFACE" };

/**
 * Enregistre une demande d'effacement.
 *
 * Rejouable après une annulation : la ligne est unique par compte, donc on
 * réécrit celle qui existe plutôt que d'en créer une seconde.
 */
export async function demanderEffacement(
  userId: string,
  motif?: string | null,
): Promise<SuiteDemande> {
  const compte = await db.user.findUnique({
    where: { id: userId },
    select: { anonymizedAt: true },
  });

  if (compte?.anonymizedAt) return { ok: false, motif: "DEJA_EFFACE" };

  const existante = await db.deletionRequest.findUnique({
    where: { userId },
    select: { executedAt: true, cancelledAt: true },
  });

  if (existante && !existante.executedAt && !existante.cancelledAt) {
    return { ok: false, motif: "DEJA_DEMANDE" };
  }

  const executeAfter = new Date(Date.now() + DELAI_EFFACEMENT_MS);

  await db.deletionRequest.upsert({
    where: { userId },
    update: {
      reason: motif ?? null,
      executeAfter,
      cancelledAt: null,
      executedAt: null,
      createdAt: new Date(),
    },
    create: { userId, reason: motif ?? null, executeAfter },
  });

  journal.info("effacement demandé", { userId, executeAfter });

  return { ok: true, executeLe: executeAfter };
}

/** Annule une demande en cours. Rend faux s'il n'y en avait pas. */
export async function annulerEffacement(userId: string): Promise<boolean> {
  // `updateMany` avec l'état d'avant dans le `WHERE` : une demande déjà
  // exécutée ne doit pas pouvoir être « annulée » après coup, ce qui donnerait
  // à l'écran un compte qui se croit sauvé alors qu'il est vidé.
  const { count } = await db.deletionRequest.updateMany({
    where: { userId, executedAt: null, cancelledAt: null },
    data: { cancelledAt: new Date() },
  });

  if (count > 0) journal.info("effacement annulé", { userId });

  return count > 0;
}

export interface EtatEffacement {
  demande: boolean;
  executeLe: Date | null;
  anonymise: boolean;
}

export async function etatEffacement(userId: string): Promise<EtatEffacement> {
  const [compte, demande] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { anonymizedAt: true },
    }),
    db.deletionRequest.findUnique({
      where: { userId },
      select: { executeAfter: true, executedAt: true, cancelledAt: true },
    }),
  ]);

  const enCours = Boolean(
    demande && !demande.executedAt && !demande.cancelledAt,
  );

  return {
    demande: enCours,
    executeLe: enCours ? demande!.executeAfter : null,
    anonymise: Boolean(compte?.anonymizedAt),
  };
}

/**
 * Exécute les demandes échues. Appelé par l'ordonnanceur.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * « L'ÉCHÉANCE EST PASSÉE », JAMAIS « C'EST AUJOURD'HUI »
 *
 * Même règle que le passage juridique : chercher l'égalité perdrait
 * définitivement toute demande dont le terme tombe pendant une panne. Un
 * passage sauté rattrape au suivant.
 *
 * Chaque compte est traité séparément : un effacement qui échoue — une
 * contrainte inattendue, une table neuve — ne doit pas emporter les autres.
 */
export async function executerLesEffacementsDus(): Promise<{
  traites: number;
  echecs: number;
}> {
  const dues = await db.deletionRequest.findMany({
    where: {
      executedAt: null,
      cancelledAt: null,
      executeAfter: { lte: new Date() },
    },
    select: { id: true, userId: true },
    take: 50,
  });

  let traites = 0;
  let echecs = 0;

  for (const demande of dues) {
    try {
      await anonymiser(demande.userId);
      await db.deletionRequest.update({
        where: { id: demande.id },
        data: { executedAt: new Date() },
      });
      traites += 1;
    } catch (cause) {
      echecs += 1;
      journal.erreur("effacement en échec", {
        userId: demande.userId,
        cause: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }

  return { traites, echecs };
}

/**
 * Les couples table/colonne qui disparaîtraient avec la ligne `User`.
 *
 * Demandées à la base, pas écrites à la main : c'est ce qui permet au test de
 * vérifier que `A_SUPPRIMER` les couvre toutes, **colonne par colonne**. Une
 * table ajoutée demain avec `onDelete: Cascade` vers `User`, ou une seconde
 * colonne ajoutée à une table existante, fera tomber ce test — au lieu de
 * rester silencieusement en ligne après un effacement.
 */
export async function cascadesVersUser(): Promise<
  Array<{ table: string; colonne: string }>
> {
  const lignes = await db.$queryRaw<
    Array<{ table_name: string; column_name: string }>
  >`
    SELECT tc.table_name::text AS table_name, kcu.column_name::text AS column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
     AND kcu.constraint_schema = tc.constraint_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
     AND rc.constraint_schema = tc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.constraint_schema = tc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'User'
      AND rc.delete_rule = 'CASCADE'
      AND tc.table_schema = 'public'
    ORDER BY 1, 2
  `;

  return lignes.map((l) => ({ table: l.table_name, colonne: l.column_name }));
}

/**
 * Les couples « modèle.colonne » que l'effacement traite.
 *
 * Rendus sous cette forme pour que le test puisse les comparer un à un à ce
 * que dit la base. Comparer les seuls noms de tables laisserait passer une
 * colonne oubliée — exactement le cas de `Follow`, dont un seul des deux sens
 * aurait été effacé.
 */
export const COUPLES_TRAITES: readonly string[] = A_SUPPRIMER.flatMap(
  ([table, ...colonnes]) => colonnes.map((c) => `${table}.${c}`),
);

export type { Prisma };
