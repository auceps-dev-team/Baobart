"use server";

import { revalidatePath } from "next/cache";

import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  peutRetirerCommentaire,
  verifierCommentaire,
  verifierSuivi,
} from "@/lib/social/regles";

/**
 * Aimer, suivre, commenter.
 *
 * Chaque geste et son compteur dénormalisé tiennent dans la **même
 * transaction** : un like enregistré sans être compté, ou compté sans être
 * enregistré, laisserait deux vérités contradictoires dans la base, et la
 * seconde est celle qu'on affiche partout.
 *
 * Les trois actions sont des bascules idempotentes du point de vue de
 * l'intention : redemander un like qu'on a déjà ne le double pas.
 */

export type Reponse =
  | { ok: true; actif: boolean; total: number }
  | { ok: false; message: string; connexion?: boolean };

const MESSAGE_CONNEXION = "Connecte-toi pour continuer.";

const CONNEXION = {
  ok: false as const,
  message: MESSAGE_CONNEXION,
  connexion: true,
};

// ────────────────────────────────────────────────────────────────── like ────

export async function basculerLike(produitId: string): Promise<Reponse> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) return CONNEXION;

  try {
    const resultat = await db.$transaction(async (tx) => {
      const produit = await tx.product.findUnique({
        where: { id: produitId },
        select: { id: true, slug: true, status: true },
      });

      // Une ressource non publiée n'existe pas pour le public : l'aimer
      // reviendrait à confirmer qu'un brouillon porte cet identifiant.
      if (!produit || produit.status !== "PUBLISHED") return null;

      const existant = await tx.like.findUnique({
        where: { userId_productId: { userId: utilisateur.id, productId: produitId } },
        select: { id: true },
      });

      if (existant) {
        await tx.like.delete({ where: { id: existant.id } });
      } else {
        await tx.like.create({
          data: { userId: utilisateur.id, productId: produitId },
        });
      }

      // Le compteur est recalculé à partir des lignes plutôt qu'incrémenté :
      // dans la même transaction, le COUNT est exact, et un compteur qui aurait
      // dérivé se remet d'aplomb au premier clic.
      const total = await tx.like.count({ where: { productId: produitId } });

      await tx.product.update({
        where: { id: produitId },
        data: { likesCount: total },
      });

      return { actif: !existant, total, slug: produit.slug };
    });

    if (!resultat) return { ok: false, message: "Ressource introuvable." };

    revalidatePath(`/products/${resultat.slug}`);
    revalidatePath("/dashboard/suivis");

    return { ok: true, actif: resultat.actif, total: resultat.total };
  } catch {
    return { ok: false, message: "Impossible d'enregistrer ton j'aime." };
  }
}

// ───────────────────────────────────────────────────────────────── suivi ────

export async function basculerSuivi(createurId: string): Promise<Reponse> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) return CONNEXION;

  const verdict = verifierSuivi({
    suiveurId: utilisateur.id,
    suiviId: createurId,
  });
  if (!verdict.accepte) {
    return { ok: false, message: verdict.message ?? "Suivi refusé." };
  }

  try {
    const resultat = await db.$transaction(async (tx) => {
      const cible = await tx.user.findUnique({
        where: { id: createurId },
        select: { id: true, suspendedAt: true },
      });
      if (!cible) return null;

      const existant = await tx.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: utilisateur.id,
            followingId: createurId,
          },
        },
        select: { id: true },
      });

      if (existant) {
        await tx.follow.delete({ where: { id: existant.id } });
      } else {
        await tx.follow.create({
          data: { followerId: utilisateur.id, followingId: createurId },
        });
      }

      const abonnes = await tx.follow.count({
        where: { followingId: createurId },
      });
      const abonnements = await tx.follow.count({
        where: { followerId: utilisateur.id },
      });

      await tx.user.update({
        where: { id: createurId },
        data: { followersCount: abonnes },
      });
      await tx.user.update({
        where: { id: utilisateur.id },
        data: { followingCount: abonnements },
      });

      return { actif: !existant, total: abonnes };
    });

    if (!resultat) return { ok: false, message: "Créateur introuvable." };

    revalidatePath("/dashboard/abonnements");

    return { ok: true, actif: resultat.actif, total: resultat.total };
  } catch {
    return { ok: false, message: "Impossible d'enregistrer ton suivi." };
  }
}

// ─────────────────────────────────────────────────────────── commentaire ────

export type ReponseCommentaire =
  | { ok: true }
  | { ok: false; message: string; connexion?: boolean; saisie?: string };

export async function publierCommentaire(
  produitId: string,
  _precedent: ReponseCommentaire | null,
  donnees: FormData,
): Promise<ReponseCommentaire> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) {
    return { ok: false, message: MESSAGE_CONNEXION, connexion: true };
  }

  const brut = String(donnees.get("corps") ?? "");
  const parentId = String(donnees.get("parentId") ?? "").trim() || null;

  // La profondeur du parent se lit en base : un identifiant fabriqué à la main
  // ne doit pas permettre d'enfiler les réponses sans fin.
  let profondeurParent: number | null = null;
  if (parentId) {
    const parent = await db.comment.findUnique({
      where: { id: parentId },
      select: { id: true, parentId: true, productId: true },
    });
    if (!parent || parent.productId !== produitId) {
      return { ok: false, message: "Commentaire introuvable.", saisie: brut };
    }
    profondeurParent = parent.parentId ? 1 : 0;
  }

  const verdict = verifierCommentaire({ corps: brut, profondeurParent });
  if (!verdict.accepte || !verdict.corps) {
    // La saisie repart avec le refus : React vide les champs non contrôlés à
    // la fin d'une action, et perdre son texte sur une règle de longueur est
    // inacceptable.
    return {
      ok: false,
      message: verdict.message ?? "Commentaire refusé.",
      saisie: brut,
    };
  }

  const corps = verdict.corps;

  try {
    const slug = await db.$transaction(async (tx) => {
      const produit = await tx.product.findUnique({
        where: { id: produitId },
        select: { slug: true, status: true },
      });
      if (!produit || produit.status !== "PUBLISHED") return null;

      await tx.comment.create({
        data: {
          authorId: utilisateur.id,
          productId: produitId,
          parentId,
          body: corps,
        },
      });

      const total = await tx.comment.count({
        where: { productId: produitId, deletedAt: null },
      });
      await tx.product.update({
        where: { id: produitId },
        data: { commentsCount: total },
      });

      return produit.slug;
    });

    if (!slug) {
      return { ok: false, message: "Ressource introuvable.", saisie: brut };
    }

    revalidatePath(`/products/${slug}`);
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "Impossible de publier ton commentaire.",
      saisie: brut,
    };
  }
}

export async function retirerCommentaire(
  commentaireId: string,
): Promise<{ ok: boolean; message?: string }> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) return { ok: false, message: MESSAGE_CONNEXION };

  const commentaire = await db.comment.findUnique({
    where: { id: commentaireId },
    select: {
      id: true,
      authorId: true,
      productId: true,
      deletedAt: true,
      product: { select: { slug: true, sellerId: true } },
    },
  });

  if (!commentaire || !commentaire.product || commentaire.deletedAt) {
    return { ok: false, message: "Commentaire introuvable." };
  }

  if (
    !peutRetirerCommentaire({
      userId: utilisateur.id,
      auteurId: commentaire.authorId,
      proprietaireId: commentaire.product.sellerId,
    })
  ) {
    return { ok: false, message: "Ce commentaire n'est pas le tien." };
  }

  await db.$transaction(async (tx) => {
    // Marqué retiré, pas effacé : supprimer la ligne emporterait par cascade
    // les réponses qui s'y accrochent.
    await tx.comment.update({
      where: { id: commentaire.id },
      data: { deletedAt: new Date(), body: "" },
    });

    const total = await tx.comment.count({
      where: { productId: commentaire.productId, deletedAt: null },
    });
    await tx.product.update({
      where: { id: commentaire.productId! },
      data: { commentsCount: total },
    });
  });

  revalidatePath(`/products/${commentaire.product.slug}`);
  return { ok: true };
}
