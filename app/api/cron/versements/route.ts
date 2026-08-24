import { NextResponse } from "next/server";

import { preparerLeCycle } from "@/lib/payments/cycle";
import { RAILS_BAOBART } from "@/lib/payments/payout-schedule";

/**
 * Le passage des versements, déclenché par l'ordonnanceur de Vercel.
 *
 * Le script `pnpm versements` fait le même travail depuis un serveur qu'on
 * administre. Sur Vercel il n'y a pas de serveur à administrer : c'est le
 * `crons` de `vercel.json` qui appelle cette route. Sans elle, toute la
 * mécanique de versement resterait inerte en production — les soldes
 * s'accumuleraient sans que rien ne les prépare.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QU'ELLE FAIT, ET CE QU'ELLE NE FAIT PAS
 *
 * Elle **prépare** : les versements sortent en état CREATING, soldes réservés.
 * Elle n'envoie rien à un opérateur — cette intégration n'existe pas encore.
 * Préparer sans envoyer est sans danger : un versement CREATING s'annule et
 * rend ses soldes.
 */

export const dynamic = "force-dynamic";

// Le passage lit les soldes de chaque créateur éligible : c'est plus long
// qu'une page. Vercel coupe à dix secondes par défaut.
export const maxDuration = 60;

/**
 * Seul l'ordonnanceur peut déclencher un passage.
 *
 * Vercel signe ses appels de cron avec `CRON_SECRET`. Sans ce contrôle,
 * l'URL serait publique et n'importe qui pourrait lancer une préparation de
 * versements — ou la relancer en boucle. La comparaison est à durée
 * constante : comparer deux chaînes avec `===` laisse fuir la longueur du
 * préfixe correct, et un secret se devine caractère par caractère.
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

/** Rails dont le jour d'exécution tombe aujourd'hui. */
function railsDuJour(aujourdhui: Date): string[] {
  const jourSemaine = aujourdhui.getUTCDay();
  return Object.values(RAILS_BAOBART)
    .filter((r) => r.weekday === jourSemaine)
    .map((r) => r.id);
}

export async function GET(requete: Request) {
  if (!autorise(requete)) {
    // 404 plutôt que 401 : une route de cron n'a pas à confirmer son
    // existence à qui n'a pas le secret.
    return new NextResponse("Not found", { status: 404 });
  }

  const aujourdhui = new Date();
  const rails = railsDuJour(aujourdhui);

  if (rails.length === 0) {
    return NextResponse.json({
      cycle: null,
      rails: [],
      prepares: 0,
      message: "Aucun rail n'est exécuté aujourd'hui.",
    });
  }

  const resultat = await preparerLeCycle({ rails });

  // Les écartés sont regroupés par motif : trente lignes « sous le seuil » ne
  // disent rien de plus qu'une, et noieraient le motif qui compte.
  const parMotif: Record<string, number> = {};
  for (const e of resultat.ecartes) {
    parMotif[e.raison] = (parMotif[e.raison] ?? 0) + 1;
  }

  return NextResponse.json({
    cycle: resultat.cycleDate.toISOString().slice(0, 10),
    rails,
    prepares: resultat.prepares.length,
    montantTotal: resultat.prepares.reduce((s, p) => s + p.montant, 0),
    ecartes: parMotif,
    // Les erreurs techniques se lisent en entier : les résumer les ferait
    // passer pour des refus ordinaires et personne n'enquêterait.
    erreurs: resultat.ecartes
      .filter((e) => e.raison === "ERREUR")
      .map((e) => ({ userId: e.userId, message: e.message })),
  });
}
