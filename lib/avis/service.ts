import "server-only";

import { aObtenu, lireNote, lireTexte, REPONSE_MAX, TEXTE_MAX } from "@/lib/avis/regles";
import { recompterAvis } from "@/lib/avis/recompte";
import { urlDuSite } from "@/lib/config/site";
import { db } from "@/lib/db";
import { notifier } from "@/lib/notifications/aiguilleur";

/**
 * Le courriel exige un lien absolu ; sans adresse du site, son rendu
 * échouerait. L'avis reste alors dans la cloche — même repli que
 * « Créateur du mois » (`lib/badges/createur-du-mois.ts`).
 */
function livraison(chemin: string, charge: Record<string, unknown>) {
  const base = urlDuSite();
  return base ? { charge: { ...charge, lien: `${base}${chemin}` } } : { canaux: ["IN_APP" as const] };
}

/**
 * Écrire, modifier, retirer un avis ; y répondre. Qui est connecté : l'appelant
 * (`lib/avis/actions.ts`). Ce module tranche, avec un identifiant explicite,
 * pour que les tests l'exercent sans contexte de requête — la même découpe que
 * `lib/social/service.ts`.
 */

export type MotifAvis = "INTROUVABLE" | "SA_RESSOURCE" | "NON_OBTENU" | "NOTE_INVALIDE" | "TEXTE_TROP_LONG";
export type SuiteAvis = { ok: true; slug: string; nouveau: boolean } | { ok: false; motif: MotifAvis };

export const MESSAGES_AVIS: Record<MotifAvis, string> = {
  INTROUVABLE: "Ressource introuvable.",
  SA_RESSOURCE: "On ne note pas sa propre ressource.",
  NON_OBTENU: "Seul qui a obtenu cette ressource peut la noter.",
  NOTE_INVALIDE: "Choisis une note de 1 à 5.",
  TEXTE_TROP_LONG: "Ton avis est trop long.",
};

async function lignesDe(auteurId: string, produitId: string) {
  return db.orderItem.findMany({
    where: { productId: produitId, order: { buyerId: auteurId } },
    select: {
      state: true,
      price: true,
      quantity: true,
      tipAmount: true,
      refundedAmount: true,
      chargebackAt: true,
      chargebackReversedAt: true,
      accessRevokedAt: true,
    },
  });
}

/**
 * Laisser son avis, ou modifier celui qu'on a déjà laissé.
 *
 * Le droit se relit à chaque écriture : une ressource remboursée entre-temps
 * ne se note plus. C'est la règle de Gumroad (`before_update`, qui bloque un
 * changement de note sur un achat qui ne compte plus).
 */
export async function laisserUnAvis(input: { auteurId: string; produitId: string; note: unknown; texte: unknown }): Promise<SuiteAvis> {
  const note = lireNote(input.note);
  if (note === null) return { ok: false, motif: "NOTE_INVALIDE" };
  const texte = lireTexte(input.texte, TEXTE_MAX);
  if (!texte.ok) return { ok: false, motif: "TEXTE_TROP_LONG" };

  const produit = await db.product.findUnique({
    where: { id: input.produitId },
    select: { slug: true, name: true, sellerId: true },
  });
  if (!produit) return { ok: false, motif: "INTROUVABLE" };
  if (produit.sellerId === input.auteurId) return { ok: false, motif: "SA_RESSOURCE" };
  if (!aObtenu(await lignesDe(input.auteurId, input.produitId))) return { ok: false, motif: "NON_OBTENU" };

  const { avisId, nouveau } = await db.$transaction(async (tx) => {
    const avant = await tx.productReview.findUnique({
      where: { authorId_productId: { authorId: input.auteurId, productId: input.produitId } },
      select: { id: true },
    });
    const avis = await tx.productReview.upsert({
      where: { authorId_productId: { authorId: input.auteurId, productId: input.produitId } },
      update: { rating: note, body: texte.texte },
      create: { authorId: input.auteurId, productId: input.produitId, rating: note, body: texte.texte },
      select: { id: true },
    });
    await recompterAvis(input.produitId, tx);
    return { avisId: avis.id, nouveau: avant === null };
  });

  // Prévenir le créateur d'un nouvel avis, pas de chaque retouche : la clé
  // porte l'avis, un second appel retombe dessus.
  if (nouveau) {
    await notifier({
      destinataireId: produit.sellerId,
      evenement: "AVIS_RECU",
      cle: `avis-${avisId}`,
      titre: `Nouvel avis ★ ${note} sur « ${produit.name} »`,
      corps: texte.texte ?? "Un avis sans commentaire, seulement une note.",
      lien: "/dashboard/avis",
      ...livraison("/dashboard/avis", { ressource: produit.name, note, ...(texte.texte ? { extrait: texte.texte } : {}) }),
    });
  }

  return { ok: true, slug: produit.slug, nouveau };
}

/** Retirer son propre avis. Toujours permis : c'est son texte. */
export async function retirerSonAvis(input: { auteurId: string; produitId: string }): Promise<{ ok: true; slug: string } | { ok: false }> {
  const produit = await db.product.findUnique({ where: { id: input.produitId }, select: { slug: true } });
  if (!produit) return { ok: false };
  const retire = await db.$transaction(async (tx) => {
    const { count } = await tx.productReview.deleteMany({ where: { authorId: input.auteurId, productId: input.produitId } });
    if (count > 0) await recompterAvis(input.produitId, tx);
    return count > 0;
  });
  return retire ? { ok: true, slug: produit.slug } : { ok: false };
}

export type MotifReponse = "INTROUVABLE" | "PAS_LE_CREATEUR" | "TEXTE_VIDE" | "TEXTE_TROP_LONG";
export type SuiteReponse = { ok: true; slug: string } | { ok: false; motif: MotifReponse };

export const MESSAGES_REPONSE: Record<MotifReponse, string> = {
  INTROUVABLE: "Avis introuvable.",
  PAS_LE_CREATEUR: "Seul le créateur de la ressource répond à ses avis.",
  TEXTE_VIDE: "Écris ta réponse.",
  TEXTE_TROP_LONG: "Ta réponse est trop longue.",
};

/**
 * Répondre à un avis reçu, ou modifier sa réponse. Une seule par avis : Gumroad
 * ne l'impose pas dans son modèle (`product_review_response.rb`), ici c'est le
 * schéma qui l'impose.
 *
 * « Introuvable » pour un avis qui n'est pas le sien comme pour un avis qui
 * n'existe pas ? Non : l'avis est public, dire qu'il existe n'apprend rien.
 */
export async function repondreAUnAvis(input: { vendeurId: string; avisId: string; texte: unknown }): Promise<SuiteReponse> {
  const texte = lireTexte(input.texte, REPONSE_MAX);
  if (!texte.ok) return { ok: false, motif: "TEXTE_TROP_LONG" };
  if (texte.texte === null) return { ok: false, motif: "TEXTE_VIDE" };

  const avis = await db.productReview.findUnique({
    where: { id: input.avisId },
    select: { id: true, authorId: true, product: { select: { slug: true, name: true, sellerId: true } }, response: { select: { id: true } } },
  });
  if (!avis) return { ok: false, motif: "INTROUVABLE" };
  if (avis.product.sellerId !== input.vendeurId) return { ok: false, motif: "PAS_LE_CREATEUR" };

  await db.productReviewResponse.upsert({
    where: { reviewId: avis.id },
    update: { body: texte.texte },
    create: { reviewId: avis.id, authorId: input.vendeurId, body: texte.texte },
  });

  // Comme Gumroad (`after_create_commit :notify_reviewer_via_email`) : on
  // prévient à la première réponse, pas à chaque retouche.
  if (!avis.response) {
    await notifier({
      destinataireId: avis.authorId,
      evenement: "REPONSE_AVIS",
      cle: `reponse-avis-${avis.id}`,
      titre: `Le créateur a répondu à ton avis sur « ${avis.product.name} »`,
      corps: texte.texte,
      lien: `/products/${avis.product.slug}#avis`,
      ...livraison(`/products/${avis.product.slug}#avis`, { ressource: avis.product.name, reponse: texte.texte }),
    });
  }

  return { ok: true, slug: avis.product.slug };
}
