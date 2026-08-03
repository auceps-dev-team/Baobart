/**
 * Formes partagées entre l'action serveur et le service.
 *
 * Elles ne peuvent pas vivre dans le module `"use server"` : chacun de ses
 * exports devient un point d'entrée appelable depuis le navigateur, et ce
 * n'est pas ce qu'on veut d'un type.
 */

/**
 * Deux natures de dépôt.
 *
 * `SOURCE` est ce que l'acheteur reçoit : privé, servi plus tard contre une
 * URL signée. `PREVIEW` est ce que tout le monde voit — l'image de la grille,
 * ou l'extrait qu'on écoute avant d'acheter.
 */
export type RoleFichier = "SOURCE" | "PREVIEW";

export type Refus = { ok: false; message: string };

export type Reservation = {
  ok: true;
  reservationId: string;
  url: string;
  nom: string;
};

export type Confirmation =
  | {
      ok: true;
      fichier: { id: string; nom: string; taille: number; role: RoleFichier };
      couverture: string | null;
      extrait: { url: string; nature: "audio" | "video" } | null;
    }
  | Refus;
