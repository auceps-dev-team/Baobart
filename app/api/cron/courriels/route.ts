import { NextResponse } from "next/server";

import { journal } from "@/lib/observabilite/journal";
import { vider } from "@/lib/email/outbox";

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

/**
 * Même garde que la route des versements.
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
    ecart |= recu.charCodeAt(i) ^ voulu.charCodeAt(i);
  }
  return ecart === 0;
}

export async function GET(requete: Request) {
  if (!autorise(requete)) {
    return new NextResponse("Not found", { status: 404 });
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
