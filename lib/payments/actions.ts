"use server";

import { revalidatePath } from "next/cache";

import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { verifierCompte } from "@/lib/payments/comptes";
import { cadenceValide } from "@/lib/payments/cadences";

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

    await tx.payoutAccount.create({
      data: {
        userId: utilisateur.id,
        method: verdict.method!,
        provider,
        accountRef: rejouable,
        holderName: titulaire.trim() || null,
      },
    });

    // Le rail décide du jour de la semaine où ce créateur est payé : il doit
    // suivre le compte, sinon la date annoncée serait celle de l'ancien.
    await tx.user.update({
      where: { id: utilisateur.id },
      data: { payoutRail: provider },
    });
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
