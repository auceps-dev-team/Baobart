"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sessionCourante } from "@/lib/auth/session";
import { validerCollection } from "@/lib/collections/regles";
import {
  collectionsPourEpingler,
  creer,
  epingler,
  modifier,
  supprimer,
} from "@/lib/collections/service";

/**
 * Les gestes sur les collections. Chacun relit la session : un module
 * « use server » expose ses exports au navigateur, et l'identité n'est jamais
 * un paramètre.
 */

export type EtatCollection =
  | { ok: true }
  | { ok: false; message: string; saisie: { titre: string; description: string; publique: boolean } };

function lire(donnees: FormData) {
  return {
    titre: String(donnees.get("titre") ?? ""),
    description: String(donnees.get("description") ?? ""),
    publique: donnees.get("publique") !== null,
  };
}

export async function creerCollection(_precedent: EtatCollection | null, donnees: FormData): Promise<EtatCollection> {
  const qui = await sessionCourante();
  if (!qui) redirect("/connexion");
  const saisie = lire(donnees);
  const verdict = validerCollection(saisie);
  if (!verdict.ok) return { ok: false, message: verdict.message, saisie };

  const id = await creer(qui.id, verdict.collection);
  revalidatePath("/dashboard/collections");
  redirect(`/dashboard/collections/${id}` as Route);
}

export async function modifierCollection(id: string, _precedent: EtatCollection | null, donnees: FormData): Promise<EtatCollection> {
  const qui = await sessionCourante();
  if (!qui) redirect("/connexion");
  const saisie = lire(donnees);
  const verdict = validerCollection(saisie);
  if (!verdict.ok) return { ok: false, message: verdict.message, saisie };
  if (!(await modifier(qui.id, id, verdict.collection))) {
    return { ok: false, message: "Cette collection n'existe plus, ou n'est pas la tienne.", saisie };
  }
  revalidatePath(`/dashboard/collections/${id}`);
  revalidatePath("/dashboard/collections");
  return { ok: true };
}

export async function supprimerCollection(id: string): Promise<void> {
  const qui = await sessionCourante();
  if (!qui) redirect("/connexion");
  await supprimer(qui.id, id);
  revalidatePath("/dashboard/collections");
  redirect("/dashboard/collections" as Route);
}

export type ChoixEpingle =
  | { ok: true; collections: { id: string; titre: string; partageeAvec: string | null; contient: boolean }[] }
  | { ok: false; connexion: true };

/** Ce que le choix « Épingler » affiche, chargé à l'ouverture seulement. */
export async function choixPourEpingler(produitId: string): Promise<ChoixEpingle> {
  const qui = await sessionCourante();
  if (!qui) return { ok: false, connexion: true };
  return { ok: true, collections: await collectionsPourEpingler(qui.id, produitId) };
}

export type ReponseEpingle = { ok: true; epinglee: boolean } | { ok: false; message: string };

const MESSAGES = {
  INTROUVABLE: "Cette collection n'existe plus.",
  INTERDIT: "Ce n'est pas ta collection.",
  RESSOURCE: "Cette ressource n'est plus publiée.",
} as const;

export async function basculerEpingle(boardId: string, produitId: string, ranger: boolean): Promise<ReponseEpingle> {
  const qui = await sessionCourante();
  if (!qui) return { ok: false, message: "Connecte-toi pour ranger une ressource." };
  const issue = await epingler(qui.id, boardId, produitId, ranger);
  if (!issue.ok) return { ok: false, message: MESSAGES[issue.motif] };
  revalidatePath(`/dashboard/collections/${boardId}`);
  revalidatePath("/dashboard/collections");
  return issue;
}

/** Créer une collection depuis le choix « Épingler », et y ranger la ressource d'un même geste. */
export async function creerEtEpingler(titre: string, produitId: string): Promise<ReponseEpingle & { boardId?: string }> {
  const qui = await sessionCourante();
  if (!qui) return { ok: false, message: "Connecte-toi pour ranger une ressource." };
  const verdict = validerCollection({ titre, description: "", publique: false });
  if (!verdict.ok) return { ok: false, message: verdict.message };
  const boardId = await creer(qui.id, verdict.collection);
  const issue = await epingler(qui.id, boardId, produitId, true);
  if (!issue.ok) return { ok: false, message: MESSAGES[issue.motif] };
  revalidatePath("/dashboard/collections");
  return { ...issue, boardId };
}
