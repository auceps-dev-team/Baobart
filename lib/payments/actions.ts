"use server";

import { revalidatePath } from "next/cache";

import { FRAICHEUR_SENSIBLE_MS, verifierCodeOuSecours } from "@/lib/auth/deux-facteurs";
import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deposer } from "@/lib/email/outbox";
import { verifierCompte } from "@/lib/payments/comptes";
import { cadenceValide } from "@/lib/payments/cadences";
import { masquerCompte } from "@/lib/payments/gains";
import { MESSAGES_PREUVE, preuveExigee } from "@/lib/payments/preuve";
import { RAILS } from "@/lib/payments/rails";
import { verifierLimite } from "@/lib/securite/garde";

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

  // La forme du compte d'abord : une faute de frappe ne doit coûter ni un essai
  // de code, ni un code de secours, qui ne sert qu'une fois.
  const verdict = verifierCompte({ provider, reference, titulaire });
  if (!verdict.accepte || !verdict.reference || !verdict.method) {
    return { ok: false, message: verdict.message ?? "Compte refusé.", saisie };
  }

  // ── LA PREUVE, AVANT TOUTE ÉCRITURE ───────────────────────────────────────
  //
  // Le compte de versement est la cible n°1 d'une session volée : le changer
  // redirige l'argent. La règle — quelle preuve, pour quel compte — est dans
  // `lib/payments/preuve.ts` ; ici, on lit ce qu'elle demande.
  const [compte, clesDAcces, session] = await Promise.all([
    db.user.findUnique({ where: { id: utilisateur.id }, select: { totpActiveLe: true } }),
    db.passkey.count({ where: { userId: utilisateur.id } }),
    db.session.findUnique({ where: { id: utilisateur.sessionId }, select: { totpValideLe: true } }),
  ]);
  const code2FA = String(donnees.get("code2FA") ?? "").trim();
  const preuve = preuveExigee({
    totpActif: Boolean(compte?.totpActiveLe),
    clesDAcces,
    codeSaisi: code2FA.length > 0,
    passageRecent:
      session?.totpValideLe != null && Date.now() - session.totpValideLe.getTime() <= FRAICHEUR_SENSIBLE_MS,
  });
  if ("refus" in preuve) return { ok: false, message: MESSAGES_PREUVE[preuve.refus], saisie };

  if (preuve.exiger === "CODE") {
    // Le plafond se compte AVANT la vérification, et par compte : voir
    // `deux-facteurs.code` dans lib/securite/limites.ts. Du 18 au 22/10, il
    // n'y en avait aucun — six chiffres se devinaient en deux heures.
    const borne = await verifierLimite("deux-facteurs.code", utilisateur.id);
    if (!borne.autorise) {
      return { ok: false, message: `Trop de codes essayés. Réessaie dans ${Math.ceil(borne.dansSecondes / 60)} minutes.`, saisie };
    }
    if (!(await verifierCodeOuSecours(utilisateur.id, code2FA))) {
      return { ok: false, message: MESSAGES_PREUVE.CODE_FAUX, saisie };
    }
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
