import { NextResponse } from "next/server";

import { publierLesArticlesDus } from "@/lib/blog/redaction";
import { journal } from "@/lib/observabilite/journal";

/**
 * Le passage qui publie les articles planifiés.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IL PEUT RATER SON TOUR SANS DÉGÂT
 *
 * La condition est « l'heure est passée », jamais « l'heure est celle-ci » :
 * chercher l'égalité ferait perdre définitivement tout article dont l'heure est
 * tombée pendant une panne. Un passage sauté publie au suivant, avec du retard
 * et rien de cassé.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PLUSIEURS FOIS PAR JOUR, CONTRAIREMENT AUX AUTRES
 *
 * Le passage des abonnements tourne une fois par jour : ses paliers se
 * comptent en jours. Celui-ci porte une heure de parution, et publier « le 10
 * à 14 h » le 11 au matin raterait le but. Une fois par heure est le bon
 * grain — rien n'oblige à descendre plus bas, et chaque passage est une
 * requête sur un index.
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
    const bilan = await publierLesArticlesDus();
    return NextResponse.json(bilan);
  } catch (cause) {
    // Le passage échoue, l'ordonnanceur le saura par le code de retour, et
    // les articles repartiront au tour suivant : rien n'est perdu.
    journal.erreur("passage du blog en échec", {
      cause: cause instanceof Error ? cause.message : String(cause),
    });
    return new NextResponse("Erreur", { status: 500 });
  }
}
