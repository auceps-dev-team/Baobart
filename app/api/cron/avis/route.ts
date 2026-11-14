import { NextResponse } from "next/server";

import { recompterTousLesAvis } from "@/lib/avis/recompte";
import { journal } from "@/lib/observabilite/journal";
import { ordonnanceurAutorise, reponseIntrouvable } from "@/lib/securite/cron";

/**
 * Le balayage nocturne des avis (`lib/avis/recompte.ts`).
 *
 * Un filet de sécurité, pas le chemin normal : chaque écriture d'avis, chaque
 * remboursement, litige ou accès retiré recompte déjà la ressource concernée.
 * Mais ces recomptes-là ne lèvent jamais — un remboursement fait reste fait —
 * et un recompte qui échoue en silence laisserait une note fausse. Une fois par
 * nuit, tout est recompté depuis les lignes.
 *
 * S'il ne tournait pas, rien ne casserait : les notes resteraient justes tant
 * que les recomptes immédiats réussissent. C'est un défaut qui attend une
 * panne, pas un défaut actif.
 */

export const dynamic = "force-dynamic";

export const maxDuration = 60;

export async function GET(requete: Request) {
  if (!ordonnanceurAutorise(requete)) {
    return reponseIntrouvable();
  }

  try {
    const ressources = await recompterTousLesAvis();
    if (ressources > 0) journal.info("avis recomptés", { ressources });
    return NextResponse.json({ ressources });
  } catch (cause) {
    journal.erreur("recompte nocturne des avis en échec", {
      cause: cause instanceof Error ? cause.message : String(cause),
    });
    return new NextResponse("Erreur", { status: 500 });
  }
}
