import { NextResponse } from "next/server";

import { cloreLesEcheances } from "@/lib/juridique/dossier";
import { journal } from "@/lib/observabilite/journal";

/**
 * Le passage qui clôt les dossiers juridiques dont l'échéance est passée.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SANS LUI, L'ÉCHÉANCE NE SERAIT QU'UNE PHRASE
 *
 * On écrit à l'auteur « tu as dix jours », et la page publique l'annonce. Si
 * personne ne repasse, le dossier reste en retrait provisoire indéfiniment :
 * le contenu ne revient pas — donc l'auteur est puni — et le notifiant n'a
 * jamais de réponse. Rien ne plante, et les deux parties attendent une
 * décision que personne ne prendra.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IL PEUT RATER SON TOUR SANS DÉGÂT
 *
 * La condition est « l'échéance est passée », jamais « c'est maintenant » :
 * chercher l'égalité perdrait tout dossier dont le terme tombe pendant une
 * panne. Un passage sauté rattrape au suivant.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UNE FOIS PAR JOUR SUFFIT
 *
 * Le délai se compte en jours, pas en heures. Descendre plus bas ferait
 * clore un dossier à trois heures du matin le jour même où il expire, quelques
 * minutes après que l'auteur s'est endormi en se disant qu'il répondrait
 * demain. Un jour de battement est en sa faveur, et il ne coûte rien au
 * notifiant.
 */

export const dynamic = "force-dynamic";

export const maxDuration = 60;

/**
 * Même garde que les autres routes d'ordonnanceur.
 *
 * 404 et non 401 : une route d'ordonnanceur n'a pas à confirmer son existence
 * à qui n'a pas le secret. La comparaison est à durée constante — `===` laisse
 * fuir la longueur du préfixe correct, et un secret se devine caractère par
 * caractère.
 */
function autorise(requete: Request): boolean {
  const attendu = process.env.CRON_SECRET;
  if (!attendu || attendu.length === 0) return false;

  const recu = requete.headers.get("authorization") ?? "";
  const voulu = `Bearer ${attendu}`;
  if (recu.length !== voulu.length) return false;

  let ecart = 0;
  for (let i = 0; i < voulu.length; i += 1) {
    ecart |= voulu.charCodeAt(i) ^ recu.charCodeAt(i);
  }
  return ecart === 0;
}

export async function GET(requete: Request) {
  if (!autorise(requete)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const bilan = await cloreLesEcheances();
    return NextResponse.json(bilan);
  } catch (cause) {
    // Le passage échoue, l'ordonnanceur le saura par le code de retour, et
    // les articles repartiront au tour suivant : rien n'est perdu.
    journal.erreur("passage juridique en échec", {
      cause: cause instanceof Error ? cause.message : String(cause),
    });
    return new NextResponse("Erreur", { status: 500 });
  }
}
