"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { produireApercu } from "@/lib/upload/apercu";
import { retirerFichierDe } from "@/lib/upload/service";
import {
  natureApercu,
  nomSur,
  verifierApercu,
  verifierEnvoi,
} from "@/lib/upload/formats";
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

/** Une image de grille, un extrait vidéo, un extrait audio : trois suffisent. */
const APERCUS_MAX = 3;

/**
 * Deux natures de dépôt.
 *
 * `SOURCE` est ce que l'acheteur reçoit : privé, servi plus tard contre une URL
 * signée. `PREVIEW` est ce que tout le monde voit : l'image de la grille, ou
 * l'extrait qu'on écoute avant d'acheter.
 */
export type RoleFichier = "SOURCE" | "PREVIEW";

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
      previewUrl: true,
      files: {
        where: { deletedAt: null },
        select: { id: true, role: true },
      },
    },
  });

  if (!produit || produit.sellerId !== utilisateur.id) return null;

  const sources = produit.files.filter((f) => f.role === "SOURCE").length;
  const apercus = produit.files.length - sources;

  return { produit, utilisateur, sources, apercus };
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

/**
 * Où l'objet atterrit — et donc qui peut le lire.
 *
 * Un extrait vidéo ou audio est servi tel quel au visiteur : il doit être
 * public. Une image d'aperçu, elle, reste privée comme les sources — c'est la
 * vignette dérivée qu'on publie, jamais l'originale, qui est souvent le fichier
 * vendu à peine recadré.
 */
function prefixePour(role: RoleFichier, nomFichier: string): string {
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

export async function reserverFichier(
  produitId: string,
  fichier: { nom: string; taille: number; mime: string },
  role: RoleFichier = "SOURCE",
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

  const apercu = role === "PREVIEW";

  if (apercu && contexte.apercus >= APERCUS_MAX) {
    return {
      ok: false,
      message: `Trois aperçus au maximum : une image, un extrait vidéo, un extrait audio.`,
    };
  }
  if (!apercu && contexte.sources >= FICHIERS_MAX) {
    return {
      ok: false,
      message: `Une ressource ne peut pas dépasser ${FICHIERS_MAX} fichiers. Regroupe-les dans une archive ZIP.`,
    };
  }

  const verdict = (apercu ? verifierApercu : verifierEnvoi)({
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
  const cle = `${prefixePour(role, fichier.nom)}${produitId}/${randomUUID()}-${propre}`;

  try {
    const depot = await signerDepot({ cle, contentType: verdict.format.mime });

    const reservation = await db.uploadReservation.create({
      data: {
        ownerId: contexte.utilisateur.id,
        // Le rôle est retenu ici, pas redemandé au navigateur à la
        // confirmation : la clé publique ou privée est déjà scellée.
        purpose: apercu ? "preview" : "product",
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
      fichier: { id: string; nom: string; taille: number; role: RoleFichier };
      couverture: string | null;
      extrait: { url: string; nature: "audio" | "video" } | null;
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
      purpose: true,
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
      ownerId: contexte.utilisateur.id,
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

  revalidatePath(`/dashboard/produits/${produitId}`);
  revalidatePath("/");
  revalidatePath("/explore");

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

export async function retirerFichier(
  produitId: string,
  fichierId: string,
): Promise<{ ok: boolean; message?: string }> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) return { ok: false, message: "Connecte-toi pour continuer." };

  const resultat = await retirerFichierDe({
    userId: utilisateur.id,
    produitId,
    fichierId,
  });

  if (!resultat.ok) return resultat;

  revalidatePath(`/dashboard/produits/${produitId}`);
  revalidatePath("/");
  revalidatePath("/explore");

  return { ok: true };
}
