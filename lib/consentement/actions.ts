"use server";

import { cookies } from "next/headers";

import {
  COOKIE_CONSENTEMENT,
  DUREE_CONSENTEMENT_S,
  ecrireConsentement,
} from "@/lib/consentement/regles";
import { COOKIE_CLICS } from "@/lib/publicites/types";

/**
 * Enregistrer le choix du visiteur.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI LE SERVEUR, ET PAS `document.cookie`
 *
 * Refuser doit effacer `bb_pub` s'il existe déjà — et `bb_pub` est HttpOnly :
 * le JavaScript de la page ne peut ni le lire ni l'effacer. Seul le serveur
 * le peut. Un refus enregistré dans le navigateur, avec le cookie de mesure
 * toujours en place, serait un refus qui ne refuse rien.
 *
 * Le cookie de choix, lui, n'est pas HttpOnly : la bannière doit le lire pour
 * savoir s'il faut s'afficher. Il ne contient que le choix.
 *
 * Pas de garde : un visiteur anonyme a le droit de choisir, et le seul effet
 * possible est sur ses propres cookies.
 */
export async function enregistrerConsentement(mesurePub: boolean): Promise<void> {
  const magasin = await cookies();

  magasin.set(COOKIE_CONSENTEMENT, ecrireConsentement({ mesurePub }), {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DUREE_CONSENTEMENT_S,
  });

  if (!mesurePub) magasin.delete(COOKIE_CLICS);
}
