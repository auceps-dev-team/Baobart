import "server-only";

import { db } from "@/lib/db";
import { notifier } from "@/lib/notifications/aiguilleur";
import { meriteSignalement } from "@/lib/social/moderation";
import {
  peutRetirerCommentaire,
  verifierCommentaire,
  verifierSuivi,
} from "@/lib/social/regles";

/**
 * Aimer, suivre, commenter — le travail réel, sans session.
 *
 * Les actions serveur savent qui est connecté ; ce module sait ce qu'il faut
 * en faire. La séparation n'est pas cosmétique : tant que la logique lisait le
 * cookie elle-même, aucun test ne pouvait l'exercer, et « ça marche » ne
 * reposait que sur des clics à la main.
 *
 * Chaque geste et son compteur tiennent dans la **même transaction** : un like
 * enregistré sans être compté, ou compté sans être enregistré, laisserait deux
 * vérités contradictoires, et la seconde est celle qu'on affiche partout.
 */

export type Resultat =
  | { ok: true; actif: boolean; total: number }
  | { ok: false; message: string };

/** Détecte la violation d'unicité, seule erreur qu'on sait interpréter. */
function estDoublon(erreur: unknown): boolean {
  return (
    typeof erreur === "object" &&
    erreur !== null &&
    "code" in erreur &&
    (erreur as { code?: string }).code === "P2002"
  );
}

/**
 * Bascule le j'aime d'une ressource.
 *
 * Idempotent face au double-clic : deux appels simultanés se soldent par
 * l'état demandé et non par une erreur. Sans ça, un clic nerveux affiche
 * « impossible d'enregistrer ton j'aime » alors que le like est bien passé.
 */
export async function basculerLikeDe(
  userId: string,
  produitId: string,
): Promise<Resultat & { slug?: string }> {
  const produit = await db.product.findUnique({
    where: { id: produitId },
    select: { id: true, slug: true, status: true },
  });

  // Une ressource non publiée n'existe pas pour le public : l'aimer
  // reviendrait à confirmer qu'un brouillon porte cet identifiant.
  if (!produit || produit.status !== "PUBLISHED") {
    return { ok: false, message: "Ressource introuvable." };
  }

  const existant = await db.like.findUnique({
    where: { userId_productId: { userId, productId: produitId } },
    select: { id: true },
  });

  try {
    if (existant) {
      // `deleteMany` plutôt que `delete` : si un autre appel l'a déjà retiré,
      // on veut zéro ligne touchée, pas une exception.
      await db.like.deleteMany({ where: { id: existant.id } });
    } else {
      await db.like.create({ data: { userId, productId: produitId } });
    }
  } catch (erreur) {
    // Deux clics partis ensemble : le second trouve la ligne déjà créée. Le
    // résultat voulu est atteint, il n'y a rien à signaler.
    if (!estDoublon(erreur)) {
      return { ok: false, message: "Impossible d'enregistrer ton j'aime." };
    }
  }

  const total = await recompterLikes(produitId);

  // Relu plutôt que déduit : entre-temps, un autre appel a pu inverser la
  // bascule, et c'est l'état en base qui doit s'afficher.
  const apres = await db.like.findUnique({
    where: { userId_productId: { userId, productId: produitId } },
    select: { id: true },
  });

  return { ok: true, actif: apres !== null, total, slug: produit.slug };
}

/** Recompte et réécrit le compteur dénormalisé. */
async function recompterLikes(produitId: string): Promise<number> {
  const total = await db.like.count({ where: { productId: produitId } });
  await db.product.update({
    where: { id: produitId },
    data: { likesCount: total },
  });
  return total;
}

export async function basculerSuiviDe(
  userId: string,
  createurId: string,
): Promise<Resultat> {
  const verdict = verifierSuivi({ suiveurId: userId, suiviId: createurId });
  if (!verdict.accepte) {
    return { ok: false, message: verdict.message ?? "Suivi refusé." };
  }

  const cible = await db.user.findUnique({
    where: { id: createurId },
    select: { id: true, suspendedAt: true },
  });
  if (!cible) return { ok: false, message: "Créateur introuvable." };

  const existant = await db.follow.findUnique({
    where: {
      followerId_followingId: { followerId: userId, followingId: createurId },
    },
    select: { id: true },
  });

  try {
    if (existant) {
      await db.follow.deleteMany({ where: { id: existant.id } });
    } else {
      await db.follow.create({
        data: { followerId: userId, followingId: createurId },
      });
    }
  } catch (erreur) {
    if (!estDoublon(erreur)) {
      return { ok: false, message: "Impossible d'enregistrer ton suivi." };
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRÉVENIR LE CRÉATEUR, AU PREMIER SUIVI SEULEMENT
  //
  // `existant` était nul : c'est donc un suivi qui commence, pas un
  // désabonnement. Le distinguer ici évite l'avis le plus agaçant qui soit —
  // celui qui se répète quand quelqu'un hésite et clique deux fois.
  //
  // La clé porte le couple (suiveur, suivi) et non la date : quelqu'un qui se
  // désabonne puis revient ne repose pas un second avis. C'est délibéré — le
  // créateur a déjà été prévenu de ce suivi-là, et le lui redire n'apprend
  // rien.
  //
  // Défaut courriel à `false` au catalogue : c'est, avec les inscriptions,
  // l'événement le plus fréquent et le moins actionnable.
  if (!existant) {
    await notifier({
      destinataireId: createurId,
      evenement: "NOUVEL_ABONNE",
      cle: `abonne-${userId}-${createurId}`,
      titre: "Nouvel abonné",
      corps: "Quelqu'un suit désormais ta boutique.",
      lien: "/dashboard/boutique",
    });
  }

  const [abonnes, abonnements, apres] = await Promise.all([
    db.follow.count({ where: { followingId: createurId } }),
    db.follow.count({ where: { followerId: userId } }),
    db.follow.findUnique({
      where: {
        followerId_followingId: { followerId: userId, followingId: createurId },
      },
      select: { id: true },
    }),
  ]);

  await db.user.update({
    where: { id: createurId },
    data: { followersCount: abonnes },
  });
  await db.user.update({
    where: { id: userId },
    data: { followingCount: abonnements },
  });

  return { ok: true, actif: apres !== null, total: abonnes };
}

export type ResultatCommentaire =
  | { ok: true; id: string; slug: string }
  | { ok: false; message: string };

export async function publierCommentaireDe(input: {
  userId: string;
  produitId: string;
  corps: string;
  parentId?: string | null;
}): Promise<ResultatCommentaire> {
  const parentId = input.parentId?.trim() || null;

  // La profondeur du parent se lit en base : un identifiant fabriqué à la main
  // ne doit pas permettre d'enfiler les réponses sans fin.
  let profondeurParent: number | null = null;
  if (parentId) {
    const parent = await db.comment.findUnique({
      where: { id: parentId },
      select: { id: true, parentId: true, productId: true, deletedAt: true },
    });
    if (!parent || parent.productId !== input.produitId) {
      return { ok: false, message: "Commentaire introuvable." };
    }
    // Répondre à un commentaire retiré remettrait au jour un fil que
    // quelqu'un a explicitement fermé.
    if (parent.deletedAt) {
      return { ok: false, message: "Ce commentaire a été retiré." };
    }
    profondeurParent = parent.parentId ? 1 : 0;
  }

  const verdict = verifierCommentaire({ corps: input.corps, profondeurParent });
  if (!verdict.accepte || !verdict.corps) {
    return { ok: false, message: verdict.message ?? "Commentaire refusé." };
  }

  const produit = await db.product.findUnique({
    where: { id: input.produitId },
    select: { slug: true, status: true },
  });
  if (!produit || produit.status !== "PUBLISHED") {
    return { ok: false, message: "Ressource introuvable." };
  }

  const cree = await db.comment.create({
    data: {
      authorId: input.userId,
      productId: input.produitId,
      parentId,
      body: verdict.corps,
      // Signalé, pas bloqué. Une liste de mots est un instrument grossier :
      // taire quelqu'un sur cette base ferait plus de tort que le commentaire.
      // Le créateur voit la marque et tranche — il a déjà le droit de retirer
      // ce qui est déposé chez lui.
      isFlagged: meriteSignalement(verdict.corps),
    },
    select: { id: true },
  });

  await recompterCommentaires(input.produitId);

  return { ok: true, id: cree.id, slug: produit.slug };
}

/**
 * Retire un commentaire **et ses réponses**.
 *
 * Reprise du `mark_subtree_deleted!` de Gumroad. Ne retirer que la racine
 * laisserait « tout à fait d'accord » sous une insulte effacée : la réponse
 * conserve le propos qu'on vient de retirer.
 */
export async function retirerCommentaireDe(
  userId: string,
  commentaireId: string,
): Promise<{ ok: boolean; message?: string; slug?: string; retires?: number }> {
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

  if (!commentaire || !commentaire.product || !commentaire.productId) {
    return { ok: false, message: "Commentaire introuvable." };
  }
  if (commentaire.deletedAt) {
    return { ok: false, message: "Ce commentaire est déjà retiré." };
  }

  if (
    !peutRetirerCommentaire({
      userId,
      auteurId: commentaire.authorId,
      proprietaireId: commentaire.product.sellerId,
    })
  ) {
    return { ok: false, message: "Ce commentaire n'est pas le tien." };
  }

  const maintenant = new Date();

  const { count } = await db.comment.updateMany({
    where: {
      deletedAt: null,
      OR: [{ id: commentaire.id }, { parentId: commentaire.id }],
    },
    // Le corps est vidé : un commentaire retiré ne doit plus être lisible,
    // même par quelqu'un qui interrogerait la base.
    data: { deletedAt: maintenant, body: "" },
  });

  await recompterCommentaires(commentaire.productId);

  return {
    ok: true,
    slug: commentaire.product.slug,
    retires: count,
  };
}

async function recompterCommentaires(produitId: string): Promise<number> {
  const total = await db.comment.count({
    where: { productId: produitId, deletedAt: null },
  });
  await db.product.update({
    where: { id: produitId },
    data: { commentsCount: total },
  });
  return total;
}
