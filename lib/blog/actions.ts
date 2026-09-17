"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import type { Geste } from "@/lib/cms/cycle";

import { MESSAGES_ECHEC, creer, modifier, trancher } from "@/lib/blog/redaction";
import type { Saisie } from "@/lib/blog/validation";

/**
 * Les gestes sur les articles.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * `publier_du_contenu`, ET RIEN D'AUTRE
 *
 * Le blog est le seul des quatre CMS qui reste fermé (§18.1) : il porte la
 * voix de Baobart, et un article signé du site engage le site. Pas de badge
 * qui ouvre, pas de portée à calculer — contrairement aux événements.
 *
 * Un module « use server » expose chacun de ses exports au navigateur. Les
 * gardes sont donc ici, pas dans les pages : cacher un formulaire ne ferme
 * rien.
 */

export type EtatFormulaire =
  | { ok: true }
  | { ok: false; message: string; champ?: string; saisie: Saisie };

export async function creerArticle(
  _precedent: EtatFormulaire | null,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const qui = await exigerLePouvoir("publier_du_contenu");
  const saisie = lireSaisie(donnees);

  const suite = await creer({ auteurId: qui.id, saisie });

  if (!suite.ok) {
    if (suite.motif === "REFUS") {
      return {
        ok: false,
        saisie,
        champ: suite.refus.champ,
        message: suite.refus.message,
      };
    }
    return { ok: false, saisie, message: MESSAGES_ECHEC[suite.motif] };
  }

  revalidatePath("/dashboard/blog");
  // On part sur la fiche d'édition : un article créé est un brouillon qu'on
  // veut relire avant de publier, pas une ligne de plus dans une liste.
  redirect(`/dashboard/blog/${suite.articleId}`);
}

export async function modifierArticle(
  articleId: string,
  _precedent: EtatFormulaire | null,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerLePouvoir("publier_du_contenu");
  const saisie = lireSaisie(donnees);

  const suite = await modifier({ articleId, saisie });

  if (!suite.ok) {
    if (suite.motif === "REFUS") {
      return {
        ok: false,
        saisie,
        champ: suite.refus.champ,
        message: suite.refus.message,
      };
    }
    return { ok: false, saisie, message: MESSAGES_ECHEC[suite.motif] };
  }

  revalidatePath("/dashboard/blog");
  revalidatePath(`/dashboard/blog/${articleId}`);
  revalidatePath("/blog");
  return { ok: true };
}

export type EtatGeste = { ok: boolean; message?: string };

export async function trancherArticle(
  articleId: string,
  geste: Geste,
): Promise<EtatGeste> {
  const qui = await exigerLePouvoir("publier_du_contenu");

  const suite = await trancher({ articleId, geste, acteurId: qui.id });

  rafraichir(articleId);

  return suite.ok ? { ok: true } : { ok: false, message: MESSAGES_ECHEC[suite.motif] };
}

/**
 * La même décision, mais depuis un formulaire.
 *
 * Même raison que pour les événements : un refus porte un texte, donc un
 * formulaire — c'est `useActionState`, dont la signature impose l'état
 * précédent et le `FormData`. Les autres gestes partent d'un clic.
 */
export async function trancherArticleAvecMotif(
  articleId: string,
  geste: Geste,
  _precedent: EtatGeste | null,
  donnees: FormData,
): Promise<EtatGeste> {
  const qui = await exigerLePouvoir("publier_du_contenu");

  const suite = await trancher({
    articleId,
    geste,
    acteurId: qui.id,
    motif: String(donnees.get("motif") ?? ""),
  });

  rafraichir(articleId);

  return suite.ok ? { ok: true } : { ok: false, message: MESSAGES_ECHEC[suite.motif] };
}

/**
 * Les quatre chemins qu'une décision touche.
 *
 * `/blog` et la fiche publique en font partie : publier un article sans
 * rafraîchir la liste publique le laisserait invisible jusqu'au prochain
 * passage du cache, ce qui se lit « la publication n'a pas marché ».
 */
function rafraichir(articleId: string): void {
  revalidatePath("/dashboard/moderation");
  revalidatePath("/dashboard/blog");
  revalidatePath(`/dashboard/blog/${articleId}`);
  revalidatePath("/blog");
}

/**
 * Ce que le formulaire a envoyé, renvoyé tel quel en cas de refus.
 *
 * React vide les champs non contrôlés à la fin d'une action serveur. Refaire
 * saisir un article de six mille signes pour un titre SEO trop long serait
 * cruel.
 */
function lireSaisie(donnees: FormData): Saisie {
  const lire = (nom: string) => String(donnees.get(nom) ?? "");
  return {
    titre: lire("titre"),
    corps: lire("corps"),
    extrait: lire("extrait"),
    categorieId: lire("categorieId"),
    couvertureUrl: lire("couvertureUrl"),
    seoTitre: lire("seoTitre"),
    seoDescription: lire("seoDescription"),
    urlCanonique: lire("urlCanonique"),
    aLaUne: lire("aLaUne"),
  };
}
