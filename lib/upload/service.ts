import "server-only";

import { db } from "@/lib/db";
import { ancienneCleDApercu, cleDApercu, produireApercu } from "@/lib/upload/apercu";
import {
  natureApercu,
  verifierApercu,
  verifierEnvoi,
} from "@/lib/upload/formats";
import {
  PREFIXE_PUBLIC,
  lireObjet,
  supprimerObjet,
  urlPublique,
} from "@/lib/upload/storage";
import type { Confirmation, RoleFichier } from "@/lib/upload/types";

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
      await supprimerObjet(cleDApercu(fichier.media.id));
      // Un aperçu d'avant le filigrane, s'il n'a pas encore été régénéré.
      await supprimerObjet(ancienneCleDApercu(fichier.media.id));
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

  // Les deux adresses : celle du filigrane, et celle d'avant, tant que
  // `scripts/regenerer-apercus.ts` n'est pas passé sur ce produit.
  const apercusRetires = [cleDApercu, ancienneCleDApercu].map((cle) =>
    urlPublique(cle(input.mediaRetire.id)),
  );
  if (!input.coverUrl || !apercusRetires.includes(input.coverUrl)) return;

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
        ? urlPublique(cleDApercu(suivant.media.id))
        : null,
      coverImageId: suivant?.media.id ?? null,
    },
  });
}

/** Le produit appartient-il bien à cette personne ? */
export async function produitDe(produitId: string, proprietaire: string) {

  const produit = await db.product.findUnique({
    where: { id: produitId },
    select: {
      id: true,
      sellerId: true,
      coverUrl: true,
      previewUrl: true,
      files: {
        where: { deletedAt: null },
        select: { id: true, role: true },
      },
    },
  });

  if (!produit || produit.sellerId !== proprietaire) return null;

  const sources = produit.files.filter((f) => f.role === "SOURCE").length;
  const apercus = produit.files.length - sources;

  return { produit, utilisateur: { id: proprietaire }, sources, apercus };
}

/**
 * Où l'objet atterrit — et donc qui peut le lire.
 *
 * Un extrait vidéo ou audio est servi tel quel au visiteur : il doit être
 * public. Une image d'aperçu, elle, reste privée comme les sources — c'est la
 * vignette dérivée qu'on publie, jamais l'originale, qui est souvent le fichier
 * vendu à peine recadré.
 */
export function prefixePour(role: RoleFichier, nomFichier: string): string {
  if (role === "PREVIEW" && natureApercu(nomFichier) !== "image") {
    return `${PREFIXE_PUBLIC}extraits/`;
  }
  return "produits/";
}

/**
 * La clé range-t-elle bien le fichier sous ce produit ?
 *
 * Les deux préfixes possibles finissent par `<produitId>/` — c'est ce segment
 * qui fait foi, pas ce que le navigateur redemande à la confirmation.
 */
function cleAppartientAu(cle: string, produitId: string): boolean {
  return (
    cle.startsWith(`produits/${produitId}/`) ||
    cle.startsWith(`${PREFIXE_PUBLIC}extraits/${produitId}/`)
  );
}

export async function confirmerFichierDe(
  userId: string,
  produitId: string,
  reservationId: string,
): Promise<Confirmation> {
  const contexte = await produitDe(produitId, userId);
  if (!contexte) return { ok: false, message: "Ressource introuvable." };

  const reservation = await db.uploadReservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      ownerId: true,
      status: true,
      purpose: true,
      filename: true,
      s3Key: true,
    },
  });

  if (!reservation || reservation.ownerId !== userId) {
    return { ok: false, message: "Envoi introuvable." };
  }
  if (reservation.status === "uploaded") {
    return { ok: false, message: "Cet envoi a déjà été enregistré." };
  }

  // La réservation a été signée pour **ce** produit : sa clé le porte. Confirmer
  // ailleurs rangerait le fichier sous le préfixe d'une autre ressource, et
  // supprimer celle-ci emporterait un fichier qui ne lui appartient pas.
  if (!cleAppartientAu(reservation.s3Key, produitId)) {
    return { ok: false, message: "Cet envoi ne concerne pas cette ressource." };
  }

  // Relu de la réservation, pas reçu du navigateur : la clé — publique ou
  // privée — a été scellée au moment de signer, le rôle doit s'accorder avec.
  const role: RoleFichier =
    reservation.purpose === "preview" ? "PREVIEW" : "SOURCE";

  // La vérité est au stockage, pas dans ce que le navigateur a annoncé.
  const depose = await lireObjet(reservation.s3Key);
  if (!depose) {
    return {
      ok: false,
      message: "Le fichier n'est pas arrivé au bout. Réessaie.",
    };
  }

  // Deuxième passage du contrôle, avec les vraies valeurs cette fois.
  const verdict = (role === "PREVIEW" ? verifierApercu : verifierEnvoi)({
    nom: reservation.filename,
    taille: depose.taille,
    mimeDeclare: depose.contentType,
  });

  if (!verdict.accepte) {
    await supprimerObjet(reservation.s3Key);
    await db.uploadReservation.update({
      where: { id: reservation.id },
      data: { status: "expired" },
    });
    return { ok: false, message: verdict.message ?? "Fichier refusé." };
  }

  const media = await db.mediaAsset.create({
    data: {
      ownerId: userId,
      purpose: role === "PREVIEW" ? "preview" : "product",
      s3Key: reservation.s3Key,
      checksum: depose.etag,
      sizeBytes: depose.taille,
      contentType: depose.contentType,
    },
    select: { id: true },
  });

  const fichier = await db.productFile.create({
    data: {
      productId: produitId,
      mediaId: media.id,
      filename: reservation.filename,
      sizeBytes: depose.taille,
      role,
      position: role === "PREVIEW" ? contexte.apercus : contexte.sources,
    },
    select: { id: true, filename: true, sizeBytes: true },
  });

  await db.uploadReservation.update({
    where: { id: reservation.id },
    data: { status: "uploaded", checksum: depose.etag },
  });

  const nature = natureApercu(reservation.filename);
  const estExtrait = role === "PREVIEW" && nature !== null && nature !== "image";

  // Un extrait vidéo ou audio se sert tel quel : rien à rendre, rien à
  // redimensionner. Tout le reste passe par la fabrique de vignettes, qui
  // peut échouer sans faire échouer l'envoi — la ressource existe, elle
  // affichera la trame en attendant.
  const apercu = estExtrait
    ? null
    : await produireApercu({
        mediaId: media.id,
        cleSource: reservation.s3Key,
        nomFichier: reservation.filename,
        taille: depose.taille,
        pseudo: await pseudoDe(userId),
      });

  await db.mediaAsset.update({
    where: { id: media.id },
    data: {
      status: "READY",
      width: apercu?.largeur ?? null,
      height: apercu?.hauteur ?? null,
    },
  });

  let couverture = contexte.produit.coverUrl;
  let extrait: { url: string; nature: "audio" | "video" } | null = null;

  if (estExtrait) {
    const url = urlPublique(reservation.s3Key);
    await db.product.update({
      where: { id: produitId },
      data: { previewUrl: url, previewKind: nature },
    });
    extrait = { url, nature: nature as "audio" | "video" };
  } else if (apercu) {
    // Une image déposée comme aperçu **remplace** la couverture : c'est un
    // choix explicite du créateur. Une vignette tirée d'un fichier source ne
    // fait que combler un vide — la vitrine ne doit pas changer dans son dos.
    if (role === "PREVIEW" || !couverture) {
      await db.product.update({
        where: { id: produitId },
        data: { coverUrl: apercu.url, coverImageId: media.id },
      });
      couverture = apercu.url;
    }
  }

  return {
    ok: true,
    fichier: {
      id: fichier.id,
      nom: fichier.filename,
      taille: fichier.sizeBytes,
      role,
    },
    couverture,
    extrait,
  };
}

/** Le pseudo public d'un créateur, pour le filigrane de ses aperçus. */
export async function pseudoDe(userId: string): Promise<string | null> {
  const profil = await db.profile.findUnique({ where: { userId }, select: { username: true } });
  return profil?.username ?? null;
}
