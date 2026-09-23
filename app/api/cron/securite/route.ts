import { NextResponse } from "next/server";

import { journal } from "@/lib/observabilite/journal";
import { purgerExpirees } from "@/lib/securite/blocklist";
import { ordonnanceurAutorise, reponseIntrouvable } from "@/lib/securite/cron";

/**
 * Le passage qui récupère les blocages expirés.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IL NE CHANGE RIEN À QUI EST BLOQUÉ
 *
 * C'est ce qui le distingue des cinq autres passages, et il faut le dire
 * franchement : `estBloque` filtre déjà sur `expiresAt` **à la lecture**. Une
 * entrée périmée ne bloque plus personne, que ce passage ait tourné ou non.
 *
 * S'il ne tournait pas pendant un mois, personne ne resterait bloqué un mois
 * de trop. La seule conséquence serait une table qui grossit.
 *
 * L'inverse aurait été tentant — ne filtrer qu'ici, et laisser la lecture
 * simple — et aurait marché tant que l'ordonnanceur tourne. Un défaut qui
 * dépend d'un cron pour ne pas se produire n'est pas un défaut moins grave :
 * c'est un défaut qui attend une panne.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI IL EXISTE QUAND MÊME
 *
 * Une adresse est bloquée six mois. À raison de quelques blocages par jour, la
 * table se remplit de lignes que plus rien ne lit — et l'écran d'administration
 * devient illisible bien avant que la base ne souffre.
 *
 * Une fois par jour suffit largement pour du ménage.
 */

export const dynamic = "force-dynamic";

export const maxDuration = 60;

export async function GET(requete: Request) {
  if (!ordonnanceurAutorise(requete)) {
    return reponseIntrouvable();
  }

  try {
    const retirees = await purgerExpirees();

    if (retirees > 0) {
      journal.info("blocages expirés récupérés", { retirees });
    }

    return NextResponse.json({ retirees });
  } catch (cause) {
    journal.erreur("passage de sécurité en échec", {
      cause: cause instanceof Error ? cause.message : String(cause),
    });
    return new NextResponse("Erreur", { status: 500 });
  }
}
