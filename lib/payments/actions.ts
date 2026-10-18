"use server";

import { revalidatePath } from "next/cache";

import { deuxFacteursRecent } from "@/lib/auth/deux-facteurs";
import { verifierMotDePasse } from "@/lib/auth/password";
import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deposer } from "@/lib/email/outbox";
import { verifierCompte } from "@/lib/payments/comptes";
import { cadenceValide } from "@/lib/payments/cadences";
import { masquerCompte } from "@/lib/payments/gains";
import { RAILS } from "@/lib/payments/rails";

/**
 * Le moyen de versement, en clair, pour l'alerte au propriétaire.
 *
 * On préfère le libellé du rail (« Orange Money », « Wave ») quand on le
 * connaît : c'est ce que le créateur reconnaît. À défaut — un code inconnu, ou
 * un virement bancaire qui n'est pas un rail — on retombe sur la nature, jamais
 * sur un code brut qui n'apprendrait rien à qui relève sa boîte.
 */
function libelleDuMoyen(provider: string, method: "MOBILE_MONEY" | "BANK"): string {
  const rail = RAILS.find((r) => r.code === provider);
  if (rail) return rail.label;
  return method === "BANK" ? "compte bancaire" : "mobile money";
}

/**
 * Enregistrer son compte de versement.
 *
 * Le geste le plus lourd de conséquences du tableau de bord : un numéro mal
 * saisi et l'argent part ailleurs. La validation vit dans `comptes.ts`, où
 * elle s'éprouve ; ici on ne fait que la session et l'écriture.
 */

export type EtatCompte =
  | { ok: true }
  | { ok: false; message: string; saisie?: { provider: string; reference: string; titulaire: string } };

export async function enregistrerCompteDeVersement(
  _precedent: EtatCompte | null,
  donnees: FormData,
): Promise<EtatCompte> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) {
    return { ok: false, message: "Connecte-toi pour continuer." };
  }

  const provider = String(donnees.get("provider") ?? "").trim();
  const reference = String(donnees.get("reference") ?? "");
  const titulaire = String(donnees.get("titulaire") ?? "");

  // Renvoyée avec chaque refus : React vide les champs non contrôlés à la fin
  // d'une action, et refaire saisir un IBAN sur une faute de frappe est cruel.
  const saisie = { provider, reference, titulaire };

  // Sécurité renforcée (Step-Up Auth) :
  // 1. Si le compte a activé la 2FA, celle-ci doit avoir été validée récemment.
  if (utilisateur.sessionId && !(await deuxFacteursRecent(utilisateur.sessionId))) {
    return {
      ok: false,
      message: "Par sécurité, reconnecte-toi avec ta double authentification avant de modifier ton compte de versement.",
      saisie,
    };
  }

  // 2. Si un mot de passe de confirmation est fourni, le valider rigoureusement
  const motDePasse = donnees.get("motDePasseConfirmation");
  if (motDePasse && typeof motDePasse === "string") {
    const compte = await db.user.findUnique({
      where: { id: utilisateur.id },
      select: { passwordHash: true },
    });
    if (compte?.passwordHash) {
      const motDePasseValide = await verifierMotDePasse(motDePasse, compte.passwordHash);
      if (!motDePasseValide) {
        return {
          ok: false,
          message: "Mot de passe incorrect. La modification du compte de versement requiert une confirmation valide.",
          saisie,
        };
      }
    }
  }

  const verdict = verifierCompte({ provider, reference, titulaire });
  if (!verdict.accepte || !verdict.reference || !verdict.method) {
    return { ok: false, message: verdict.message ?? "Compte refusé.", saisie };
  }


  const rejouable = verdict.reference;

  await db.$transaction(async (tx) => {
    // L'ancien compte est retiré, jamais supprimé : un versement passé le
    // référence, et son historique doit rester lisible.
    await tx.payoutAccount.updateMany({
      where: { userId: utilisateur.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    const cree = await tx.payoutAccount.create({
      data: {
        userId: utilisateur.id,
        method: verdict.method!,
        provider,
        accountRef: rejouable,
        holderName: titulaire.trim() || null,
      },
      select: { id: true },
    });

    // Le rail décide du jour de la semaine où ce créateur est payé : il doit
    // suivre le compte, sinon la date annoncée serait celle de l'ancien.
    await tx.user.update({
      where: { id: utilisateur.id },
      data: { payoutRail: provider },
    });

    // ════════════════════════════════════════════════════════════════════════
    // L'ALERTE PART DANS LA MÊME TRANSACTION QUE LE CHANGEMENT
    //
    // C'est le point entier de l'alerte : un compte de versement détourné
    // redirige l'argent, et le délai de 24 h avant le premier départ
    // (`lib/payments/eligibilite.ts`) ne protège que si le vrai propriétaire
    // est prévenu dans cet intervalle. Déposée après la transaction, l'alerte
    // pourrait manquer si le processus tombe entre les deux ; dedans, soit le
    // changement ET son alerte tiennent, soit aucun des deux.
    //
    // La clé porte l'identifiant du nouveau compte : chaque changement crée une
    // ligne neuve, donc une clé neuve — deux changements successifs alertent
    // deux fois, un rejeu de la même écriture n'alerte qu'une.
    await deposer(
      {
        cle: `compte-versement-modifie-${cree.id}`,
        destinataire: utilisateur.email,
        modele: "COMPTE_VERSEMENT_MODIFIE",
        charge: {
          nom: utilisateur.nom,
          moyen: libelleDuMoyen(provider, verdict.method!),
          // Masqué : « ···· 4821 ». La référence entière dans une boîte serait
          // une fuite, et l'alerte n'en a pas besoin pour faire son travail.
          compte: masquerCompte(rejouable),
        },
      },
      tx,
    );
  });

  revalidatePath("/dashboard/gains");
  revalidatePath("/dashboard/versements");
  return { ok: true };
}

/**
 * Changer sa cadence de versement.
 *
 * La cadence dit à quelle **fréquence** on est payé ; le rail choisi, lui,
 * décide du **jour**. Les deux se lisent ensemble sur l'écran, sinon un vendeur
 * qui passe au mensuel ne sait pas quand tomber son argent.
 *
 * Aucune valeur libre n'est acceptée : la liste vient du code, et une cadence
 * inconnue est refusée plutôt qu'écrite. Le quotidien existe au schéma mais
 * aucun cycle ne le sert — l'offrir promettrait un versement que rien ne
 * déclencherait.
 */
export async function enregistrerCadence(
  _precedent: EtatCompte | null,
  donnees: FormData,
): Promise<EtatCompte> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) {
    return { ok: false, message: "Connecte-toi pour continuer." };
  }

  const cadence = cadenceValide(String(donnees.get("cadence") ?? ""));
  if (!cadence) {
    return { ok: false, message: "Cadence inconnue." };
  }

  await db.user.update({
    where: { id: utilisateur.id },
    data: { payoutFrequency: cadence },
  });

  revalidatePath("/dashboard/versements");
  return { ok: true };
}
