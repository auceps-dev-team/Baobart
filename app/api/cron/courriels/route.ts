import { NextResponse } from "next/server";

import { journal } from "@/lib/observabilite/journal";
import { vider } from "@/lib/email/outbox";
import {
  ordonnanceurAutorise,
  reponseIntrouvable,
} from "@/lib/securite/cron";

/**
 * Le passage qui vide la file des courriels.
 *
 * La file existe pour découpler l'envoi du fait qui le justifie ; encore
 * faut-il que quelqu'un la vide. Sans cette route, les intentions
 * s'accumuleraient sans que rien ne parte — et l'inscription, qui dépose
 * désormais un message de bienvenue, remplirait une file inerte.
 *
 * Toutes les cinq minutes : un message transactionnel qui met un quart d'heure
 * à arriver donne l'impression d'un service en panne, et un lien de
 * réinitialisation expire.
 */

export const dynamic = "force-dynamic";

// Vingt messages, chacun pouvant attendre dix secondes son expéditeur : le
// défaut de dix secondes ne suffirait pas au premier lot un peu lent.
export const maxDuration = 60;

export async function GET(requete: Request) {
  if (!ordonnanceurAutorise(requete)) {
    return reponseIntrouvable();
  }

  const passage = await vider();

  // Un passage vide est le cas normal : ne le journaliser que s'il s'est
  // passé quelque chose évite de noyer les incidents sous la routine.
  if (passage.traites > 0) {
    journal.info("file des courriels vidée", { ...passage });
  }

  if (passage.abandonnes > 0) {
    journal.erreur("courriels abandonnés pendant le passage", {
      nombre: passage.abandonnes,
      pilote: passage.pilote,
    });
  }

  return NextResponse.json(passage);
}
