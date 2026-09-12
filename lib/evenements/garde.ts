import "server-only";

import { notFound } from "next/navigation";

import type { UtilisateurConnecte } from "@/lib/auth/session";
import { sessionCourante } from "@/lib/auth/session";
import { lireQualifications } from "@/lib/services/qualifications";

import { porteeDe, type Portee } from "@/lib/evenements/acces";

/**
 * La porte des écrans Événements.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ELLE REMPLACE `exigerLePouvoir("publier_du_contenu")`
 *
 * C'était la garde jusqu'à v1.50.0, et elle disait la vérité tant que les
 * événements appartenaient à l'administration. Elle ferme désormais la porte à
 * ceux qu'on vient précisément d'inviter.
 *
 * Cette garde répond à deux questions d'un coup — « entres-tu ? » et
 * « jusqu'où vois-tu ? » — et c'est volontaire. Les séparer laisserait écrire
 * un écran qui vérifie la première et oublie la seconde ; celui-là rendrait la
 * liste complète à une agence, sans erreur nulle part.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 404, JAMAIS « ACCÈS REFUSÉ »
 *
 * Même règle que `lib/auth/acces-administration.ts` : répondre « accès
 * refusé » confirme qu'il y a quelque chose à forcer.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX LECTURES DE PLUS, ET SEULEMENT POUR CEUX QUI EN ONT BESOIN
 *
 * Lire le badge et l'abonnement coûte deux requêtes. On ne les fait donc pas
 * quand la session porte déjà `publier_du_contenu` : le module pur tranche
 * avant, et `lireQualifications` n'est appelé que pour les autres.
 *
 * C'est la même paresse que `porteeDe`, qui teste le pouvoir avant le badge —
 * sauf qu'ici elle économise des allers-retours, pas seulement des `if`.
 */

export interface Acces {
  utilisateur: UtilisateurConnecte;
  portee: Portee;
}

/** Entre, ou 404. Rend la portée avec laquelle tout le reste doit travailler. */
export async function exigerAccesAuxEvenements(): Promise<Acces> {
  const acces = await accesAuxEvenements();
  if (!acces) notFound();
  return acces;
}

/**
 * La même chose, sans lever.
 *
 * Sert aux endroits qui doivent répondre autrement qu'avec une page — la route
 * d'export CSV, qui rend un 404 nu, et la barre latérale, qui se contente de
 * ne pas afficher l'entrée.
 */
export async function accesAuxEvenements(): Promise<Acces | null> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) return null;

  // Le chemin court : l'administration n'a ni badge ni abonnement à lire.
  const direct = porteeDe({
    id: utilisateur.id,
    role: utilisateur.role,
    badgeProfessionnel: false,
    abonnementOuvert: false,
  });
  if (direct) return { utilisateur, portee: direct };

  const qualifs = await lireQualifications(utilisateur.id);

  const portee = porteeDe({
    id: utilisateur.id,
    role: utilisateur.role,
    badgeProfessionnel: qualifs.badgeProfessionnel,
    abonnementOuvert: qualifs.abonnementOuvert,
  });

  return portee ? { utilisateur, portee } : null;
}
