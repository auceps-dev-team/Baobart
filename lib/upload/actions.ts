"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { estOuverte } from "@/lib/config/fonctionnalites";
import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  confirmerFichierDe,
  prefixePour,
  produitDe,
  retirerFichierDe,
} from "@/lib/upload/service";
import type {
  Confirmation,
  Refus,
  Reservation,
  RoleFichier,
} from "@/lib/upload/types";
import {
  nomSur,
  verifierApercu,
  verifierEnvoi,
} from "@/lib/upload/formats";
import {
  signerDepot,
  stockageConfigure,
  supprimerObjet,
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


const HORS_SERVICE: Refus = {
  ok: false,
  message: "L'envoi de fichiers n'est pas disponible pour le moment.",
};


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
  role: RoleFichier = "SOURCE",
): Promise<Reservation | Refus> {
  // Fermé par l'exploitant, ou stockage indisponible : même refus côté
  // vendeur. Distinguer les deux ne lui apprendrait rien qu'il puisse corriger.
  if (!estOuverte("envoi_fichiers")) return HORS_SERVICE;
  if (!stockageConfigure()) return HORS_SERVICE;

  const utilisateur = await sessionCourante();
  if (!utilisateur) return HORS_SERVICE;

  const contexte = await produitDe(produitId, utilisateur.id);
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


export async function confirmerFichier(
  produitId: string,
  reservationId: string,
): Promise<Confirmation> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) {
    return { ok: false, message: "Connecte-toi pour continuer." };
  }

  const resultat = await confirmerFichierDe(
    utilisateur.id,
    produitId,
    reservationId,
  );

  if (resultat.ok) {
    revalidatePath(`/dashboard/produits/${produitId}`);
    revalidatePath("/");
    revalidatePath("/explore");
  }

  return resultat;
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
