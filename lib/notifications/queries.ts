import "server-only";

import { db } from "@/lib/db";

import {
  CATALOGUE,
  type EvenementNotifiable,
} from "@/lib/notifications/catalogue";

/**
 * Ce que la cloche montre.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE TEXTE EST LU, PAS RECALCULÉ
 *
 * `titre` et `corps` ont été écrits au moment des faits et sont rendus tels
 * quels. La tentation serait de les reconstruire à l'affichage, à partir de
 * l'événement et de sa charge — cela permettrait de corriger une formulation
 * partout d'un coup.
 *
 * Ce serait faux : « ta fiche *Atelier sérigraphie* a été refusée » doit
 * continuer de dire *Atelier sérigraphie* même si l'organisateur l'a renommée
 * depuis. Une notification est le compte rendu d'un instant, pas une vue sur
 * l'état courant.
 */

export interface LigneNotification {
  id: string;
  evenement: EvenementNotifiable | null;
  titre: string;
  corps: string;
  lien: string | null;
  lue: boolean;
  quand: Date;
}

/**
 * Les dernières, non lues d'abord ? Non : les plus récentes d'abord.
 *
 * Trier par « non lues d'abord » paraît utile et ne l'est pas : la liste
 * change d'ordre sous les yeux dès qu'on en lit une, et l'on perd l'endroit
 * où l'on était. Le temps, lui, ne bouge pas.
 */
export async function listerNotifications(
  utilisateurId: string,
  limite = 50,
): Promise<LigneNotification[]> {
  const lignes = await db.notification.findMany({
    where: { userId: utilisateurId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limite, 200),
    select: {
      id: true,
      type: true,
      titre: true,
      corps: true,
      lien: true,
      readAt: true,
      createdAt: true,
    },
  });

  return lignes.map((l) => ({
    id: l.id,
    // Un type que le catalogue ne connaît plus — retiré depuis — ne doit pas
    // faire disparaître la ligne : son texte reste lisible sans lui.
    evenement: estConnu(l.type) ? l.type : null,
    titre: l.titre,
    corps: l.corps,
    lien: l.lien,
    lue: l.readAt !== null,
    quand: l.createdAt,
  }));
}

/**
 * Combien attendent d'être lues.
 *
 * Séparé de la lecture, et c'est délibéré : ce compteur s'affiche sur **chaque
 * page** du tableau de bord. Y charger cinquante textes serait payer une liste
 * pour n'obtenir qu'un nombre.
 */
export async function combienNonLues(utilisateurId: string): Promise<number> {
  return db.notification.count({
    where: { userId: utilisateurId, readAt: null },
  });
}

/**
 * Marquer comme lue.
 *
 * `updateMany` avec `userId` dans le `WHERE`, et non `update` sur la clé
 * primaire : l'identifiant vient du navigateur. Sans cette condition, il
 * suffirait de le deviner pour marquer lues les notifications de quelqu'un
 * d'autre — un dégât mineur, mais gratuit à empêcher.
 */
export async function marquerLue(
  utilisateurId: string,
  notificationId: string,
): Promise<boolean> {
  const ecrit = await db.notification.updateMany({
    where: { id: notificationId, userId: utilisateurId, readAt: null },
    data: { readAt: new Date() },
  });

  return ecrit.count === 1;
}

/** Tout marquer lu. Rend combien de lignes ont changé. */
export async function toutMarquerLu(utilisateurId: string): Promise<number> {
  const ecrit = await db.notification.updateMany({
    where: { userId: utilisateurId, readAt: null },
    data: { readAt: new Date() },
  });

  return ecrit.count;
}

function estConnu(type: string): type is EvenementNotifiable {
  return Object.hasOwn(CATALOGUE, type);
}
