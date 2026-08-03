import "server-only";

import { db } from "@/lib/db";
import { PREFIXE_PUBLIC, supprimerObjet, urlPublique } from "@/lib/upload/storage";

/**
 * Retrait d'un fichier — la partie qui décide, sans session.
 *
 * Extrait des actions serveur pour la même raison que le social : ce qui lit
 * le cookie lui-même ne peut pas être exercé par un test, et ce qu'on ne peut
 * pas exercer, on ne peut pas affirmer correct.
 */

export type RetraitFichier =
  | { ok: true; efface: boolean }
  | { ok: false; message: string };

/**
 * Retire un fichier d'une ressource.
 *
 * Deux régimes, décidés par une seule question : cette ressource a-t-elle été
 * vendue ?
 *
 * - **Jamais vendue** — la ligne et l'objet partent pour de bon. Un brouillon
 *   raté ne doit pas encombrer le stockage indéfiniment.
 * - **Déjà vendue** — la ligne est marquée retirée, l'objet reste. Détruire
 *   les octets d'un fichier que des gens ont payé, sur un clic, ne se rattrape
 *   pas. Gumroad ne fait pas autrement : son `Deletable` masque le fichier,
 *   sans jamais l'effacer du stockage.
 *
 * Dans les deux cas le fichier cesse d'être servi, y compris à ceux qui l'ont
 * acheté — c'est aussi ce que fait `alive_product_files` chez Gumroad.
 */
export async function retirerFichierDe(input: {
  userId: string;
  produitId: string;
  fichierId: string;
}): Promise<RetraitFichier> {
  const produit = await db.product.findUnique({
    where: { id: input.produitId },
    select: {
      id: true,
      sellerId: true,
      coverUrl: true,
      previewUrl: true,
      _count: { select: { orderItems: true } },
    },
  });

  if (!produit || produit.sellerId !== input.userId) {
    return { ok: false, message: "Ressource introuvable." };
  }

  const fichier = await db.productFile.findUnique({
    where: { id: input.fichierId },
    select: {
      id: true,
      productId: true,
      deletedAt: true,
      media: { select: { id: true, s3Key: true } },
    },
  });

  if (!fichier || fichier.productId !== input.produitId || fichier.deletedAt) {
    return { ok: false, message: "Fichier introuvable." };
  }

  const dejaVendue = produit._count.orderItems > 0;

  if (dejaVendue) {
    await db.productFile.update({
      where: { id: fichier.id },
      data: { deletedAt: new Date() },
    });
  } else {
    await db.productFile.delete({ where: { id: fichier.id } });

    // Le média ne part que s'il ne sert plus à rien d'autre : le même fichier
    // peut être attaché ailleurs.
    const encoreUtilise = await db.productFile.count({
      where: { mediaId: fichier.media.id },
    });

    if (encoreUtilise === 0) {
      await db.mediaAsset.delete({ where: { id: fichier.media.id } });
      await supprimerObjet(fichier.media.s3Key);
      await supprimerObjet(`${PREFIXE_PUBLIC}apercus/${fichier.media.id}.webp`);
    }
  }

  await rendreLaVitrineCoherente({
    produitId: input.produitId,
    coverUrl: produit.coverUrl,
    previewUrl: produit.previewUrl,
    mediaRetire: fichier.media,
  });

  return { ok: true, efface: !dejaVendue };
}

/**
 * Remet la couverture et l'extrait d'accord avec ce qui reste.
 *
 * Sans ça, la grille continue de montrer la vignette d'un fichier retiré —
 * une image que plus rien ne sert.
 */
async function rendreLaVitrineCoherente(input: {
  produitId: string;
  coverUrl: string | null;
  previewUrl: string | null;
  mediaRetire: { id: string; s3Key: string };
}): Promise<void> {
  if (input.previewUrl === urlPublique(input.mediaRetire.s3Key)) {
    await db.product.update({
      where: { id: input.produitId },
      data: { previewUrl: null, previewKind: null },
    });
  }

  const apercuRetire = urlPublique(
    `${PREFIXE_PUBLIC}apercus/${input.mediaRetire.id}.webp`,
  );
  if (input.coverUrl !== apercuRetire) return;

  // `desc` sur le rôle : l'énumération liste SOURCE avant PREVIEW, et c'est
  // l'aperçu choisi à la main qui doit l'emporter.
  const suivant = await db.productFile.findFirst({
    where: {
      productId: input.produitId,
      deletedAt: null,
      media: { width: { not: null } },
    },
    orderBy: [{ role: "desc" }, { position: "asc" }],
    select: { media: { select: { id: true } } },
  });

  await db.product.update({
    where: { id: input.produitId },
    data: {
      coverUrl: suivant
        ? urlPublique(`${PREFIXE_PUBLIC}apercus/${suivant.media.id}.webp`)
        : null,
      coverImageId: suivant?.media.id ?? null,
    },
  });
}
