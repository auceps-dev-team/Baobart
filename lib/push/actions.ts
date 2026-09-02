"use server";

import { sessionCourante } from "@/lib/auth/session";
import { desinscrire, inscrire } from "@/lib/push/abonnements";

/**
 * Enregistrer, ou retirer, le navigateur courant.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LA PERSONNE N'EST PAS UN PARAMÈTRE
 *
 * Un module « use server » expose chacun de ses exports au navigateur. Si
 * l'identifiant de l'utilisateur voyageait ici, n'importe qui pourrait
 * enregistrer SON appareil sur le compte d'un autre — et recevrait dès lors les
 * relances d'abonnement de cette personne, montants compris.
 *
 * Il est donc lu depuis la session, et seulement là.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QU'ON ACCEPTE DU CLIENT
 *
 * L'endpoint et les deux clés viennent du navigateur : ils sont sa réponse à
 * `pushManager.subscribe()`, et il n'y a pas d'autre source possible. On les
 * prend donc, mais on vérifie leur forme dans `inscrire` — un endpoint qui
 * n'est pas une URL https ne vient pas d'un navigateur.
 */

export type EtatPush = { ok: boolean; message?: string };

export async function enregistrerAppareil(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  appareil?: string;
}): Promise<EtatPush> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) return { ok: false, message: "Connecte-toi pour continuer." };

  const suite = await inscrire(utilisateur.id, input);
  return suite.ok
    ? { ok: true }
    : { ok: false, message: "Cet abonnement n'a pas pu être enregistré." };
}

export async function retirerAppareil(endpoint: string): Promise<EtatPush> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) return { ok: false, message: "Connecte-toi pour continuer." };

  // La suppression est conditionnée au propriétaire : sans cela, qui connaîtrait
  // un endpoint pourrait couper les notifications de quelqu'un d'autre.
  await desinscrire(utilisateur.id, endpoint);
  return { ok: true };
}
