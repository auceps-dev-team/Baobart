import { NextResponse } from "next/server";

import { purgerDefisExpires } from "@/lib/auth/deux-facteurs";
import { purgerCodesTelephone } from "@/lib/auth/telephone";
import { purgerDefisWebauthn } from "@/lib/auth/webauthn";
import { journal } from "@/lib/observabilite/journal";
import { executerLesEffacementsDus } from "@/lib/rgpd/effacement";
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
 * Les défis de double authentification sont le cas extrême du même problème :
 * ils vivent cinq minutes et une connexion en crée un. Après un mois, la table
 * ne contient plus que des lignes mortes.
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
    // Les deux ménages ensemble : ils tiennent le même raisonnement — le
    // filtrage se fait à la lecture, ceci ne récupère que des lignes — et
    // une seconde route n'apporterait qu'une seconde chose à oublier.
    const [blocages, defisTotp, defisCles, codesSms] = await Promise.all([
      purgerExpirees(),
      purgerDefisExpires(),
      purgerDefisWebauthn(),
      // Les codes envoyés par SMS : périmés en dix minutes, gardés une
      // journée pour enquêter, puis supprimés (`lib/auth/telephone.ts`).
      purgerCodesTelephone(),
    ]);
    const defis = defisTotp + defisCles + codesSms;

    // ══════════════════════════════════════════════════════════════════════
    // LES EFFACEMENTS APRÈS LE MÉNAGE, ET SÉPARÉMENT
    //
    // Ce n'est pas du ménage : c'est une écriture irréversible sur des
    // comptes réels. Le mettre dans le même `Promise.all` ferait qu'un
    // échec de purge de blocages annulerait des effacements déjà faits — ou
    // l'inverse.
    //
    // `executerLesEffacementsDus` isole déjà chaque compte : un effacement
    // qui échoue ne doit pas emporter les autres.
    const effacements = await executerLesEffacementsDus();

    if (blocages > 0 || defis > 0 || effacements.traites > 0) {
      journal.info("ménage de sécurité", {
        blocages,
        defis,
        effacements: effacements.traites,
      });
    }

    if (effacements.echecs > 0) {
      // En erreur, pas en info : une demande d'effacement qui n'aboutit pas
      // est une obligation légale non tenue, et le délai de réponse court.
      journal.erreur("effacements en échec", { combien: effacements.echecs });
    }

    return NextResponse.json({ blocages, defis, effacements });
  } catch (cause) {
    journal.erreur("passage de sécurité en échec", {
      cause: cause instanceof Error ? cause.message : String(cause),
    });
    return new NextResponse("Erreur", { status: 500 });
  }
}
