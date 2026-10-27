/**
 * Où mener quelqu'un qui vient de se connecter : `?suite=` de la connexion.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI CE MODULE EXISTE
 *
 * Dix-sept fichiers fabriquaient des liens `/connexion?suite=…` — le bouton
 * « Contact » d'une vitrine, « Postuler », « Déposer une offre »… — et la
 * connexion n'en lisait aucun : tout le monde atterrissait sur `/dashboard`
 * (relevé le 22/10, corrigé le 27/10). Le visiteur qui voulait écrire à un
 * créateur devait retrouver sa vitrine tout seul.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN CHEMIN DE CHEZ NOUS, ET RIEN D'AUTRE
 *
 * Suivre `suite` sans le lire, c'est la redirection ouverte : un lien
 * `baobart.ci/connexion?suite=https://baobart-ci.com` ferait passer une vraie
 * page de connexion pour la porte d'un faux site. `locationSure`
 * (lib/http/redirection.ts) ne convient pas : elle accepte les adresses
 * absolues, voulues pour les liens d'annonceurs.
 *
 * Ici, seul un chemin passe. « //ailleurs.com » et « /\ailleurs.com » en ont
 * l'air et n'en sont pas : le navigateur les lit comme une adresse
 * extérieure. Les retours à la ligne et caractères de contrôle sont refusés
 * (un en-tête `Location` ne doit rien porter d'autre), et la connexion,
 * l'inscription et l'API aussi — y revenir ferait une boucle ou appellerait un
 * point d'entrée qui n'est pas une page.
 *
 * Module pur : la page qui pré-remplit le champ et l'action qui le relit
 * appellent la même fonction, et l'action ne fait pas confiance à la page.
 */

import type { Route } from "next";

export const DESTINATION_PAR_DEFAUT: Route = "/dashboard";

const LONGUEUR_MAX = 512;
/** Refusés avec tout ce qu'il y a dessous : `/connexion/verification` aussi. */
const INTERDITS = ["/connexion", "/inscription", "/api"];

/**
 * Le chemin, s'il est sûr d'y mener ; `null` sinon.
 *
 * Rendu comme `Route` : les routes typées de Next ne savent pas qu'une chaîne
 * lue dans une adresse est un chemin. C'est cette fonction qui le vérifie —
 * le transtypage est à sa place ici, et nulle part ailleurs.
 */
export function suiteSure(brut: unknown): Route | null {
  if (typeof brut !== "string") return null;
  const chemin = brut.trim();
  if (chemin.length < 1 || chemin.length > LONGUEUR_MAX) return null;
  if (!chemin.startsWith("/")) return null;
  // `//hote` et `/\hote` : une adresse extérieure qui se déguise en chemin.
  if (chemin[1] === "/" || chemin.includes("\\")) return null;
  // Espaces, retours à la ligne, caractères de contrôle : rien de cela dans
  // un chemin qu'on écrit soi-même, tout cela dans un en-tête qu'on forge.
  if (/[\s\u0000-\u001f\u007f]/.test(chemin)) return null;
  const page = chemin.split(/[?#]/)[0]!;
  if (INTERDITS.some((i) => page === i || page.startsWith(`${i}/`))) return null;
  return chemin as Route;
}

/** Là où mener après la connexion : la suite demandée, ou le tableau de bord. */
export function destination(brut: unknown): Route {
  return suiteSure(brut) ?? DESTINATION_PAR_DEFAUT;
}
