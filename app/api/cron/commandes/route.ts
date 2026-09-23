import { NextResponse } from "next/server";

import { journal } from "@/lib/observabilite/journal";
import { perimerCommandesOubliees } from "@/lib/payments/encaissement/reglement";
import { perimerPaiementsOublies } from "@/lib/abonnements/reglement";
import { purgerCandidaturesTerminees } from "@/lib/jobs/postuler";
import {
  ordonnanceurAutorise,
  reponseIntrouvable,
} from "@/lib/securite/cron";

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

export async function GET(requete: Request) {
  if (!ordonnanceurAutorise(requete)) {
    return reponseIntrouvable();
  }

  const fermees = await perimerCommandesOubliees();
  const abonnements = await perimerPaiementsOublies();
  // Efface les CV des candidatures dont l'offre s'est terminée. Le CV vit avec
  // l'offre — décision du 2 septembre 2026 : le candidat n'a rien à faire
  // pour que son fichier disparaisse à la clôture. Mutualisé sur ce cron
  // plutôt qu'une cinquième route à configurer et à oublier.
  const candidatures = (await purgerCandidaturesTerminees()).effacees;

  // Un passage vide est le cas normal. Ne journaliser que ce qui s'est passé
  // évite de noyer les incidents sous la routine.
  if (fermees > 0 || abonnements > 0 || candidatures > 0) {
    journal.info("passage de ménage", { fermees, abonnements, candidatures });
  }

  return NextResponse.json({ fermees, abonnements, candidatures });
}
