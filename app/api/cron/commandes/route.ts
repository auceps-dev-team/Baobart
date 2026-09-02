import { NextResponse } from "next/server";

import { journal } from "@/lib/observabilite/journal";
import { perimerCommandesOubliees } from "@/lib/payments/encaissement/reglement";
import { perimerPaiementsOublies } from "@/lib/abonnements/reglement";

/**
 * Le passage qui referme les commandes qu'aucun rappel n'a conclues.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI CETTE ROUTE EXISTE
 *
 * En mobile money, une commande s'ouvre puis attend le rappel de l'opérateur.
 * Beaucoup d'acheteurs n'iront pas au bout — invite manquée, code mal tapé,
 * téléphone hors réseau. Sans ce ménage, chacune de ces tentatives reste
 * ouverte à jamais.
 *
 * Ce n'est pas seulement inélégant : le compteur « commandes bloquées » de
 * l'écran Système ne redescendrait plus. Il finirait par afficher un grand
 * nombre permanent, et cesserait de signaler quoi que ce soit — au moment
 * précis où les rappels s'arrêteraient vraiment d'arriver, personne ne le
 * verrait.
 *
 * Une fois par jour suffit : la péremption est à vingt-quatre heures, bien
 * au-delà de tout rappel plausible.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ELLE FAIT AUSSI LE MÉNAGE DES RENOUVELLEMENTS
 *
 * Un renouvellement d'abonnement abandonné est exactement le même problème :
 * un paiement ouvert que personne ne conclut, avec la même péremption et le
 * même rythme. Lui donner sa propre route d'ordonnanceur ajouterait une entrée
 * de plus à configurer sur Vercel — donc une de plus à oublier, et un ménage
 * qui ne se ferait jamais sans que rien ne le dise.
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
    ecart |= recu.charCodeAt(i) ^ voulu.charCodeAt(i);
  }
  return ecart === 0;
}

export async function GET(requete: Request) {
  if (!autorise(requete)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const fermees = await perimerCommandesOubliees();
  const abonnements = await perimerPaiementsOublies();

  // Un passage vide est le cas normal. Ne journaliser que ce qui s'est passé
  // évite de noyer les incidents sous la routine.
  if (fermees > 0 || abonnements > 0) {
    journal.info("passage de ménage des paiements", { fermees, abonnements });
  }

  return NextResponse.json({ fermees, abonnements });
}
