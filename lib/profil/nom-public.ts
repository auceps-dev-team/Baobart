/**
 * Le nom qu'une page ouverte à tous peut montrer d'un compte.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * JAMAIS L'ADRESSE
 *
 * Le repli `profile?.displayName ?? email` sert dans tout le dépôt. Il est
 * juste dans un écran privé — l'administration, le tableau de bord, un
 * courriel envoyé à la personne elle-même —, où l'adresse est déjà connue de
 * qui la lit. Sur une page publique, il publie une donnée personnelle : les
 * robots qui collectent les adresses la trouvent, et le JSON-LD d'un article
 * la remet aux moteurs de recherche.
 *
 * Mesuré le 13/11/2026 (B14) : neuf lectures publiques le faisaient. Elles
 * passent toutes par ici, et `lib/profil/nom-public.integration.test.ts` les
 * appelle une à une pour un compte sans profil.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * QUAND UN COMPTE N'A-T-IL PAS DE PROFIL ?
 *
 * Lu dans le code le 13/11/2026, non mesuré en production :
 *
 *   — l'inscription en crée toujours un (`lib/auth/actions.ts`) ;
 *   — l'effacement RGPD le supprime (`lib/rgpd/effacement.ts`) et remplace
 *     l'adresse par `efface-<id>@baobart.invalid` — sans retirer les offres,
 *     événements ou articles publiés par le compte ;
 *   — un compte créé par un autre chemin (script, import, et demain la
 *     connexion sociale du lot 9) n'en a pas, sauf si ce chemin y pense.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI ELLE NE PREND QUE LE PROFIL
 *
 * Pour qu'on ne puisse pas lui passer l'adresse en repli « juste ici ». Et la
 * requête qui l'appelle ne lit pas `email` du tout : une valeur qu'on n'a pas
 * chargée ne fuit par aucun champ ajouté plus tard.
 *
 * « Membre Baobart » est le repli que les commentaires et les témoignages
 * utilisaient déjà. Les maquettes ne dessinent pas ce cas.
 */

export const NOM_PAR_DEFAUT = "Membre Baobart";

export function nomPublic(
  profil: { displayName: string | null } | null | undefined,
): string {
  // `trim` : un nom fait d'espaces afficherait « par  » — un succès silencieux,
  // la page se rend et ne nomme personne.
  const nom = profil?.displayName?.trim();
  return nom ? nom : NOM_PAR_DEFAUT;
}
