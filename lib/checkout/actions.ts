"use server";

import { redirect } from "next/navigation";

import { sessionCourante } from "@/lib/auth/session";
import { acheter } from "@/lib/checkout/achat";
import { db } from "@/lib/db";

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
export async function acheterRessource(produitId: string): Promise<void> {
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
  });

  // `redirect` lève : il doit rester hors du bloc qui traite le résultat, sinon
  // un `catch` autour l'avalerait et la navigation n'aurait pas lieu.
  redirect(
    resultat.ok
      ? `/products/${produit.slug}?achat=ok`
      : `/products/${produit.slug}?achat=${resultat.motif}`,
  );
}
