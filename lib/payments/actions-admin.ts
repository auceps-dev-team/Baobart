"use server";

import { revalidatePath } from "next/cache";

import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import { journal } from "@/lib/observabilite/journal";
import {
  annulerVersement,
  confirmerVersement,
  echouerVersement,
  marquerVersementEnvoye,
  retournerVersement,
} from "@/lib/payments/versements";
import type { EtatVersement } from "@/lib/payments/supervision";

/**
 * Faire avancer un versement.
 *
 * La machine à huit états vit dans `versements.ts` avec sa règle d'or : un
 * versement annulé ou échoué rend ses soldes, qui repartiront au cycle suivant.
 * Ici on ne fait que l'autorisation et l'aiguillage.
 *
 * La garde exige `agir_sur_l_exploitation` : un lecteur simple voit l'écran
 * sans les boutons, et l'action refuse même si quelqu'un l'appelle sans passer
 * par eux — un module « use server » est joignable directement.
 */

export type EtatTransition =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function fairePasserVersement(
  payoutId: string,
  vers: EtatVersement,
  _precedent: EtatTransition | null,
  donnees: FormData,
): Promise<EtatTransition> {
  const qui = await exigerLePouvoir("agir_sur_l_exploitation");

  // La raison n'est pas décorative : un versement échoué sans motif oblige à
  // rouvrir le dossier chez l'opérateur pour savoir ce qui s'est passé.
  const raison = String(donnees.get("raison") ?? "").trim();
  const reference = String(donnees.get("reference") ?? "").trim();

  try {
    switch (vers) {
      case "PROCESSING":
        if (reference.length === 0) {
          return {
            ok: false,
            message: "Indique la référence de l'ordre chez l'opérateur.",
          };
        }
        await marquerVersementEnvoye(payoutId, reference);
        break;
      case "COMPLETED":
        await confirmerVersement(payoutId);
        break;
      case "FAILED":
        if (raison.length === 0) {
          return { ok: false, message: "Indique pourquoi l'ordre n'est pas passé." };
        }
        await echouerVersement(payoutId, raison);
        break;
      case "RETURNED":
        if (raison.length === 0) {
          return { ok: false, message: "Indique pourquoi l'argent est revenu." };
        }
        await retournerVersement(payoutId, raison);
        break;
      case "CANCELLED":
        if (raison.length === 0) {
          return { ok: false, message: "Indique pourquoi tu annules." };
        }
        await annulerVersement(payoutId, raison);
        break;
      default:
        // UNCLAIMED et REVERSED viennent de l'opérateur, jamais d'un clic :
        // les offrir laisserait croire qu'on peut décider à sa place.
        return { ok: false, message: "Cette transition ne se déclenche pas ici." };
    }
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Transition refusée.";
    journal.avertissement("transition de versement refusée", {
      payoutId,
      vers,
      par: qui.email,
      cause,
    });
    return { ok: false, message };
  }

  journal.info("versement passé à un nouvel état", {
    payoutId,
    vers,
    par: qui.email,
  });

  revalidatePath("/dashboard/systeme/versements");
  return { ok: true, message: `Versement passé à ${vers}.` };
}
