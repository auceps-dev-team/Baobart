"use server";

import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { sessionCourante } from "@/lib/auth/session";
import { acheter } from "@/lib/checkout/achat";
import { db } from "@/lib/db";
import { lireClics } from "@/lib/publicites/attribution";
import { attribuer } from "@/lib/publicites/service";
import { COOKIE_CLICS } from "@/lib/publicites/types";

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

  // La bannière cliquée qui menait ici, s'il y en a une. Une erreur de lecture
  // ne coûte qu'une ligne de statistique : elle ne doit jamais coûter la vente.
  const publiciteId = await attribuer(
    produit.slug,
    lireClics((await cookies()).get(COOKIE_CLICS)?.value),
  ).catch(() => null);

  const resultat = await acheter({
    publiciteId,
    produitId,
    acheteurId: utilisateur.id,
    // Le rail choisi par l'acheteur. La maquette du sélecteur n'existe pas
    // encore : le champ est lu s'il est là, et l'opérateur retombe sur Orange
    // Money sinon. Câbler d'abord évite d'avoir à rouvrir l'action ensuite.
    moyen: MOYENS.has(String(donnees?.get("moyen") ?? ""))
      ? String(donnees?.get("moyen"))
      : undefined,
    // Le code voyage par le formulaire, comme le rail. Il est revalidé de
    // bout en bout dans `acheter` : l'aperçu qu'a vu l'acheteur ne fait pas
    // foi, et le prix n'est jamais calculé à partir de ce qu'il envoie.
    codePromo: String(donnees?.get("codePromo") ?? "").trim() || null,
    // ══════════════════════════════════════════════════════════════════════
    // LES RÉPONSES VOYAGENT PRÉFIXÉES, ET ON NE LIT QUE CE PRÉFIXE
    //
    // Le formulaire porte déjà `moyen`, `pays`, `codePromo` et le jeton
    // d'action de Next. Passer le `FormData` entier à `acheter` lui ferait
    // traiter ces champs-là comme des réponses à des questions du vendeur.
    //
    // Le préfixe `champ:` isole ce qui vient des champs personnalisés, et la
    // clé qui suit est l'identifiant du champ — que `validerLesReponses`
    // confronte à ce que la ressource déclare vraiment.
    // Bruts : `retenirLeMontant` les relit, les borne et décide. Rien de ce
    // qui vient d'ici n'est employé tel quel — voir son en-tête.
    // Le pays est deja dans le formulaire depuis le choix des rails : on le
    // reprend plutot que d en ajouter un second, qui pourrait le contredire.
    pays: String(donnees?.get("pays") ?? "") || null,
    montant: String(donnees?.get("montant") ?? "") || null,
    pourboire: String(donnees?.get("pourboire") ?? "") || null,
    champs: Object.fromEntries(
      [...(donnees?.entries() ?? [])]
        .filter(([cle]) => cle.startsWith("champ:"))
        .map(([cle, valeur]) => [cle.slice("champ:".length), String(valeur)]),
    ),
  });

  // `redirect` lève : il doit rester hors du bloc qui traite le résultat, sinon
  // un `catch` autour l'avalerait et la navigation n'aurait pas lieu.
  if (!resultat.ok) {
    // Le détail d'un montant refusé voyage avec le motif : sans lui, la fiche
    // n'avait rien à dire (mesuré le 25/09, P4.3, P5.1, S21).
    const detail = resultat.montant
      ? `&montant=${resultat.montant.motif}${resultat.montant.minimum !== undefined ? `&minimum=${resultat.montant.minimum}` : ""}`
      : "";
    redirect(`/products/${produit.slug}?achat=${resultat.motif}${detail}` as Route);
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
