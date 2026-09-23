"use server";

import { revalidatePath } from "next/cache";

import { consigner, ressource } from "@/lib/admin/audit";
import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import { db } from "@/lib/db";
import {
  DUREE_BLOCAGE_IP_MS,
  TYPES_BLOQUABLES,
  bloquer,
  normaliser,
  type TypeBloquable,
} from "@/lib/securite/blocklist";

/**
 * Poser et lever un blocage depuis l'administration.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE POUVOIR EXIGÉ EST CELUI DE LA CONFORMITÉ
 *
 * Bloquer une adresse n'est pas de l'exploitation technique : c'est fermer la
 * porte à quelqu'un. Même garde que `deciderDuCompte`, pour la même raison —
 * et l'auteur est lu depuis la session, jamais reçu en paramètre. Un module
 * « use server » est joignable sans passer par l'écran ; qui pourrait choisir
 * son nom d'auteur signerait un blocage du nom d'un collègue.
 */

export type EtatBlocage =
  | { ok: true; message: string }
  | { ok: false; message: string };

const CHEMIN = "/dashboard/systeme/blocklist";

/**
 * Le formulaire de pose.
 *
 * La durée n'est pas demandée : elle découle du type. Six mois pour une
 * adresse — parce qu'une adresse change de mains —, indéfini pour le reste.
 * Offrir le choix inviterait à poser des blocages d'un jour, qui n'arrêtent
 * personne, ou des blocages perpétuels sur une adresse, qui finiront par
 * atteindre un inconnu.
 */
export async function poserUnBlocage(
  _precedent: EtatBlocage | null,
  donnees: FormData,
): Promise<EtatBlocage> {
  const qui = await exigerLePouvoir("gerer_la_conformite");

  const type = String(donnees.get("type") ?? "") as TypeBloquable;
  const valeurBrute = String(donnees.get("valeur") ?? "");
  const raison = String(donnees.get("raison") ?? "").trim();

  if (!TYPES_BLOQUABLES.includes(type)) {
    return { ok: false, message: "Choisis ce que tu bloques." };
  }

  const valeur = normaliser(type, valeurBrute);
  if (valeur.length === 0) {
    return { ok: false, message: "Indique la valeur à bloquer." };
  }

  // Même exigence que pour une décision de risque : un blocage sans raison
  // écrite est impossible à défendre trois mois plus tard, et impossible à
  // lever en confiance — personne ne saura s'il est encore justifié.
  if (raison.length < 4) {
    return { ok: false, message: "Écris la raison de ce blocage." };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ON NE SE BLOQUE PAS SOI-MÊME
  //
  // Bloquer sa propre adresse de connexion ferme l'écran d'administration à
  // celui qui vient de l'ouvrir — et le blocage se lève depuis cet écran. La
  // garde ne couvre que le courriel : l'adresse de l'administrateur n'est pas
  // connue ici, et la deviner serait pire que de ne pas la vérifier.
  if (type === "EMAIL" && valeur === normaliser("EMAIL", qui.email)) {
    return { ok: false, message: "On ne bloque pas sa propre adresse." };
  }

  await bloquer({
    type,
    valeur,
    raison,
    dureeMs: type === "IP" ? DUREE_BLOCAGE_IP_MS : null,
  });

  await consigner({
    acteurId: qui.id,
    action: "blocage.poser",
    ressource: ressource("blocage", `${type}:${valeur}`),
    details: { type, raison },
  });

  revalidatePath(CHEMIN);

  return {
    ok: true,
    message:
      type === "IP"
        ? `${valeur} bloquée pour six mois.`
        : `${valeur} bloquée sans échéance.`,
  };
}

/**
 * Lever un blocage, par son identifiant de ligne.
 *
 * Par identifiant et non par valeur : l'écran affiche aussi les entrées
 * expirées, et deux lignes peuvent porter la même valeur à des types
 * différents. Un `deleteMany` sur la valeur en retirerait plus d'une.
 */
export async function leverUnBlocage(
  ligneId: string,
  // Les trois suivants sont imposés par `PanneauOperations.executer` et ne
  // servent pas ici : il n'y a qu'une action possible par ligne, et elle ne
  // demande aucune saisie. Les retirer changerait la signature et casserait
  // l'appel ; les garder sans les désactiver laisserait trois avertissements
  // qui finiraient par cacher un vrai.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _cle: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _precedent: EtatBlocage | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _donnees: FormData,
): Promise<EtatBlocage> {
  const qui = await exigerLePouvoir("gerer_la_conformite");

  const ligne = await db.blockedObject.findUnique({
    where: { id: ligneId },
    select: { objectType: true, objectValue: true },
  });

  if (!ligne) {
    // Déjà levée par quelqu'un d'autre, ou récupérée par le ménage. Ce n'est
    // pas une erreur : le résultat voulu est atteint.
    revalidatePath(CHEMIN);
    return { ok: true, message: "Ce blocage n'existe plus." };
  }

  await db.blockedObject.delete({ where: { id: ligneId } });

  await consigner({
    acteurId: qui.id,
    action: "blocage.lever",
    ressource: ressource("blocage", `${ligne.objectType}:${ligne.objectValue}`),
    details: { type: ligne.objectType },
  });

  revalidatePath(CHEMIN);

  return { ok: true, message: `${ligne.objectValue} n'est plus bloquée.` };
}
