"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";

import { sessionCourante } from "@/lib/auth/session";
import { acheter } from "@/lib/checkout/achat";
import { db } from "@/lib/db";

/** Les rails que Baobart sait viser. Tout le reste est ignoré. */
const MOYENS = new Set(["om", "wave", "mtn", "moov"]);

/**
 * Le geste d'achat, depuis la fiche.
 *
 * Un module « use server » expose chacun de ses exports comme un point d'entrée
 * appelable depuis le navigateur. L'acheteur n'est donc pas un paramètre — il
 * est lu depuis la session. Le passer serait offrir d'acheter au nom d'autrui.
 *
 * Le résultat repart dans l'URL plutôt que dans un état de formulaire : la
 * fiche est une page serveur, et un aller-retour la relit entièrement — droit
 * de téléchargement compris, qui vient de changer.
 */
export async function acheterRessource(
  produitId: string,
  donnees?: FormData,
): Promise<void> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const produit = await db.product.findUnique({
    where: { id: produitId },
    select: { slug: true },
  });
  if (!produit) redirect("/explore");

  const resultat = await acheter({
    produitId,
    acheteurId: utilisateur.id,
    // Le rail choisi par l'acheteur. La maquette du sélecteur n'existe pas
    // encore : le champ est lu s'il est là, et l'opérateur retombe sur Orange
    // Money sinon. Câbler d'abord évite d'avoir à rouvrir l'action ensuite.
    moyen: MOYENS.has(String(donnees?.get("moyen") ?? ""))
      ? String(donnees?.get("moyen"))
      : undefined,
  });

  // `redirect` lève : il doit rester hors du bloc qui traite le résultat, sinon
  // un `catch` autour l'avalerait et la navigation n'aurait pas lieu.
  if (!resultat.ok) {
    redirect(`/products/${produit.slug}?achat=${resultat.motif}`);
  }

  // Le paiement n'est qu'ouvert : l'acheteur part chez l'opérateur, et on ne
  // lui promet rien. Lui afficher « achat=ok » à ce stade serait mentir sur un
  // paiement qu'il n'a pas encore autorisé.
  if (!resultat.paye && resultat.redirection) {
    // `typedRoutes` ne connaît que nos routes ; celle-ci vient de l'opérateur.
    // La valeur n'est pas arbitraire pour autant : elle sort du pilote, pas
    // d'une entrée utilisateur.
    redirect(resultat.redirection as Route);
  }

  redirect(`/products/${produit.slug}?achat=ok`);
}
