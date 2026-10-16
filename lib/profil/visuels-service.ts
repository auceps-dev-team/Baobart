import "server-only";

import { randomUUID } from "node:crypto";

import sharp from "sharp";

import { db } from "@/lib/db";
import {
  PIXELS_MAX,
  POIDS_MAX,
  REGLES,
  cleDOriginal,
  cleDeVisuel,
  cleDepuisAdresse,
  dimensionsVues,
  verifierAnnonce,
  verifierDimensions,
  type Visuel,
} from "@/lib/profil/visuels";
import {
  deposerObjet,
  lireObjet,
  signerDepot,
  supprimerObjet,
  telechargerObjet,
  urlPublique,
} from "@/lib/upload/storage";

/**
 * La photo de profil et la bannière, en deux temps — comme les fichiers d'une
 * ressource (`lib/upload/actions.ts`) :
 *
 * 1. **Réserver** : on vérifie ce qui est annoncé, on signe un dépôt. Le
 *    fichier part du navigateur droit au stockage privé.
 * 2. **Confirmer** : on relit le poids et le type **depuis le stockage**, on
 *    décode l'image pour en lire les vraies dimensions, on en tire la copie
 *    publiée, et l'original disparaît.
 *
 * Les règles (formats, tailles, clés) vivent dans `lib/profil/visuels.ts`.
 */

export type Refus = { ok: false; message: string };
export type ReservationVisuel = { ok: true; reservationId: string; url: string; mime: string };
export type VisuelConfirme = { ok: true; url: string };

const QUALITE = 82;

function but(visuel: Visuel): string {
  return `profil-${visuel}`;
}

/**
 * Les envois de photo abandonnés — onglet fermé pendant le transfert —
 * restent au stockage privé sans que rien ne les rattache. Même ménage que
 * `lib/upload/actions.ts`, borné, à chaque nouvelle réservation.
 */
async function balayerLesAbandons(userId: string): Promise<void> {
  const perimees = await db.uploadReservation.findMany({
    where: { ownerId: userId, status: "pending", purpose: { startsWith: "profil-" }, expiresAt: { lt: new Date() } },
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

export async function reserverVisuelDe(
  userId: string,
  visuel: Visuel,
  fichier: { nom: string; taille: number; mime: string },
): Promise<ReservationVisuel | Refus> {
  const verdict = verifierAnnonce(visuel, fichier);
  if (!verdict.ok) return verdict;

  await balayerLesAbandons(userId).catch(() => {});

  const cle = cleDOriginal(userId, randomUUID());
  const mime = fichier.mime.toLowerCase();
  const depot = await signerDepot({ cle, contentType: mime });

  const reservation = await db.uploadReservation.create({
    data: {
      ownerId: userId,
      purpose: but(visuel),
      filename: fichier.nom.trim().slice(0, 180),
      byteSize: fichier.taille,
      checksum: "",
      s3Key: cle,
      presignedUrl: depot.url,
      expiresAt: depot.expireLe,
    },
    select: { id: true },
  });

  return { ok: true, reservationId: reservation.id, url: depot.url, mime };
}

export async function confirmerVisuelDe(
  userId: string,
  visuel: Visuel,
  reservationId: string,
): Promise<VisuelConfirme | Refus> {
  const reservation = await db.uploadReservation.findUnique({
    where: { id: reservationId },
    select: { id: true, ownerId: true, status: true, purpose: true, filename: true, s3Key: true },
  });

  // La réservation est à lui, pour CE visuel, sous SON préfixe — relu de la
  // base, jamais du navigateur.
  if (
    !reservation ||
    reservation.ownerId !== userId ||
    reservation.purpose !== but(visuel) ||
    !reservation.s3Key.startsWith(`profils/${userId}/`)
  ) {
    return { ok: false, message: "Envoi introuvable." };
  }
  if (reservation.status !== "pending") {
    return { ok: false, message: "Cet envoi a déjà été traité." };
  }

  const abandonner = async (message: string): Promise<Refus> => {
    await supprimerObjet(reservation.s3Key);
    await db.uploadReservation.update({ where: { id: reservation.id }, data: { status: "expired" } });
    return { ok: false, message };
  };

  // La vérité est au stockage, pas dans ce que le navigateur a annoncé.
  const depose = await lireObjet(reservation.s3Key);
  if (!depose) return { ok: false, message: "Le fichier n'est pas arrivé au bout. Réessaie." };

  const annonce = verifierAnnonce(visuel, {
    nom: reservation.filename,
    taille: depose.taille,
    mime: depose.contentType,
  });
  if (!annonce.ok) return abandonner(annonce.message);

  const source = await telechargerObjet(reservation.s3Key, POIDS_MAX);
  if (!source) return abandonner("Le fichier n'a pas pu être relu. Réessaie.");

  const regle = REGLES[visuel];
  let rendu: Buffer;
  try {
    const image = sharp(source, { limitInputPixels: PIXELS_MAX });
    const meta = await image.metadata();
    // Le type du contenu, pas celui de l'étiquette : un fichier renommé en
    // .png qui contient autre chose s'arrête ici.
    if (meta.format !== "png" && meta.format !== "jpeg") {
      return abandonner(`${regle.titre} : PNG ou JPG seulement.`);
    }
    const [largeur, hauteur] = dimensionsVues(meta.width ?? 0, meta.height ?? 0, meta.orientation);
    const taille = verifierDimensions(visuel, largeur, hauteur);
    if (!taille.ok) return abandonner(taille.message);

    rendu = await image
      // L'orientation EXIF appliquée, puis oubliée avec le reste des
      // métadonnées : sharp n'en recopie aucune sans `withMetadata()`.
      .rotate()
      .resize({
        width: regle.sortie.largeur,
        height: regle.sortie.hauteur,
        fit: regle.sortie.ajustement,
        withoutEnlargement: true,
      })
      .webp({ quality: QUALITE })
      .toBuffer();
  } catch {
    // Illisible, tronqué, ou plus grand que PIXELS_MAX.
    return abandonner(`${regle.titre} : cette image n'a pas pu être lue.`);
  }

  const cle = cleDeVisuel(userId, visuel, randomUUID());
  await deposerObjet({ cle, corps: rendu, contentType: "image/webp" });
  const url = urlPublique(cle);

  const avant = await db.profile.findUnique({
    where: { userId },
    select: { avatarUrl: true, bannerUrl: true },
  });
  if (!avant) {
    await supprimerObjet(cle);
    return abandonner("Profil introuvable.");
  }

  await db.profile.update({
    where: { userId },
    data: visuel === "avatar" ? { avatarUrl: url } : { bannerUrl: url },
  });
  await db.uploadReservation.update({
    where: { id: reservation.id },
    data: { status: "uploaded", checksum: depose.etag },
  });

  // L'original n'a plus de raison d'exister, l'ancienne copie non plus. Après
  // l'écriture : si elle avait échoué, la vitrine pointerait encore dessus.
  await supprimerObjet(reservation.s3Key);
  const ancienne = cleDepuisAdresse(visuel === "avatar" ? avant.avatarUrl : avant.bannerUrl, userId);
  if (ancienne && ancienne !== cle) await supprimerObjet(ancienne);

  return { ok: true, url };
}

export async function retirerVisuelDe(userId: string, visuel: Visuel): Promise<{ ok: true } | Refus> {
  const avant = await db.profile.findUnique({
    where: { userId },
    select: { avatarUrl: true, bannerUrl: true },
  });
  if (!avant) return { ok: false, message: "Profil introuvable." };

  await db.profile.update({
    where: { userId },
    data: visuel === "avatar" ? { avatarUrl: null } : { bannerUrl: null },
  });
  const cle = cleDepuisAdresse(visuel === "avatar" ? avant.avatarUrl : avant.bannerUrl, userId);
  if (cle) await supprimerObjet(cle);
  return { ok: true };
}

/**
 * Les copies publiées d'un compte, pour l'effacement : la photo de quelqu'un
 * est une donnée personnelle, et la ligne `Profile` qui part ne l'emporte pas
 * du stockage. Seules les nôtres — une adresse rangée par la démonstration
 * n'est pas à supprimer.
 */
export function clesDesVisuels(
  userId: string,
  profil: { avatarUrl: string | null; bannerUrl: string | null } | null,
): string[] {
  if (!profil) return [];
  return [profil.avatarUrl, profil.bannerUrl]
    .map((a) => cleDepuisAdresse(a, userId))
    .filter((c): c is string => c !== null);
}
