import "server-only";

import { db } from "@/lib/db";

import {
  CANAUX,
  CATALOGUE,
  EVENEMENTS,
  estModifiable,
  type Canal,
  type EvenementNotifiable,
  type Preferences,
} from "@/lib/notifications/catalogue";

/**
 * Lire et écrire ce que quelqu'un a choisi de recevoir.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON NE RANGE QUE LES ÉCARTS
 *
 * Pas une ligne par couple à l'inscription : l'absence veut dire « le défaut du
 * code s'applique ». Trois conséquences, et les trois comptent :
 *
 *   — changer un défaut ne demande aucune migration de données. Personne ne
 *     porte une copie figée de ce qu'on avait décidé le jour de son
 *     inscription ;
 *   — ajouter un type de notification ne demande pas d'écrire douze mille
 *     lignes ;
 *   — la table reste petite, et sa lecture aussi.
 *
 * Le prix : une ligne remise au défaut se **supprime** plutôt que de se ranger
 * à `true`. C'est ce que fait `enregistrer`.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUI EST IMPÉRATIF NE S'ÉCRIT PAS
 *
 * Un avis de versement ne se coupe pas, et la garde vit ici plutôt que dans
 * l'écran : un formulaire posté à la main enverrait n'importe quel couple. Une
 * préférence refusée n'est pas une erreur — on l'ignore en silence, parce que
 * l'écran n'offrait pas de la changer.
 */

/**
 * Ce que la personne a changé, sous la forme que le module pur attend.
 *
 * Accepte un client de transaction : lue depuis l'aiguilleur, cette requête
 * doit partir sur la même connexion que les écritures qui la suivent. Une
 * lecture hors transaction y verrait un état d'avant, et surtout ouvrirait une
 * seconde connexion pendant qu'une transaction en tient déjà une.
 */
export async function lirePreferences(
  utilisateurId: string,
  client: Pick<typeof db, "notificationPreference"> = db,
): Promise<Preferences> {
  const lignes = await client.notificationPreference.findMany({
    where: { userId: utilisateurId },
    select: { evenement: true, canal: true, actif: true },
  });

  const prefs: Preferences = {};

  for (const l of lignes) {
    // Une ligne dont le code ne connaît plus l'événement ou le canal est
    // ignorée : un type retiré du catalogue ne doit pas faire échouer la
    // lecture de tous les autres.
    if (!estUnEvenement(l.evenement) || !estUnCanal(l.canal)) continue;

    prefs[l.evenement] = { ...prefs[l.evenement], [l.canal]: l.actif };
  }

  return prefs;
}

/**
 * Poser un réglage, ou le remettre au défaut.
 *
 * Rend `false` quand le couple est impératif ou inconnu — l'appelant n'a rien
 * à rattraper, il n'aurait pas dû l'offrir.
 */
export async function enregistrer(input: {
  utilisateurId: string;
  evenement: string;
  canal: string;
  actif: boolean;
}): Promise<boolean> {
  const { evenement, canal } = input;

  if (!estUnEvenement(evenement) || !estUnCanal(canal)) return false;
  if (!estModifiable(evenement)) return false;

  const auDefaut = CATALOGUE[evenement].defauts[canal] === input.actif;

  // Revenir au défaut efface la ligne. Sans ça, quelqu'un qui coupe puis
  // rallume garderait une ligne figée sur la valeur d'aujourd'hui — et ne
  // suivrait plus le défaut le jour où il change.
  if (auDefaut) {
    await db.notificationPreference.deleteMany({
      where: { userId: input.utilisateurId, evenement, canal },
    });
    return true;
  }

  await db.notificationPreference.upsert({
    where: {
      userId_evenement_canal: {
        userId: input.utilisateurId,
        evenement,
        canal,
      },
    },
    create: {
      userId: input.utilisateurId,
      evenement,
      canal,
      actif: input.actif,
    },
    update: { actif: input.actif },
  });

  return true;
}

function estUnEvenement(v: string): v is EvenementNotifiable {
  return (EVENEMENTS as string[]).includes(v);
}

function estUnCanal(v: string): v is Canal {
  return (CANAUX as readonly string[]).includes(v);
}
