import "server-only";

import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";
import {
  pousser,
  type Abonnement,
  type Notification,
} from "@/lib/push/pilotes";

/**
 * Les appareils d'une personne, et ce qu'on leur envoie.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE MÉNAGE SE FAIT À L'ENVOI, PAS AILLEURS
 *
 * Un abonnement push meurt sans prévenir : navigateur désinstallé, permission
 * révoquée, données de site effacées. Rien ne nous le signale — on l'apprend en
 * essayant, quand le service répond 410.
 *
 * Le seul moment où l'on peut savoir est donc l'envoi. Effacer là, tout de
 * suite, évite deux dérives : une table qui enfle de fantômes, et un compteur
 * « personnes joignables » qui ment de plus en plus.
 */

/** Ce qu'un navigateur nous transmet quand il accepte les notifications. */
export interface Inscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  appareil?: string;
}

/** Au-delà, c'est du pistage plutôt que de l'information. */
const APPAREIL_MAX = 120;

/**
 * Enregistre — ou remet à jour — l'abonnement d'un navigateur.
 *
 * L'unicité est sur l'endpoint et non sur la personne : quelqu'un a un
 * téléphone ET un ordinateur, et la relance doit atteindre les deux.
 *
 * Le même endpoint réenregistré remplace ses clés au lieu d'ajouter une ligne.
 * Sans cela, un navigateur qui renouvelle son abonnement — ce qu'ils font — se
 * dédoublerait, et la personne recevrait chaque relance deux fois.
 */
export async function inscrire(
  utilisateurId: string,
  inscription: Inscription,
): Promise<{ ok: boolean }> {
  const endpoint = inscription.endpoint.trim();

  // Un endpoint est toujours une URL https servie par le navigateur. Tout le
  // reste vient d'ailleurs que d'un navigateur.
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000) {
    return { ok: false };
  }
  if (!inscription.p256dh || !inscription.auth) return { ok: false };

  const appareil = inscription.appareil?.slice(0, APPAREIL_MAX) ?? null;

  await db.pushSubscription.upsert({
    where: { endpoint },
    // Le `userId` est réécrit : un appareil partagé peut changer de main, et
    // laisser l'ancien propriétaire recevrait les relances de quelqu'un
    // d'autre.
    update: {
      userId: utilisateurId,
      p256dh: inscription.p256dh,
      auth: inscription.auth,
      appareil,
    },
    create: {
      userId: utilisateurId,
      endpoint,
      p256dh: inscription.p256dh,
      auth: inscription.auth,
      appareil,
    },
  });

  return { ok: true };
}

/**
 * Retire un abonnement.
 *
 * Contrôlé par la personne, jamais par l'endpoint seul : sans la condition sur
 * le propriétaire, quiconque connaîtrait un endpoint pourrait couper les
 * notifications d'un autre.
 */
export async function desinscrire(
  utilisateurId: string,
  endpoint: string,
): Promise<{ ok: boolean }> {
  const suite = await db.pushSubscription.deleteMany({
    where: { endpoint, userId: utilisateurId },
  });
  return { ok: suite.count > 0 };
}

/** Les identifiants des appareils d'une personne. Ce sont eux qui voyagent. */
export async function appareilsDe(utilisateurId: string): Promise<string[]> {
  const lignes = await db.pushSubscription.findMany({
    where: { userId: utilisateurId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return lignes.map((l) => l.id);
}

/**
 * Envoie à une liste d'appareils désignés par leur identifiant.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI DES IDENTIFIANTS ET NON LES ABONNEMENTS EUX-MÊMES
 *
 * Un abonnement push porte deux clés de chiffrement. Elles n'ont aucune raison
 * de traverser Ndank, qui ne décide que de QUI relancer et QUAND — un module
 * qui ne s'en sert pas ne doit pas les voir passer, ne serait-ce que pour ne
 * pas les journaliser par accident un jour.
 *
 * Le port transporte donc une poignée opaque, et les clés ne quittent jamais ce
 * fichier.
 */
export async function envoyerA(
  appareils: readonly string[],
  notification: Notification,
): Promise<boolean> {
  if (appareils.length === 0) return false;

  const lignes = await db.pushSubscription.findMany({
    where: { id: { in: [...appareils] } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  const verdict = await pousser(lignes satisfies Abonnement[], notification);

  if (verdict.morts.length > 0) {
    // Effacé maintenant : un abonnement déclaré mort ne revient pas, et le
    // garder ferait retenter chaque jour un appareil qui n'existe plus.
    await db.pushSubscription.deleteMany({
      where: { id: { in: verdict.morts } },
    });
    journal.info("abonnements push morts effacés", {
      combien: verdict.morts.length,
    });
  }

  if (verdict.deposes > 0) {
    await db.pushSubscription.updateMany({
      where: { id: { in: lignes.map((l) => l.id) } },
      data: { lastSeenAt: new Date() },
    });
  }

  return verdict.ok;
}
