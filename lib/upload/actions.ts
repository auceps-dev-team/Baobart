"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { produireApercu } from "@/lib/upload/apercu";
import { nomSur, verifierEnvoi } from "@/lib/upload/formats";
import {
  PREFIXE_PUBLIC,
  lireObjet,
  signerDepot,
  stockageConfigure,
  supprimerObjet,
  urlPublique,
} from "@/lib/upload/storage";

/**
 * Envoi de fichiers, en deux temps.
 *
 * 1. **Réserver** — on vérifie qui demande, ce qu'il annonce, et on renvoie une
 *    URL signée. Le fichier part du navigateur droit au stockage.
 * 2. **Confirmer** — on relit la taille et le type **depuis le stockage**, pas
 *    depuis le navigateur, et c'est cette lecture-là qu'on enregistre.
 *
 * Sans le second temps, n'importe qui pourrait annoncer un PNG de 2 Ko et
 * déposer autre chose : la signature contraint le type, pas le contenu.
 */

/** Au-delà, ce n'est plus une ressource mais une bibliothèque. */
const FICHIERS_MAX = 20;

export type Refus = { ok: false; message: string };
export type Reservation = {
  ok: true;
  reservationId: string;
  url: string;
  nom: string;
};

const HORS_SERVICE: Refus = {
  ok: false,
  message: "L'envoi de fichiers n'est pas disponible pour le moment.",
};

/** Le produit appartient-il bien à la personne connectée ? */
async function produitDe(produitId: string) {
  const utilisateur = await sessionCourante();
  if (!utilisateur) return null;

  const produit = await db.product.findUnique({
    where: { id: produitId },
    select: {
      id: true,
      sellerId: true,
      coverUrl: true,
      _count: { select: { files: true } },
    },
  });

  if (!produit || produit.sellerId !== utilisateur.id) return null;
  return { produit, utilisateur };
}

/**
 * Efface les envois abandonnés.
 *
 * Quelqu'un choisit un fichier de 180 Mo, ferme l'onglet pendant le transfert :
 * l'objet reste au stockage, facturé, sans que rien ne le rattache à une
 * ressource. Sans ce balayage, la facture monte toute seule.
 *
 * Passé à chaque nouvelle réservation, borné, et limité aux envois de la
 * personne : c'est elle qui vient d'en créer un, c'est le bon moment.
 */
async function balayerLesAbandons(ownerId: string): Promise<void> {
  const perimees = await db.uploadReservation.findMany({
    where: { ownerId, status: "pending", expiresAt: { lt: new Date() } },
    select: { id: true, s3Key: true },
    take: 20,
  });

  if (perimees.length === 0) return;

  await Promise.all(perimees.map((r) => supprimerObjet(r.s3Key)));

  await db.uploadReservation.updateMany({
    where: { id: { in: perimees.map((r) => r.id) } },
    data: { status: "expired" },
  });
}

export async function reserverFichier(
  produitId: string,
  fichier: { nom: string; taille: number; mime: string },
): Promise<Reservation | Refus> {
  if (!stockageConfigure()) return HORS_SERVICE;

  const contexte = await produitDe(produitId);
  if (!contexte) {
    return { ok: false, message: "Ressource introuvable." };
  }

  // Attendu, pas laissé en suspens : une promesse flottante peut être coupée
  // dès la réponse de l'action, et le ménage ne se ferait jamais. Le cas normal
  // est une requête indexée qui ne renvoie rien.
  await balayerLesAbandons(contexte.utilisateur.id).catch(() => {});

  if (contexte.produit._count.files >= FICHIERS_MAX) {
    return {
      ok: false,
      message: `Une ressource ne peut pas dépasser ${FICHIERS_MAX} fichiers. Regroupe-les dans une archive ZIP.`,
    };
  }

  const verdict = verifierEnvoi({
    nom: fichier.nom,
    taille: fichier.taille,
    mimeDeclare: fichier.mime,
  });

  if (!verdict.accepte || !verdict.format) {
    return { ok: false, message: verdict.message ?? "Fichier refusé." };
  }

  const propre = nomSur(fichier.nom);
  // L'identifiant précède le nom : deux fichiers homonymes ne s'écrasent pas,
  // et la clé reste lisible quand on ouvre le stockage à la main.
  const cle = `produits/${produitId}/${randomUUID()}-${propre}`;

  try {
    const depot = await signerDepot({ cle, contentType: verdict.format.mime });

    const reservation = await db.uploadReservation.create({
      data: {
        ownerId: contexte.utilisateur.id,
        purpose: "product",
        filename: fichier.nom.trim().slice(0, 180),
        byteSize: fichier.taille,
        // La somme de contrôle n'existe qu'après le dépôt : le stockage la
        // donne (ETag). On ne demande pas au navigateur de la calculer.
        checksum: "",
        s3Key: cle,
        presignedUrl: depot.url,
        expiresAt: depot.expireLe,
      },
      select: { id: true },
    });

    return {
      ok: true,
      reservationId: reservation.id,
      url: depot.url,
      nom: propre,
    };
  } catch {
    return HORS_SERVICE;
  }
}

export type Confirmation =
  | {
      ok: true;
      fichier: { id: string; nom: string; taille: number };
      couverture: string | null;
    }
  | Refus;

export async function confirmerFichier(
  produitId: string,
  reservationId: string,
): Promise<Confirmation> {
  const contexte = await produitDe(produitId);
  if (!contexte) return { ok: false, message: "Ressource introuvable." };

  const reservation = await db.uploadReservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      ownerId: true,
      status: true,
      filename: true,
      s3Key: true,
    },
  });

  if (!reservation || reservation.ownerId !== contexte.utilisateur.id) {
    return { ok: false, message: "Envoi introuvable." };
  }
  if (reservation.status === "uploaded") {
    return { ok: false, message: "Cet envoi a déjà été enregistré." };
  }

  // La vérité est au stockage, pas dans ce que le navigateur a annoncé.
  const depose = await lireObjet(reservation.s3Key);
  if (!depose) {
    return {
      ok: false,
      message: "Le fichier n'est pas arrivé au bout. Réessaie.",
    };
  }

  // Deuxième passage du contrôle, avec les vraies valeurs cette fois.
  const verdict = verifierEnvoi({
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
      ownerId: contexte.utilisateur.id,
      purpose: "product",
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
      position: contexte.produit._count.files,
    },
    select: { id: true, filename: true, sizeBytes: true },
  });

  await db.uploadReservation.update({
    where: { id: reservation.id },
    data: { status: "uploaded", checksum: depose.etag },
  });

  // L'aperçu peut échouer sans que l'envoi échoue : la ressource existe, elle
  // affichera la trame en attendant.
  const apercu = await produireApercu({
    mediaId: media.id,
    cleSource: reservation.s3Key,
    nomFichier: reservation.filename,
    taille: depose.taille,
  });

  await db.mediaAsset.update({
    where: { id: media.id },
    data: {
      status: "READY",
      width: apercu?.largeur ?? null,
      height: apercu?.hauteur ?? null,
    },
  });

  // Le premier aperçu produit devient la couverture. Les suivants ne la
  // remplacent pas : la vitrine ne doit pas changer dans le dos du créateur.
  let couverture = contexte.produit.coverUrl;
  if (apercu && !couverture) {
    await db.product.update({
      where: { id: produitId },
      data: { coverUrl: apercu.url, coverImageId: media.id },
    });
    couverture = apercu.url;
  }

  revalidatePath(`/dashboard/produits/${produitId}`);
  revalidatePath("/");
  revalidatePath("/explore");

  return { ok: true, fichier: { id: fichier.id, nom: fichier.filename, taille: fichier.sizeBytes }, couverture };
}

export async function retirerFichier(
  produitId: string,
  fichierId: string,
): Promise<{ ok: boolean; message?: string }> {
  const contexte = await produitDe(produitId);
  if (!contexte) return { ok: false, message: "Ressource introuvable." };

  const fichier = await db.productFile.findUnique({
    where: { id: fichierId },
    select: {
      id: true,
      productId: true,
      media: { select: { id: true, s3Key: true } },
    },
  });

  if (!fichier || fichier.productId !== produitId) {
    return { ok: false, message: "Fichier introuvable." };
  }

  await db.productFile.delete({ where: { id: fichier.id } });

  // Le média n'est supprimé que s'il ne sert plus à rien d'autre : le même
  // fichier peut être attaché ailleurs.
  const encoreUtilise = await db.productFile.count({
    where: { mediaId: fichier.media.id },
  });

  if (encoreUtilise === 0) {
    await db.mediaAsset.delete({ where: { id: fichier.media.id } });
    await supprimerObjet(fichier.media.s3Key);
    await supprimerObjet(`${PREFIXE_PUBLIC}apercus/${fichier.media.id}.webp`);
  }

  // Si c'était la couverture, on reprend celle du fichier suivant qui en a une.
  const cleApercuRetiree = urlPublique(
    `${PREFIXE_PUBLIC}apercus/${fichier.media.id}.webp`,
  );

  if (contexte.produit.coverUrl === cleApercuRetiree) {
    const suivant = await db.productFile.findFirst({
      where: { productId: produitId, media: { width: { not: null } } },
      orderBy: { position: "asc" },
      select: { media: { select: { id: true } } },
    });

    const remplacante = suivant
      ? urlPublique(`${PREFIXE_PUBLIC}apercus/${suivant.media.id}.webp`)
      : null;

    await db.product.update({
      where: { id: produitId },
      data: {
        coverUrl: remplacante,
        coverImageId: suivant?.media.id ?? null,
      },
    });
  }

  revalidatePath(`/dashboard/produits/${produitId}`);
  revalidatePath("/");
  revalidatePath("/explore");

  return { ok: true };
}
