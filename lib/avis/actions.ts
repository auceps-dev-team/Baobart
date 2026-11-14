"use server";

import { revalidatePath } from "next/cache";

import { sessionCourante } from "@/lib/auth/session";
import { laisserUnAvis, MESSAGES_AVIS, MESSAGES_REPONSE, repondreAUnAvis, retirerSonAvis } from "@/lib/avis/service";

/**
 * Noter, retirer son avis, répondre — la couche qui sait qui est connecté.
 * Volontairement mince, comme `lib/social/actions.ts` : tout ce qui décide vit
 * dans `lib/avis/service.ts`, que les tests exercent sans contexte de requête.
 */

export type ReponseAvis = { ok: true; message: string } | { ok: false; message: string; connexion?: boolean };

const CONNEXION: ReponseAvis = { ok: false, message: "Connecte-toi pour continuer.", connexion: true };

export async function enregistrerAvis(produitId: string, _precedent: ReponseAvis | null, donnees: FormData): Promise<ReponseAvis> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) return CONNEXION;

  const suite = await laisserUnAvis({
    auteurId: utilisateur.id,
    produitId,
    note: donnees.get("note"),
    texte: donnees.get("texte"),
  });
  if (!suite.ok) return { ok: false, message: MESSAGES_AVIS[suite.motif] };

  revalidatePath(`/products/${suite.slug}`);
  return { ok: true, message: suite.nouveau ? "Merci, ton avis est publié." : "Ton avis est mis à jour." };
}

export async function supprimerAvis(produitId: string): Promise<ReponseAvis> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) return CONNEXION;

  const suite = await retirerSonAvis({ auteurId: utilisateur.id, produitId });
  if (!suite.ok) return { ok: false, message: "Aucun avis à retirer." };

  revalidatePath(`/products/${suite.slug}`);
  return { ok: true, message: "Ton avis est retiré." };
}

export async function enregistrerReponse(avisId: string, _precedent: ReponseAvis | null, donnees: FormData): Promise<ReponseAvis> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) return CONNEXION;

  const suite = await repondreAUnAvis({ vendeurId: utilisateur.id, avisId, texte: donnees.get("reponse") });
  if (!suite.ok) return { ok: false, message: MESSAGES_REPONSE[suite.motif] };

  revalidatePath(`/products/${suite.slug}`);
  revalidatePath("/dashboard/avis");
  return { ok: true, message: "Ta réponse est publiée." };
}
