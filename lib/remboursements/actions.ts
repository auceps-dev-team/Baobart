"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { consigner } from "@/lib/admin/audit";
import { peut } from "@/lib/auth/administration";
import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { MESSAGES_REFUS, MOTIF_MIN, REFUS_MIN } from "@/lib/remboursements/regles";
import { definirDelai, demander, trancher, type Decision } from "@/lib/remboursements/service";

/**
 * Les gestes des demandes de remboursement.
 *
 * Aucun ne prend d'identifiant d'acheteur, de créateur ou de rôle : tout est
 * lu depuis la session. Qui tranche, et à quel titre, se déduit de la demande
 * — le vendeur de la ligne est le créateur ; un autre compte ne peut trancher
 * qu'avec le pouvoir du support, et seulement passé le délai.
 */

export type EtatGeste = { ok: true; message: string } | { ok: false; message: string };

export async function demanderRemboursement(orderItemId: string, _precedent: EtatGeste | null, donnees: FormData): Promise<EtatGeste> {
  const qui = await sessionCourante();
  if (!qui) redirect("/connexion");

  const r = await demander({ acheteurId: qui.id, orderItemId, motif: String(donnees.get("motif") ?? "") });
  if (!r.ok) {
    if (r.motif === "MOTIF") return { ok: false, message: `Explique en quelques mots — ${MOTIF_MIN} caractères au moins.` };
    if (r.motif === "INTROUVABLE") return { ok: false, message: "Cet achat est introuvable." };
    return { ok: false, message: MESSAGES_REFUS[r.motif] };
  }
  revalidatePath("/dashboard/remboursements");
  return { ok: true, message: "Demande envoyée au créateur. Sans réponse de sa part sous sept jours, l'équipe Baobart tranchera." };
}

const MESSAGES_TRANCHAGE = {
  INTROUVABLE: "Cette demande est introuvable.",
  PAS_ENCORE_AU_SUPPORT: "Le créateur a encore le temps de répondre.",
  DEJA_TRANCHEE: "Quelqu'un a déjà tranché cette demande.",
  MOTIF_REQUIS: `Dis à l'acheteur pourquoi, en une phrase — ${REFUS_MIN} caractères au moins.`,
} as const;

export async function trancherDemande(demandeId: string, decision: Decision, _precedent: EtatGeste | null, donnees: FormData): Promise<EtatGeste> {
  const qui = await sessionCourante();
  if (!qui) redirect("/connexion");

  const d = await db.refundRequest.findUnique({ where: { id: demandeId }, select: { orderItem: { select: { product: { select: { sellerId: true } } } } } });
  if (!d) return { ok: false, message: MESSAGES_TRANCHAGE.INTROUVABLE };

  const createur = d.orderItem.product.sellerId === qui.id;
  if (!createur && !peut(qui.role, "traiter_les_litiges")) return { ok: false, message: MESSAGES_TRANCHAGE.INTROUVABLE };

  const r = await trancher({ demandeId, parId: qui.id, qualite: createur ? "CREATEUR" : "SUPPORT", decision, motif: String(donnees.get("motif") ?? "") });
  if (!r.ok) return { ok: false, message: r.motif === "REMBOURSEMENT_IMPOSSIBLE" ? r.message : MESSAGES_TRANCHAGE[r.motif] };

  if (!createur) {
    await consigner({
      acteurId: qui.id,
      action: decision === "ACCEPTER" ? "remboursement.accepter" : "remboursement.refuser",
      ressource: `refundRequest:${demandeId}`,
    });
  }
  revalidatePath("/dashboard/ventes/remboursements");
  revalidatePath("/dashboard/remboursements-a-trancher");
  return { ok: true, message: r.message };
}

export async function changerDelaiDeRemboursement(_precedent: EtatGeste | null, donnees: FormData): Promise<EtatGeste> {
  const qui = await sessionCourante();
  if (!qui) redirect("/connexion");

  const jours = Number(donnees.get("jours"));
  if (!(await definirDelai(qui.id, jours))) return { ok: false, message: "Choisis un délai de la liste." };
  revalidatePath("/dashboard/ventes/remboursements");
  return { ok: true, message: jours === 0 ? "Tes ressources n'acceptent plus de remboursement, pour les achats à venir." : `Délai réglé à ${jours} jours, pour les achats à venir.` };
}
