"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sessionCourante } from "@/lib/auth/session";
import { ouvrirRenouvellement } from "@/lib/abonnements/renouvellement";
import { quitterForfaitGratuit, souscrire } from "@/lib/abonnements/souscription";

/** Les rails que Baobart sait viser. Tout le reste est ignoré. */
const MOYENS = new Set(["om", "wave", "mtn", "moov"]);

/**
 * Le geste de renouvellement, depuis la page où mènent les relances Ndank.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * L'ABONNÉ N'EST PAS UN PARAMÈTRE
 *
 * Un module « use server » expose chacun de ses exports comme un point d'entrée
 * appelable depuis le navigateur. L'abonné est donc lu depuis la session : le
 * passer permettrait d'ouvrir un paiement au nom d'autrui — et, pire ici que
 * pour un achat, de faire payer quelqu'un pour l'abonnement d'un autre.
 *
 * L'appartenance de l'abonnement est revérifiée dans `ouvrirRenouvellement`,
 * pas ici : la garde vit avec la règle, et non avec le formulaire.
 */
export async function renouvelerAbonnement(
  abonnementId: string,
  donnees?: FormData,
): Promise<void> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const resultat = await ouvrirRenouvellement({
    abonnementId,
    abonneId: utilisateur.id,
    moyen: MOYENS.has(String(donnees?.get("moyen") ?? ""))
      ? String(donnees?.get("moyen"))
      : undefined,
  });

  // `redirect` lève : il reste hors de tout bloc qui traiterait le résultat,
  // sinon un `catch` l'avalerait et la navigation n'aurait pas lieu.
  if (!resultat.ok) {
    redirect(`/abonnement/${abonnementId}/renouveler?paiement=${resultat.motif}`);
  }

  if (!resultat.paye && resultat.redirection) {
    // `typedRoutes` ne connaît que nos routes ; celle-ci vient de l'opérateur.
    // Elle n'est pas arbitraire pour autant : elle sort du pilote, jamais d'une
    // saisie.
    redirect(resultat.redirection as Route);
  }

  // Simulation : le cycle est déjà avancé. On envoie sur la page de suivi, qui
  // lira l'état plutôt que de le supposer.
  redirect(`/abonnement/${abonnementId}/paiement/${resultat.paiementId}`);
}

export type EtatForfait = { ok: true; message: string } | { ok: false; message: string };

const REFUS_SOUSCRIPTION = {
  INTROUVABLE: "Ce forfait n'existe pas.",
  FERME: "Ce forfait n'est pas encore ouvert.",
  PAIEMENT_NON_OUVERT: "Ce forfait est payant, et son paiement n'est pas encore ouvert.",
  DEJA_ABONNE: "Tu as déjà un forfait en cours.",
} as const;

/** Activer Accès libre, d'un clic. Le compte vient de la session, jamais du formulaire. */
export async function activerAccesLibre(): Promise<EtatForfait> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const r = await souscrire({ userId: utilisateur.id, code: "LIBRE" });
  if (!r.ok) return { ok: false, message: REFUS_SOUSCRIPTION[r.motif] };
  revalidatePath("/tarifs");
  revalidatePath("/dashboard/forfait");
  return { ok: true, message: "Accès libre est activé." };
}

export async function quitterAccesLibre(): Promise<EtatForfait> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const r = await quitterForfaitGratuit(utilisateur.id);
  if (!r.ok) {
    return { ok: false, message: r.motif === "PAYANT" ? "Ce forfait est payant : il se résilie depuis son écran de renouvellement." : "Tu n'as pas de forfait en cours." };
  }
  revalidatePath("/tarifs");
  revalidatePath("/dashboard/forfait");
  return { ok: true, message: "Accès libre est désactivé. Tu peux le réactiver quand tu veux." };
}
