"use server";

import { revalidatePath } from "next/cache";

import { consigner, ressource } from "@/lib/admin/audit";
import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import { accorderStatut, retirerStatut } from "@/lib/badges/attribution";
import { lireGeste, statutDe, type CodeStatut } from "@/lib/badges/statuts";

/**
 * Accorder ou retirer un statut, depuis `/dashboard/systeme/statuts`.
 *
 * La garde exige `moderer_le_contenu`, le pouvoir que nomme
 * `lib/services/badges.ts` : accorder Freelance, c'est décider qui publie des
 * services. L'auteur vient de la session, jamais du formulaire, et la clé
 * reçue est relue par `lireGeste` : un module « use server » est joignable
 * sans passer par l'écran.
 */

export type EtatStatut = { ok: true; message: string } | { ok: false; message: string };

export async function agirSurUnStatut(
  userId: string,
  cle: string,
  _precedent: EtatStatut | null,
  donnees: FormData,
): Promise<EtatStatut> {
  const qui = await exigerLePouvoir("moderer_le_contenu");

  const geste = lireGeste(cle);
  if (!geste) return { ok: false, message: "Geste inconnu." };

  // Le motif est la provenance que la maquette demande sur la fiche admin :
  // « pourquoi ce compte est-il vérifié ? » se pose des mois plus tard.
  const motif = String(donnees.get("motif") ?? "").trim();
  if (motif.length < 4) return { ok: false, message: "Écris ce qui a été vérifié, ou pourquoi tu retires ce statut." };

  if (userId === qui.id) return { ok: false, message: "On ne s'accorde pas un statut à soi-même." };

  const nom = statutDe(geste.code).nom;
  let retire: CodeStatut | null = null;

  if (geste.sens === "ACCORDER") {
    const suite = await accorderStatut({ userId, code: geste.code });
    revalidatePath("/dashboard/systeme/statuts");
    if (!suite.ok) {
      return { ok: false, message: suite.motif === "DEJA_POSE" ? `« ${nom} » est déjà accordé.` : "Compte introuvable." };
    }
    retire = suite.retire;
  } else {
    const suite = await retirerStatut({ userId, code: geste.code });
    revalidatePath("/dashboard/systeme/statuts");
    if (!suite.ok) return { ok: false, message: `« ${nom} » n'était pas accordé.` };
  }

  // Après l'acte, et seulement s'il a eu lieu.
  await consigner({
    acteurId: qui.id,
    action: geste.sens === "ACCORDER" ? "statut.accorder" : "statut.retirer",
    ressource: ressource("user", userId),
    details: { statut: geste.code, motif, ...(retire ? { retire } : {}) },
  });

  return {
    ok: true,
    message:
      geste.sens === "ACCORDER"
        ? retire
          ? `« ${nom} » accordé, « ${statutDe(retire).nom} » retiré.`
          : `« ${nom} » accordé.`
        : `« ${nom} » retiré.`,
  };
}
