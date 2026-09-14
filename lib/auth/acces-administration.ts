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

/**
 * La porte d'un pouvoir précis.
 *
 * ───────────────────────────────────────────────────────────────────────
 * ELLE NE PASSE PLUS PAR `exigerAdministrateur`
 *
 * Elle le faisait, et c'était sans conséquence tant que tout administrateur
 * pouvait consulter le système. Depuis que les rôles sont fonctionnels, un
 * modérateur n'a plus ce pouvoir-là : enchaîner les deux gardes lui aurait
 * fermé son propre écran, avec un 404 que rien n'aurait expliqué.
 *
 * Le pouvoir demandé suffit donc, et lui seul. C'est aussi plus juste à lire :
 * une garde qui exige deux choses dont une n'est pas écrite est une garde qu'on
 * relit mal.
 */
export async function exigerLePouvoir(
  pouvoir: Pouvoir,
): Promise<UtilisateurConnecte & { role: RolePlateforme }> {
  const utilisateur = await sessionCourante();

  // Même réponse qu'à un membre ordinaire : 404, jamais « accès refusé ».
  if (!utilisateur || !peut(utilisateur.role, pouvoir)) notFound();

  return utilisateur;
}

/**
 * La porte d'un écran que plusieurs pouvoirs ouvrent.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI « AU MOINS UN » ET NON « TOUS »
 *
 * La file de modération mélange trois CMS qui n'exigent pas le même pouvoir :
 * Jobs et Services demandent `moderer_le_contenu`, les événements
 * `publier_du_contenu`. Exiger les deux fermerait l'écran au modérateur ET à
 * l'éditorial, c'est-à-dire à tout le monde sauf l'administrateur.
 *
 * Entrer ne veut donc pas dire tout voir : la file, elle, ne montre à chacun
 * que les types qu'il peut trancher (`typesRelusPar`). C'est la division
 * habituelle — la garde ouvre la porte, la requête borne ce qu'on trouve
 * derrière.
 *
 * 404 pour tout refus, comme partout ailleurs dans ce fichier.
 */
export async function exigerUnDesPouvoirs(
  ...pouvoirs: readonly Pouvoir[]
): Promise<UtilisateurConnecte & { role: RolePlateforme }> {
  const utilisateur = await sessionCourante();

  if (!utilisateur || !pouvoirs.some((p) => peut(utilisateur.role, p))) {
    notFound();
  }

  return utilisateur;
}
