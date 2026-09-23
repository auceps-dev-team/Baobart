"use server";

import { revalidatePath } from "next/cache";

import {
  commencerActivation,
  confirmerActivation,
  desactiver,
  etatDeuxFacteurs,
  noterPassage,
  regenererCodesSecours,
  verifierCodeOuSecours,
} from "@/lib/auth/deux-facteurs";
import { sessionCourante } from "@/lib/auth/session";
import { ChiffrementIndisponibleError } from "@/lib/auth/totp";
import { verifierLimiteAction } from "@/lib/securite/garde";

/**
 * Activer, confirmer, couper la double authentification.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE COMPTE VISÉ EST TOUJOURS CELUI DE LA SESSION
 *
 * Aucun de ces gestes ne prend d'identifiant en paramètre. Un module
 * « use server » est joignable sans passer par l'écran : une action qui
 * accepterait un `userId` laisserait n'importe qui couper la double
 * authentification de n'importe qui d'autre, et le formulaire n'y changerait
 * rien.
 */

export type EtatDeuxFacteursAction =
  | { ok: true; message: string; secret?: string; uri?: string; codes?: string[] }
  | { ok: false; message: string };

const CHEMIN = "/dashboard/profil";

/** Pose un secret neuf et rend de quoi configurer l'application. */
export async function demarrerDeuxFacteurs(): Promise<EtatDeuxFacteursAction> {
  const moi = await sessionCourante();
  if (!moi) return { ok: false, message: "Reconnecte-toi." };

  try {
    const debut = await commencerActivation(moi.id, moi.email);

    revalidatePath(CHEMIN);

    return {
      ok: true,
      message: "Enregistre cette clé dans ton application, puis saisis un code.",
      secret: debut.secretLisible,
      uri: debut.uri,
    };
  } catch (cause) {
    if (cause instanceof ChiffrementIndisponibleError) {
      // Franc et non silencieux : la plateforme n'a pas de clé de
      // chiffrement, et écrire le secret en clair serait pire que refuser.
      return {
        ok: false,
        message:
          "La double authentification n'est pas configurée sur cette plateforme. Préviens l'administrateur.",
      };
    }

    return {
      ok: false,
      message:
        cause instanceof Error ? cause.message : "Impossible de démarrer.",
    };
  }
}

/**
 * Confirme l'activation et rend les codes de secours.
 *
 * Bornée comme la connexion : sans borne, on chercherait les six chiffres
 * depuis un compte déjà ouvert, et la fenêtre de tolérance en rend trois
 * valables à la fois.
 */
export async function confirmerDeuxFacteurs(
  _precedent: EtatDeuxFacteursAction | null,
  donnees: FormData,
): Promise<EtatDeuxFacteursAction> {
  const borne = await verifierLimiteAction("connexion");
  if (!borne.autorise) {
    return { ok: false, message: "Trop d'essais. Attends un instant." };
  }

  const moi = await sessionCourante();
  if (!moi) return { ok: false, message: "Reconnecte-toi." };

  const code = String(donnees.get("code") ?? "").trim();
  if (!code) return { ok: false, message: "Saisis le code de ton application." };

  const suite = await confirmerActivation(moi.id, code);

  if (!suite.ok) {
    const messages = {
      PAS_DE_SECRET: "Recommence : aucune clé n'a été posée.",
      CODE_FAUX: "Ce code ne correspond pas. Vérifie l'heure de ton téléphone.",
      DEJA_ACTIVE: "La double authentification est déjà active.",
    } as const;

    return { ok: false, message: messages[suite.motif] };
  }

  // La session courante vient de prouver qu'elle tient l'application : elle
  // n'a pas à redemander un code dans la minute pour un versement.
  await noterPassage(moi.sessionId);

  revalidatePath(CHEMIN);

  return {
    ok: true,
    message:
      "Double authentification active. Note ces codes de secours : ils ne seront plus jamais affichés.",
    codes: suite.codesSecours,
  };
}

/** Coupe la double authentification, contre un code valable. */
export async function couperDeuxFacteurs(
  _precedent: EtatDeuxFacteursAction | null,
  donnees: FormData,
): Promise<EtatDeuxFacteursAction> {
  const borne = await verifierLimiteAction("connexion");
  if (!borne.autorise) {
    return { ok: false, message: "Trop d'essais. Attends un instant." };
  }

  const moi = await sessionCourante();
  if (!moi) return { ok: false, message: "Reconnecte-toi." };

  const code = String(donnees.get("code") ?? "").trim();
  if (!code) return { ok: false, message: "Saisis un code pour confirmer." };

  const coupe = await desactiver(moi.id, code);

  revalidatePath(CHEMIN);

  return coupe
    ? { ok: true, message: "Double authentification coupée." }
    : { ok: false, message: "Ce code ne correspond pas." };
}

/**
 * Remet un lot de codes de secours.
 *
 * Exige un code valable, comme la coupure : les anciens codes cessent de
 * fonctionner, et laisser faire ce geste sans preuve permettrait à qui a volé
 * une session d'enfermer dehors le propriétaire du compte.
 */
export async function renouvelerCodesSecours(
  _precedent: EtatDeuxFacteursAction | null,
  donnees: FormData,
): Promise<EtatDeuxFacteursAction> {
  const borne = await verifierLimiteAction("connexion");
  if (!borne.autorise) {
    return { ok: false, message: "Trop d'essais. Attends un instant." };
  }

  const moi = await sessionCourante();
  if (!moi) return { ok: false, message: "Reconnecte-toi." };

  const code = String(donnees.get("code") ?? "").trim();
  if (!(await verifierCodeOuSecours(moi.id, code))) {
    return { ok: false, message: "Ce code ne correspond pas." };
  }

  const codes = await regenererCodesSecours(moi.id);

  revalidatePath(CHEMIN);

  return {
    ok: true,
    message:
      "Nouveaux codes de secours. Les précédents ne fonctionnent plus — note ceux-ci.",
    codes,
  };
}

/** Ce que l'écran affiche. Lu depuis la session, jamais d'un paramètre. */
export async function lireEtatDeuxFacteurs() {
  const moi = await sessionCourante();
  if (!moi) return null;

  return etatDeuxFacteurs(moi.id);
}
