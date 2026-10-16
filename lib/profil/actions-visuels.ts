"use server";

import { revalidatePath } from "next/cache";

import { sessionCourante } from "@/lib/auth/session";
import { estOuverte } from "@/lib/config/fonctionnalites";
import { db } from "@/lib/db";
import { VISUELS, type Visuel } from "@/lib/profil/visuels";
import {
  confirmerVisuelDe,
  reserverVisuelDe,
  retirerVisuelDe,
  type Refus,
  type ReservationVisuel,
  type VisuelConfirme,
} from "@/lib/profil/visuels-service";
import { stockageConfigure } from "@/lib/upload/storage";

/**
 * Les actions de la photo de profil et de la bannière — voir
 * `lib/profil/visuels-service.ts`.
 *
 * Le même interrupteur que l'envoi des ressources (`envoi_fichiers`) : fermer
 * le stockage pour un incident le ferme partout, et le message est le même.
 */

const HORS_SERVICE: Refus = { ok: false, message: "L'envoi de fichiers n'est pas disponible pour le moment." };

/** Un visuel connu, et rien d'autre : la valeur arrive du navigateur. */
function lu(visuel: string): Visuel | null {
  return (VISUELS as readonly string[]).includes(visuel) ? (visuel as Visuel) : null;
}

export async function reserverVisuel(
  visuel: string,
  fichier: { nom: string; taille: number; mime: string },
): Promise<ReservationVisuel | Refus> {
  const v = lu(visuel);
  if (!v) return { ok: false, message: "Envoi refusé." };
  if (!estOuverte("envoi_fichiers") || !stockageConfigure()) return HORS_SERVICE;

  const utilisateur = await sessionCourante();
  if (!utilisateur) return { ok: false, message: "Connecte-toi pour continuer." };

  try {
    return await reserverVisuelDe(utilisateur.id, v, {
      nom: String(fichier?.nom ?? ""),
      taille: Number(fichier?.taille ?? 0),
      mime: String(fichier?.mime ?? ""),
    });
  } catch {
    return HORS_SERVICE;
  }
}

export async function confirmerVisuel(visuel: string, reservationId: string): Promise<VisuelConfirme | Refus> {
  const v = lu(visuel);
  if (!v) return { ok: false, message: "Envoi refusé." };
  const utilisateur = await sessionCourante();
  if (!utilisateur) return { ok: false, message: "Connecte-toi pour continuer." };

  const resultat = await confirmerVisuelDe(utilisateur.id, v, String(reservationId));
  if (resultat.ok) await revaliderLaVitrine(utilisateur.id);
  return resultat;
}

export async function retirerVisuel(visuel: string): Promise<{ ok: true } | Refus> {
  const v = lu(visuel);
  if (!v) return { ok: false, message: "Retrait refusé." };
  const utilisateur = await sessionCourante();
  if (!utilisateur) return { ok: false, message: "Connecte-toi pour continuer." };

  const resultat = await retirerVisuelDe(utilisateur.id, v);
  if (resultat.ok) await revaliderLaVitrine(utilisateur.id);
  return resultat;
}

async function revaliderLaVitrine(userId: string): Promise<void> {
  revalidatePath("/dashboard/profil");
  const profil = await db.profile.findUnique({ where: { userId }, select: { username: true } });
  if (profil) revalidatePath(`/createurs/${profil.username}`);
}
