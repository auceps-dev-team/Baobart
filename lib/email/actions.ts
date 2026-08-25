"use server";

import { revalidatePath } from "next/cache";

import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import { abandonner, relancer } from "@/lib/email/outbox";
import { journal } from "@/lib/observabilite/journal";

/**
 * Les deux gestes d'exploitation sur la file.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI LA GARDE EST DANS L'ACTION, ET PAS SEULEMENT DANS LA PAGE
 *
 * Un module « use server » expose chacun de ses exports comme un point d'entrée
 * appelable depuis le navigateur. Cacher le bouton ne protège donc rien : la
 * fonction reste joignable par quiconque connaît son identifiant. La page cache
 * le bouton pour ne pas mentir sur ce qui est possible ; c'est ici que se
 * décide ce qui est permis.
 *
 * Aucune de ces fonctions ne prend d'identifiant d'utilisateur en paramètre —
 * ce serait offrir l'usurpation. La personne est lue depuis sa session.
 */

export async function relancerCourriel(id: string): Promise<void> {
  const qui = await exigerLePouvoir("agir_sur_l_exploitation");

  const fait = await relancer(id);

  // Journalisé dans les deux cas : une relance refusée mérite d'autant plus
  // d'être tracée qu'elle peut signaler quelqu'un qui essaie autre chose.
  journal.info(fait ? "courriel relancé" : "relance refusée", {
    courrielId: id,
    par: qui.email,
  });

  revalidatePath("/dashboard/systeme/emails");
}

export async function abandonnerCourriel(id: string): Promise<void> {
  const qui = await exigerLePouvoir("agir_sur_l_exploitation");

  const fait = await abandonner(id);

  journal.info(fait ? "courriel abandonné" : "abandon refusé", {
    courrielId: id,
    par: qui.email,
  });

  revalidatePath("/dashboard/systeme/emails");
}
