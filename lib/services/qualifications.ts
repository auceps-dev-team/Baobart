import "server-only";

import { db } from "@/lib/db";
import { accesOuvert } from "@/lib/ndank/etats";
import { REGLAGES_PAR_DEFAUT, ajouterJours } from "@/lib/ndank/cycle";

import { BADGES_PRO } from "@/lib/services/badges";

/**
 * Ce qu'il faut lire pour appeler `peutPublier("service")` avec des faits.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TROIS LECTURES QUI VONT ENSEMBLE
 *
 * Le droit se calcule à trois signaux : vendeur, badge, abonnement. La
 * session sait déjà pour le premier — `progression.aPublie`. Les deux autres
 * demandent une lecture, mais elles vont **toujours** ensemble : personne ne
 * lit l'un sans l'autre, et les séparer répartirait la responsabilité de
 * cette règle sur plusieurs endroits.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON NE STOCKE PAS LE VERDICT
 *
 * Une colonne `peutPublierDesServices` dériverait de l'abonnement au premier
 * renouvellement manqué (§18.3, §23.4). Ce module rend une PHOTO à l'instant
 * de la lecture — jamais un état.
 */

export interface Qualifications {
  /** L'abonnement est en cours — `ACTIVE` ou dans la grâce. */
  abonnementOuvert: boolean;
  /** L'un des deux badges professionnels est posé. */
  badgeProfessionnel: boolean;
}

/**
 * Lit les faits nécessaires pour décider du droit de publier un service.
 *
 * Deux lectures, jamais plus : on ne va pas rechercher l'historique d'un
 * badge ni les incidents de paiement — la question est binaire, la réponse
 * doit l'être.
 *
 * La cadence de l'abonnement sert à reconstituer la date de coupure d'accès :
 * `Subscription.cycleEnd` ne porte que l'échéance de paiement, pas la fin
 * d'accès. Confondre les deux fermerait un abonné parti en week-end (voir la
 * note en tête de `cycle.ts`).
 */
export async function lireQualifications(
  utilisateurId: string,
  maintenant = new Date(),
): Promise<Qualifications> {
  const [abonnement, badges] = await Promise.all([
    db.subscription.findFirst({
      where: { userId: utilisateurId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: { cycleStart: true, cycleEnd: true, cancelledAt: true },
    }),
    db.userBadge.findMany({
      where: {
        userId: utilisateurId,
        badge: { code: { in: [...BADGES_PRO] } },
      },
      select: { id: true },
      take: 1,
    }),
  ]);

  const abonnementOuvert = abonnement
    ? accesOuvert(
        {
          cycle: {
            debut: abonnement.cycleStart,
            echeance: abonnement.cycleEnd,
            accesJusquA: ajouterJours(
              abonnement.cycleEnd,
              REGLAGES_PAR_DEFAUT.graceJours,
            ),
            repriseJusquA: ajouterJours(
              abonnement.cycleEnd,
              REGLAGES_PAR_DEFAUT.graceJours + REGLAGES_PAR_DEFAUT.repriseJours,
            ),
          },
          resilieeLe: abonnement.cancelledAt,
        },
        maintenant,
      )
    : false;

  return {
    abonnementOuvert,
    badgeProfessionnel: badges.length > 0,
  };
}
