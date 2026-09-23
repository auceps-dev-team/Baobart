"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";

import {
  COOKIE_DEFI,
  abandonnerDefi,
  compteDuDefi,
  regenererCodesSecours,
} from "@/lib/auth/deux-facteurs";
import { ouvrirSession } from "@/lib/auth/session";
import { sessionCourante } from "@/lib/auth/session";
import {
  finirEnrolement,
  listerLesCles,
  optionsConnexion,
  optionsEnrolement,
  retirerUneCle,
  verifierConnexion,
} from "@/lib/auth/webauthn";
import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";
import { adresseCourante } from "@/lib/securite/blocklist";
import { verifierLimiteAction } from "@/lib/securite/garde";

/**
 * Les clés d'accès, vues des écrans.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE COMPTE VISÉ VIENT DE LA SESSION, OU DU DÉFI EN COURS
 *
 * Jamais d'un paramètre. À l'enrôlement, c'est la session ; à la connexion,
 * c'est la ligne `TotpChallenge` que désigne le cookie — celle-là même qui
 * prouve qu'un mot de passe correct vient d'être donné.
 *
 * Accepter un identifiant laisserait enregistrer une clé sur le compte de
 * quelqu'un d'autre, ce qui reviendrait à s'en donner les clés.
 */

export type EtatCles =
  | { ok: true; message: string; codesSecours?: string[] }
  | { ok: false; message: string };

const CHEMIN = "/dashboard/profil";

/** Les options d'enrôlement, pour le navigateur. */
export async function demarrerEnrolementCle() {
  const moi = await sessionCourante();
  if (!moi) return null;

  return optionsEnrolement(moi.id, moi.email, moi.nom);
}

/**
 * Enregistre la clé que le navigateur vient de fabriquer.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LA PREMIÈRE CLÉ APPELLE DES CODES DE SECOURS
 *
 * À partir d'ici, la connexion exigera un second facteur. Si la personne n'a
 * pas de TOTP, cette clé est **le seul** moyen d'entrer — et perdre
 * l'appareil fermerait le compte définitivement.
 *
 * On remet donc un jeu de codes de secours au premier enrôlement, exactement
 * comme à l'activation de TOTP. Ne pas le faire serait poser un verrou sans
 * fabriquer de double.
 */
export async function enregistrerUneCle(
  reponse: RegistrationResponseJSON,
  libelle: string | null,
): Promise<EtatCles> {
  const moi = await sessionCourante();
  if (!moi) return { ok: false, message: "Reconnecte-toi." };

  const suite = await finirEnrolement(moi.id, reponse, libelle);

  if (!suite.ok) {
    const messages = {
      DEFI_INCONNU: "La demande a expiré. Recommence.",
      REPONSE_REFUSEE: "Cette clé n'a pas pu être vérifiée.",
      DEJA_ENREGISTREE: "Cette clé est déjà enregistrée sur ce compte.",
    } as const;

    return { ok: false, message: messages[suite.motif] };
  }

  // Des codes de secours seulement s'il n'y en a pas déjà : en regénérer
  // invaliderait ceux que la personne a notés en activant TOTP.
  const dejaDesCodes = await db.totpRecoveryCode.count({
    where: { userId: moi.id, usedAt: null },
  });

  const codesSecours =
    dejaDesCodes === 0 ? await regenererCodesSecours(moi.id) : undefined;

  revalidatePath(CHEMIN);

  return {
    ok: true,
    message: codesSecours
      ? "Clé enregistrée. Note ces codes de secours : ils sont ton seul recours si tu perds l'appareil."
      : "Clé enregistrée.",
    codesSecours,
  };
}

/** Retire une clé du compte. */
export async function retirerLaCle(
  _precedent: EtatCles | null,
  donnees: FormData,
): Promise<EtatCles> {
  const moi = await sessionCourante();
  if (!moi) return { ok: false, message: "Reconnecte-toi." };

  const id = String(donnees.get("id") ?? "");
  const retiree = await retirerUneCle(moi.id, id);

  revalidatePath(CHEMIN);

  return retiree
    ? { ok: true, message: "Clé retirée." }
    : { ok: false, message: "Cette clé n'existe pas sur ce compte." };
}

/** Ce que le panneau du profil affiche. */
export async function lireLesCles() {
  const moi = await sessionCourante();
  if (!moi) return [];

  return listerLesCles(moi.id);
}

// ───────────────────────────────────────────────────────── connexion ──

/**
 * Les options de connexion, pour l'écran de vérification.
 *
 * Elles ne sont rendues qu'à qui détient un cookie de défi valable : c'est ce
 * qui prouve qu'un mot de passe correct vient d'être donné. Sans cela, on
 * publierait la liste des identifiants de clés de n'importe quel compte à qui
 * en connaît l'adresse.
 */
export async function demarrerConnexionParCle() {
  const magasin = await cookies();
  const jeton = magasin.get(COOKIE_DEFI)?.value;
  if (!jeton) return null;

  const userId = await compteDuDefi(jeton);
  if (!userId) return null;

  return optionsConnexion(userId);
}

/**
 * Relève le défi avec une clé, et ouvre la session.
 *
 * Le défi TOTP est abandonné au passage : il a servi, et le laisser vivre
 * permettrait d'ouvrir une seconde session avec le même cookie.
 */
export async function connexionParCle(
  reponse: AuthenticationResponseJSON,
): Promise<{ ok: false; message: string } | never> {
  const borne = await verifierLimiteAction("connexion");
  if (!borne.autorise) {
    return { ok: false, message: "Trop d'essais. Attends un instant." };
  }

  const magasin = await cookies();
  const jeton = magasin.get(COOKIE_DEFI)?.value;
  if (!jeton) {
    return { ok: false, message: "La vérification a expiré. Reprends la connexion." };
  }

  const attendu = await compteDuDefi(jeton);
  if (!attendu) {
    return { ok: false, message: "La vérification a expiré. Reprends la connexion." };
  }

  const suite = await verifierConnexion(reponse);

  if (!suite.ok) {
    if (suite.motif === "COMPTEUR_RECULE") {
      // Le seul signal de clonage que WebAuthn donne. On le dit à la
      // personne, parce qu'elle est la seule à pouvoir agir dessus.
      return {
        ok: false,
        message:
          "Cette clé a été refusée pour une raison de sécurité. Emploie un code, puis retire-la depuis ton profil.",
      };
    }

    return { ok: false, message: "Cette clé n'a pas été reconnue." };
  }

  // La clé doit appartenir au compte qui vient de donner son mot de passe.
  if (suite.userId !== attendu) {
    journal.info("clé présentée pour un autre compte que celui du défi", {});
    return { ok: false, message: "Cette clé n'a pas été reconnue." };
  }

  await abandonnerDefi(jeton);
  magasin.delete(COOKIE_DEFI);

  await ouvrirSession(suite.userId, await adresseCourante(), new Date());

  redirect("/dashboard");
}
