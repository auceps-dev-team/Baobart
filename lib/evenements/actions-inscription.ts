"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sessionCourante } from "@/lib/auth/session";
import { desinscrire, inscrire } from "@/lib/evenements/inscription";
import { MESSAGES } from "@/lib/evenements/phases";
import { verifierLimiteAction } from "@/lib/securite/garde";

/**
 * S'inscrire à un événement, ou s'en retirer.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * VOIR EST PUBLIC, S'INSCRIRE NE L'EST PAS
 *
 * La même asymétrie que Jobs (§18.2). Un compte se crée en deux minutes et ne
 * filtre donc pas grand-chose — mais il donne quelqu'un à qui rattacher une
 * place. On peut écrire à un inscrit pour lui dire que la salle a changé ; on
 * ne peut écrire à personne.
 *
 * Un module « use server » expose chacun de ses exports au navigateur : les
 * gardes sont ici, pas dans la page.
 */

export type EtatInscription = { ok: boolean; message?: string };

export async function sInscrire(evenementId: string): Promise<EtatInscription> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) {
    // Redirection plutôt que message : quelqu'un qui vient de cliquer veut
    // s'inscrire, pas apprendre qu'il lui manque un compte. On l'y emmène, et
    // `suite` le ramène ici ensuite.
    redirect(`/connexion?suite=/evenements/${evenementId}`);
  }

  const borne = await verifierLimiteAction("evenement.inscription");
  if (!borne.autorise) {
    return {
      ok: false,
      message: `Tu as changé d'avis plusieurs fois de suite. Réessaie dans ${Math.ceil(borne.dansSecondes / 60)} minutes.`,
    };
  }

  const suite = await inscrire({ evenementId, userId: utilisateur.id });

  revalidatePath(`/evenements/${evenementId}`);
  revalidatePath("/evenements");

  return suite.ok ? { ok: true } : { ok: false, message: MESSAGES[suite.motif] };
}

export async function seDesinscrire(evenementId: string): Promise<EtatInscription> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect(`/connexion?suite=/evenements/${evenementId}`);

  const borne = await verifierLimiteAction("evenement.inscription");
  if (!borne.autorise) {
    return {
      ok: false,
      message: `Tu as changé d'avis plusieurs fois de suite. Réessaie dans ${Math.ceil(borne.dansSecondes / 60)} minutes.`,
    };
  }

  const suite = await desinscrire({ evenementId, userId: utilisateur.id });

  revalidatePath(`/evenements/${evenementId}`);
  revalidatePath("/evenements");

  return suite.ok
    ? { ok: true }
    : { ok: false, message: "Tu n'étais pas inscrit·e à cet événement." };
}
