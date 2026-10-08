"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";
import { paysValide } from "@/lib/payments/rails";
import { deuxFacteursRecent } from "@/lib/auth/deux-facteurs";
import {
  identitesDe,
  MESSAGE_BLOQUE,
  poserDefi,
  tropDEssais,
  verdictAntiBot,
} from "@/lib/auth/gestes";
import { ouvrirSession, sessionCourante } from "@/lib/auth/session";
import {
  codesParSmsPossibles,
  compteDuTelephone,
  emettreCode,
  rattacherTelephone,
  retirerTelephone,
  verifierCode,
} from "@/lib/auth/telephone";
import { adresseCourante, premierBlocage } from "@/lib/securite/blocklist";
import { verifierLimite, verifierLimiteAction } from "@/lib/securite/garde";
import { masquer, versE164 } from "@/lib/sms/numero";

/**
 * Se connecter par téléphone, et prouver son numéro.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA DEMANDE DE CODE NE DIT PAS SI LE NUMÉRO A UN COMPTE
 *
 * Même réponse, même délai, que le numéro soit connu ou non : sinon ce
 * formulaire répondrait à « ce numéro est-il client de Baobart ? » — une
 * information qui vaut de l'or pour une arnaque par SMS.
 *
 * Le délai est le piège discret : envoyer un SMS prend une seconde, ne rien
 * envoyer prend zéro. L'envoi part donc APRÈS la réponse (`after`), et le
 * chronomètre ne voit plus la différence. Contrepartie assumée : un SMS qui
 * échoue ne se voit pas à l'écran — il se voit au journal, et la personne
 * redemande un code.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE TÉLÉPHONE NE CONTOURNE PAS LA 2FA
 *
 * Un code SMS prouve la possession d'une ligne, pas celle du compte : une
 * carte SIM se vole, se duplique chez un revendeur complaisant. Un compte qui
 * a une 2FA (TOTP ou clé d'accès) passe donc par la même étape de
 * vérification qu'après le mot de passe.
 */

/** Ce que les deux panneaux affichent. */
export interface EtatTelephone {
  erreur?: string;
  info?: string;
  /** À quelle étape le formulaire en est. */
  etape?: "numero" | "code";
  /** Le numéro, masqué, pour que la personne sache où regarder. */
  numeroMasque?: string;
}

/** Le numéro en attente de code, entre les deux étapes. */
const COOKIE_CONNEXION = "baobart_tel_connexion";
const COOKIE_VERIFICATION = "baobart_tel_verification";

/** Dix minutes, comme le code. */
const DUREE_COOKIE_S = 600;

async function poserNumero(nom: string, e164: string): Promise<void> {
  const magasin = await cookies();
  magasin.set(nom, e164, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DUREE_COOKIE_S,
  });
}

function lireNumero(donnees: FormData): string | null {
  return versE164(
    String(donnees.get("numero") ?? ""),
    paysValide(String(donnees.get("pays") ?? "") || undefined),
  );
}

/** La borne par adresse, puis par numéro visé. */
async function bornes(e164: string | null): Promise<EtatTelephone | null> {
  const parAdresse = await verifierLimiteAction("telephone.code");
  if (!parAdresse.autorise) return tropDEssais(parAdresse.dansSecondes);

  if (e164) {
    const parNumero = await verifierLimite("telephone.code", `tel:${e164}`);
    if (!parNumero.autorise) return tropDEssais(parNumero.dansSecondes);
  }
  return null;
}

const INDISPONIBLE: EtatTelephone = {
  erreur: "La connexion par téléphone n'est pas disponible pour le moment.",
};

const DEUX_FACTEURS_A_REFAIRE: EtatTelephone = {
  erreur:
    "Par sécurité, reconnecte-toi avec ta double authentification, puis rattache ton numéro dans le quart d'heure.",
  etape: "numero",
};

const NUMERO_ILLISIBLE: EtatTelephone = {
  erreur: "Ce numéro ne ressemble pas à un numéro de téléphone. Vérifie l'indicatif.",
};

// ═══════════════════════════════════════════════════════════ connexion ══

export async function demanderCodeConnexion(
  _precedent: EtatTelephone | null,
  donnees: FormData,
): Promise<EtatTelephone> {
  const robot = await verdictAntiBot(donnees, "connexion-telephone", false);
  if (robot) return robot;

  const e164 = lireNumero(donnees);
  const borne = await bornes(e164);
  if (borne) return borne;
  if (!e164) return NUMERO_ILLISIBLE;

  if (!codesParSmsPossibles()) return INDISPONIBLE;

  const bloque = await premierBlocage(await identitesDe({ telephone: e164 }));
  if (bloque) {
    journal.info("connexion par téléphone refusée : identité bloquée", { type: bloque });
    return { erreur: MESSAGE_BLOQUE };
  }

  const compte = await compteDuTelephone(e164);
  // Le courriel du compte trouvé, lui, se vérifie en silence : le refuser à
  // l'écran dirait que ce numéro a un compte — celui d'une adresse bloquée.
  const courrielBloque =
    compte !== null && (await premierBlocage([{ type: "EMAIL", valeur: compte.email }])) !== null;
  if (courrielBloque) {
    journal.info("code de connexion non envoyé : courriel du compte bloqué", {
      vers: masquer(e164),
    });
  }

  if (compte && !compte.suspendedAt && !courrielBloque) {
    // Après la réponse : voir l'en-tête.
    after(async () => {
      await emettreCode({ userId: compte.id, telephone: e164, but: "LOGIN" });
    });
  }

  await poserNumero(COOKIE_CONNEXION, e164);
  return {
    etape: "code",
    numeroMasque: masquer(e164),
    info: "Si ce numéro est rattaché à un compte, un code vient de partir par SMS.",
  };
}

export async function verifierCodeConnexion(
  _precedent: EtatTelephone | null,
  donnees: FormData,
): Promise<EtatTelephone> {
  // La même borne que la connexion par mot de passe : le code laisse cinq
  // essais, la borne par adresse empêche d'en enchaîner sur plusieurs codes.
  const borne = await verifierLimiteAction("connexion");
  if (!borne.autorise) return { ...tropDEssais(borne.dansSecondes), etape: "code" };

  const magasin = await cookies();
  const e164 = magasin.get(COOKIE_CONNEXION)?.value;
  if (!e164) {
    return { erreur: "La demande a expiré. Recommence avec ton numéro.", etape: "numero" };
  }

  const suite = await verifierCode({
    telephone: e164,
    but: "LOGIN",
    saisie: String(donnees.get("code") ?? ""),
  });

  if (!suite.ok) {
    if (suite.motif === "INVALIDE") {
      return { erreur: "Ce code ne correspond pas.", etape: "code", numeroMasque: masquer(e164) };
    }
    magasin.delete(COOKIE_CONNEXION);
    return {
      erreur:
        suite.motif === "TROP_D_ESSAIS"
          ? "Trop d'essais pour ce code. Redemande-en un."
          : "Ce code a expiré. Redemande-en un.",
      etape: "numero",
    };
  }

  // Le numéro a pu quitter le compte entre l'envoi et la saisie : le code
  // était bon, mais il n'ouvre plus rien.
  const compte = await db.user.findUnique({
    where: { id: suite.userId },
    select: {
      id: true,
      email: true,
      phone: true,
      phoneVerifiedAt: true,
      suspendedAt: true,
      totpActiveLe: true,
      _count: { select: { passkeys: true } },
    },
  });
  magasin.delete(COOKIE_CONNEXION);

  if (!compte || compte.phone !== e164 || !compte.phoneVerifiedAt) {
    return { erreur: "Ce code ne correspond pas.", etape: "numero" };
  }
  if (compte.suspendedAt) {
    return { erreur: "Ce compte est suspendu. Écris-nous pour en savoir plus.", etape: "numero" };
  }

  // Les mêmes identités que la connexion par mot de passe — le courriel du
  // compte compris —, plus le numéro. Un blocage posé entre l'envoi du code
  // et sa saisie joue aussi.
  const bloque = await premierBlocage(await identitesDe({ email: compte.email, telephone: e164 }));
  if (bloque) {
    journal.info("connexion par téléphone refusée : identité bloquée", { type: bloque });
    return { erreur: MESSAGE_BLOQUE, etape: "numero" };
  }

  // Voir l'en-tête : le code SMS ne remplace pas un second facteur.
  if (compte.totpActiveLe || compte._count.passkeys > 0) {
    await poserDefi(compte.id);
    redirect("/connexion/verification");
  }

  await ouvrirSession(compte.id, await adresseCourante());
  redirect("/dashboard");
}

// ═══════════════════════════════════════════════════════ vérification ══

export async function demanderCodeVerification(
  _precedent: EtatTelephone | null,
  donnees: FormData,
): Promise<EtatTelephone> {
  const moi = await sessionCourante();
  if (!moi) return { erreur: "Reconnecte-toi pour continuer." };

  // Vérifiée ici AUSSI, avant d'envoyer : sans 2FA récente, la confirmation
  // refusera, et le SMS serait payé et décompté du quota pour rien.
  if (!(await deuxFacteursRecent(moi.sessionId))) return DEUX_FACTEURS_A_REFAIRE;

  const e164 = lireNumero(donnees);
  const borne = await bornes(e164);
  if (borne) return borne;
  if (!e164) return NUMERO_ILLISIBLE;

  if (!codesParSmsPossibles()) {
    return { erreur: "L'envoi de SMS n'est pas disponible pour le moment." };
  }

  if (await premierBlocage([{ type: "PHONE", valeur: e164 }])) {
    return { erreur: MESSAGE_BLOQUE };
  }

  // Ici on attend l'envoi, et on dit s'il a échoué : la personne est
  // connectée, et lui cacher qu'un SMS n'est pas parti ne protège personne.
  //
  // On ne dit PAS si ce numéro appartient déjà à un autre compte : seul qui
  // reçoit le code l'apprendra, à la confirmation — c'est-à-dire le titulaire
  // de la ligne, à qui l'information appartient.
  const emission = await emettreCode({ userId: moi.id, telephone: e164, but: "VERIFY" });
  if (!emission.ok) {
    const messages = {
      INDISPONIBLE: "L'envoi de SMS n'est pas disponible pour le moment.",
      TROP_TOT: "Un code vient de partir vers ce numéro. Attends une minute avant d'en redemander un.",
      ENVOI_ECHOUE: "Le SMS n'a pas pu partir. Vérifie le numéro, ou réessaie dans un instant.",
    } as const;
    return { erreur: messages[emission.motif] };
  }

  await poserNumero(COOKIE_VERIFICATION, e164);
  return {
    etape: "code",
    numeroMasque: masquer(e164),
    info: "Un code vient de partir par SMS.",
  };
}

export async function confirmerTelephone(
  _precedent: EtatTelephone | null,
  donnees: FormData,
): Promise<EtatTelephone> {
  const moi = await sessionCourante();
  if (!moi) return { erreur: "Reconnecte-toi pour continuer." };

  const borne = await verifierLimiteAction("connexion");
  if (!borne.autorise) return { ...tropDEssais(borne.dansSecondes), etape: "code" };

  // Rattacher un numéro, c'est ajouter une porte d'entrée au compte. Une
  // session volée ne doit pas pouvoir s'en poser une : avec une 2FA, il faut
  // l'avoir franchie récemment.
  if (!(await deuxFacteursRecent(moi.sessionId))) return DEUX_FACTEURS_A_REFAIRE;

  const magasin = await cookies();
  const e164 = magasin.get(COOKIE_VERIFICATION)?.value;
  if (!e164) return { erreur: "La demande a expiré. Redemande un code.", etape: "numero" };

  const suite = await verifierCode({
    telephone: e164,
    but: "VERIFY",
    saisie: String(donnees.get("code") ?? ""),
    userId: moi.id,
  });

  if (!suite.ok) {
    if (suite.motif === "INVALIDE") {
      return { erreur: "Ce code ne correspond pas.", etape: "code", numeroMasque: masquer(e164) };
    }
    magasin.delete(COOKIE_VERIFICATION);
    return {
      erreur:
        suite.motif === "TROP_D_ESSAIS"
          ? "Trop d'essais pour ce code. Redemande-en un."
          : "Ce code a expiré. Redemande-en un.",
      etape: "numero",
    };
  }

  magasin.delete(COOKIE_VERIFICATION);

  const rattache = await rattacherTelephone(moi.id, e164);
  if (!rattache.ok) {
    return {
      erreur:
        "Ce numéro est déjà rattaché à un autre compte. Retire-le de l'autre compte d'abord, ou écris-nous.",
      etape: "numero",
    };
  }

  journal.info("numéro de téléphone vérifié", { vers: masquer(e164) });
  revalidatePath("/dashboard/profil");
  return { info: "Numéro vérifié. Tu peux maintenant te connecter avec lui.", etape: "numero" };
}

export async function retirerMonTelephone(): Promise<EtatTelephone> {
  const moi = await sessionCourante();
  if (!moi) return { erreur: "Reconnecte-toi pour continuer." };

  await retirerTelephone(moi.id);
  revalidatePath("/dashboard/profil");
  return { info: "Numéro retiré.", etape: "numero" };
}
