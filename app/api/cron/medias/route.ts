import { NextResponse } from "next/server";

import { balayerLesMedias } from "@/lib/medias/balayage";
import { adressesRangees, textesCitantDesMedias } from "@/lib/medias/references";
import { journal } from "@/lib/observabilite/journal";
import { ordonnanceurAutorise, reponseIntrouvable } from "@/lib/securite/cron";
import { listerObjets, stockageConfigure, supprimerObjet } from "@/lib/upload/storage";

/**
 * Le passage qui retire les médias abandonnés du blog et des bannières.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UN PASSAGE QUI PEUT ÊTRE ESSAYÉ À BLANC
 *
 * `?essai=1` rend la liste de ce qui serait retiré, sans rien supprimer. C'est
 * ce qu'on lance la première fois sur un stockage qu'on découvre — la
 * production, par exemple. Les gardes (délai, plafond, vérification de
 * l'extraction) sont décrites dans `lib/medias/balayage.ts`.
 *
 * Une fois par jour : un fichier abandonné ne coûte que de la place, et la
 * place ne presse pas.
 */

export const dynamic = "force-dynamic";

export const maxDuration = 60;

export async function GET(requete: Request) {
  if (!ordonnanceurAutorise(requete)) {
    return reponseIntrouvable();
  }

  if (!stockageConfigure()) {
    return NextResponse.json({ examines: 0, cites: 0, recents: 0, retires: 0, arret: "stockage non configuré" });
  }

  try {
    const bilan = await balayerLesMedias({
      lister: listerObjets,
      supprimer: supprimerObjet,
      textes: textesCitantDesMedias,
      attendues: adressesRangees,
      maintenant: new Date(),
      essai: new URL(requete.url).searchParams.get("essai") === "1",
    });

    // Un arrêt n'est pas un échec du passage — il a fait ce qu'il devait :
    // ne rien retirer dans le doute. Mais il doit se voir, d'où l'erreur au
    // journal : sinon les fichiers s'accumuleraient de nouveau sans bruit.
    if (bilan.arret) journal.erreur("balayage des médias arrêté", { arret: bilan.arret });

    return NextResponse.json(bilan);
  } catch (cause) {
    journal.erreur("passage des médias en échec", {
      cause: cause instanceof Error ? cause.message : String(cause),
    });
    return new NextResponse("Erreur", { status: 500 });
  }
}
