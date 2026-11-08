import { NextResponse } from "next/server";

import { designerLesCreateursDuMois } from "@/lib/badges/createur-du-mois";
import { journal } from "@/lib/observabilite/journal";
import { ordonnanceurAutorise, reponseIntrouvable } from "@/lib/securite/cron";

/**
 * Le passage qui désigne les créateurs du mois (`lib/badges/createur-du-mois.ts`).
 *
 * Une fois par jour suffit : le classement porte sur trente jours glissants,
 * et un jour de retard ne fait perdre à personne un titre qui court encore
 * trente jours. S'il ne tournait pas, aucun titre ne serait posé ni prolongé,
 * et ceux qui courent s'éteindraient à leur date : un défaut visible, pas un
 * titre usurpé.
 */

export const dynamic = "force-dynamic";

export const maxDuration = 60;

export async function GET(requete: Request) {
  if (!ordonnanceurAutorise(requete)) {
    return reponseIntrouvable();
  }

  try {
    const bilan = await designerLesCreateursDuMois();
    if (bilan.nommes > 0 || bilan.prolonges > 0) {
      journal.info("créateurs du mois", { ...bilan });
    }
    return NextResponse.json(bilan);
  } catch (cause) {
    journal.erreur("passage des créateurs du mois en échec", {
      cause: cause instanceof Error ? cause.message : String(cause),
    });
    return new NextResponse("Erreur", { status: 500 });
  }
}
