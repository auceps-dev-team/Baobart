"use server";

import { revalidatePath } from "next/cache";

import { consigner } from "@/lib/admin/audit";
import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import { enregistrerNumero, envoyerNumero, envoyerUnEssai, validerNumero } from "@/lib/infolettre/envoi";

/**
 * Les gestes de l'équipe sur la lettre : écrire, s'envoyer un essai, envoyer.
 * Le pouvoir est `promouvoir_du_contenu` — « sponsoring, sélections,
 * infolettres » — et chaque envoi va au journal d'audit.
 */

export type EtatNumero = { ok: true; message: string; id?: string } | { ok: false; message: string };

export async function enregistrerNumeroAction(id: string | null, _precedent: EtatNumero | null, donnees: FormData): Promise<EtatNumero> {
  const qui = await exigerLePouvoir("promouvoir_du_contenu");
  const v = validerNumero(String(donnees.get("sujet") ?? ""), String(donnees.get("corps") ?? ""));
  if (!v.ok) return v;

  const r = await enregistrerNumero({ id: id ?? undefined, sujet: v.sujet, corps: v.corps, parId: qui.id });
  if (!r.ok) return { ok: false, message: r.motif === "DEJA_ENVOYE" ? "Ce numéro est parti : il ne se réécrit plus." : "Ce numéro n'existe plus." };
  revalidatePath("/dashboard/infolettre");
  return { ok: true, message: id ? "Brouillon enregistré." : "Brouillon créé.", id: r.id };
}

const REFUS = {
  INTROUVABLE: "Ce numéro n'existe plus.",
  DEJA_ENVOYE: "Ce numéro est déjà parti.",
  SITE_NON_CONFIGURE: "L'envoi est indisponible : l'adresse du site ou le secret de signature manque.",
  AUCUN_ABONNE: "Aucune adresse confirmée : rien ne partirait.",
} as const;

export async function essaiNumeroAction(id: string): Promise<EtatNumero> {
  const qui = await exigerLePouvoir("promouvoir_du_contenu");
  const r = await envoyerUnEssai({ id, adresse: qui.email });
  if (!r.ok) return { ok: false, message: REFUS[r.motif] };
  return { ok: true, message: `Essai envoyé à ${qui.email}.` };
}

export async function envoyerNumeroAction(id: string, _precedent: EtatNumero | null, donnees: FormData): Promise<EtatNumero> {
  const qui = await exigerLePouvoir("promouvoir_du_contenu");
  // Un envoi ne se rattrape pas : la case est la seconde moitié du geste.
  if (donnees.get("confirme") === null) return { ok: false, message: "Coche la case pour confirmer l'envoi." };

  const r = await envoyerNumero({ id, parId: qui.id });
  if (!r.ok) return { ok: false, message: REFUS[r.motif] };
  await consigner({ acteurId: qui.id, action: "infolettre.envoyer", ressource: `newsletterIssue:${id}`, details: { destinataires: r.destinataires } });
  revalidatePath("/dashboard/infolettre");
  return { ok: true, message: `Parti : ${r.destinataires} courriel${r.destinataires > 1 ? "s" : ""} en file d'envoi.` };
}
