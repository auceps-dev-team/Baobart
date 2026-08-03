"use server";

import { revalidatePath } from "next/cache";

import { sessionCourante } from "@/lib/auth/session";
import {
  basculerLikeDe,
  basculerSuiviDe,
  publierCommentaireDe,
  retirerCommentaireDe,
} from "@/lib/social/service";

/**
 * Aimer, suivre, commenter — la couche qui sait qui est connecté.
 *
 * Volontairement mince : tout ce qui décide vit dans `service.ts`, où les
 * tests peuvent l'exercer avec un identifiant explicite. Une action serveur ne
 * s'appelle pas depuis un test sans contexte de requête, et ce qu'on ne peut
 * pas exercer, on ne peut pas affirmer correct.
 */

export type Reponse =
  | { ok: true; actif: boolean; total: number }
  | { ok: false; message: string; connexion?: boolean };

const MESSAGE_CONNEXION = "Connecte-toi pour continuer.";

export async function basculerLike(produitId: string): Promise<Reponse> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) {
    return { ok: false, message: MESSAGE_CONNEXION, connexion: true };
  }

  const resultat = await basculerLikeDe(utilisateur.id, produitId);
  if (!resultat.ok) return resultat;

  if (resultat.slug) revalidatePath(`/products/${resultat.slug}`);
  revalidatePath("/dashboard/suivis");

  return { ok: true, actif: resultat.actif, total: resultat.total };
}

export async function basculerSuivi(createurId: string): Promise<Reponse> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) {
    return { ok: false, message: MESSAGE_CONNEXION, connexion: true };
  }

  const resultat = await basculerSuiviDe(utilisateur.id, createurId);
  if (!resultat.ok) return resultat;

  revalidatePath("/dashboard/abonnements");
  return { ok: true, actif: resultat.actif, total: resultat.total };
}

export type ReponseCommentaire =
  | { ok: true }
  | { ok: false; message: string; connexion?: boolean; saisie?: string };

export async function publierCommentaire(
  produitId: string,
  _precedent: ReponseCommentaire | null,
  donnees: FormData,
): Promise<ReponseCommentaire> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) {
    return { ok: false, message: MESSAGE_CONNEXION, connexion: true };
  }

  const brut = String(donnees.get("corps") ?? "");

  const resultat = await publierCommentaireDe({
    userId: utilisateur.id,
    produitId,
    corps: brut,
    parentId: String(donnees.get("parentId") ?? ""),
  });

  if (!resultat.ok) {
    // La saisie repart avec le refus : React vide les champs non contrôlés à
    // la fin d'une action, et perdre son texte sur une règle de longueur est
    // inacceptable.
    return { ok: false, message: resultat.message, saisie: brut };
  }

  revalidatePath(`/products/${resultat.slug}`);
  return { ok: true };
}

export async function retirerCommentaire(
  commentaireId: string,
): Promise<{ ok: boolean; message?: string }> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) return { ok: false, message: MESSAGE_CONNEXION };

  const resultat = await retirerCommentaireDe(utilisateur.id, commentaireId);
  if (resultat.ok && resultat.slug) {
    revalidatePath(`/products/${resultat.slug}`);
  }

  return { ok: resultat.ok, message: resultat.message };
}
