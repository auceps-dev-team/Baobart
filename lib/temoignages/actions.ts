"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { consigner } from "@/lib/admin/audit";
import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import { sessionCourante } from "@/lib/auth/session";
import { motifAcceptable, validerTemoignage, type ChampTemoignage } from "@/lib/temoignages/regles";
import { proposer, retirerLeMien, trancher, type Decision } from "@/lib/temoignages/service";

/**
 * Les gestes sur les témoignages.
 *
 * Proposer est ouvert à tout membre connecté — c'est le principe décidé le
 * 04/10. Trancher exige `promouvoir_du_contenu` : l'administration et le
 * marketing, comme les bannières, parce qu'un témoignage publié est une mise
 * en avant de la plateforme.
 */

export type EtatProposition =
  | { ok: true }
  | { ok: false; message: string; champ?: ChampTemoignage; saisie: { corps: string; role: string } };

export async function proposerTemoignage(
  _precedent: EtatProposition | null,
  donnees: FormData,
): Promise<EtatProposition> {
  const qui = await sessionCourante();
  if (!qui) redirect("/connexion");

  const saisie = { corps: String(donnees.get("corps") ?? ""), role: String(donnees.get("role") ?? "") };
  const verdict = validerTemoignage({ ...saisie, accord: donnees.get("accord") !== null });
  if (!verdict.ok) return { ok: false, message: verdict.message, champ: verdict.champ, saisie };

  await proposer(qui.id, verdict.temoignage);
  revalidatePath("/dashboard/temoignage");
  revalidatePath("/dashboard/temoignages");
  revalidatePath("/");
  return { ok: true };
}

export async function retirerMonTemoignage(): Promise<void> {
  const qui = await sessionCourante();
  if (!qui) redirect("/connexion");
  await retirerLeMien(qui.id);
  revalidatePath("/dashboard/temoignage");
  revalidatePath("/dashboard/temoignages");
  revalidatePath("/");
}

export type EtatDecision = { ok: boolean; message?: string };

const MESSAGES = {
  INTROUVABLE: "Ce témoignage n'existe plus — son auteur l'a peut-être retiré.",
  PROPRE_TEMOIGNAGE: "C'est le tien : un autre membre de l'équipe doit le relire.",
  DEJA_TRANCHE: "Quelqu'un l'a déjà tranché entre-temps.",
} as const;

export async function trancherTemoignage(
  id: string,
  decision: Decision,
  _precedent: EtatDecision | null,
  donnees: FormData,
): Promise<EtatDecision> {
  const qui = await exigerLePouvoir("promouvoir_du_contenu");
  const motif = String(donnees.get("motif") ?? "");

  if (decision !== "PUBLIER" && !motifAcceptable(motif)) {
    return { ok: false, message: "Dis à l'auteur pourquoi, en une phrase : il pourra corriger." };
  }

  const issue = await trancher({ id, decision, moderateurId: qui.id, motif });
  if (!issue.ok) return { ok: false, message: MESSAGES[issue.motif] };

  await consigner({
    acteurId: qui.id,
    action: decision === "PUBLIER" ? "temoignage.publier" : decision === "REFUSER" ? "temoignage.refuser" : "temoignage.retirer",
    ressource: `testimonial:${id}`,
    details: decision === "PUBLIER" ? undefined : { motif: motif.trim() },
  });

  revalidatePath("/dashboard/temoignages");
  revalidatePath("/");
  return { ok: true };
}
