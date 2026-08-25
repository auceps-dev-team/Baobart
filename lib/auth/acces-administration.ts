import "server-only";

import { notFound } from "next/navigation";

import {
  estAdministrateur,
  peut,
  type Pouvoir,
  type RolePlateforme,
} from "@/lib/auth/administration";
import { sessionCourante } from "@/lib/auth/session";
import type { UtilisateurConnecte } from "@/lib/auth/session";

/**
 * La porte de l'espace d'administration.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI 404 ET NON 403
 *
 * Répondre « accès refusé » confirme que la page existe, donc qu'il y a
 * quelque chose à forcer. La fiche produit d'un autre vendeur applique déjà
 * cette règle ici (`app/dashboard/produits/[id]`), et la route de cron répond
 * 404 sans son secret. L'administration mérite au moins autant.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI DANS CHAQUE PAGE, ET PAS SEULEMENT DANS LE LAYOUT
 *
 * Un `layout.tsx` semble l'endroit évident : une garde, toutes les pages
 * couvertes. Mais Next.js ne réexécute pas un layout à chaque navigation entre
 * pages sœurs — il le réutilise. Une garde qui ne s'exécute pas est une garde
 * absente. Le layout en pose une quand même, en défense de profondeur, et
 * chaque page appelle celle-ci.
 */
export async function exigerAdministrateur(): Promise<
  UtilisateurConnecte & { role: RolePlateforme }
> {
  const utilisateur = await sessionCourante();

  // Non connecté : même réponse qu'un membre ordinaire. Rediriger vers la
  // connexion apprendrait qu'il existe ici quelque chose à voir une fois
  // connecté.
  if (!utilisateur || !estAdministrateur(utilisateur.role)) {
    notFound();
  }

  return utilisateur;
}

/** Même porte, mais pour un pouvoir précis — la gestion des rôles, par exemple. */
export async function exigerLePouvoir(
  pouvoir: Pouvoir,
): Promise<UtilisateurConnecte & { role: RolePlateforme }> {
  const utilisateur = await exigerAdministrateur();
  if (!peut(utilisateur.role, pouvoir)) notFound();
  return utilisateur;
}
