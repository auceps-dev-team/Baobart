import { NextResponse } from "next/server";

import { journal } from "@/lib/observabilite/journal";
import {
  PORTS_BAOBART,
  lienDeValidation,
  montantLisible,
} from "@/lib/ndank/baobart";
import { passer } from "@/lib/ndank/moteur";
import {
  ordonnanceurAutorise,
  reponseIntrouvable,
} from "@/lib/securite/cron";

/**
 * Le passage quotidien de Ndank.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * C'EST CE PASSAGE QUI REMPLACE LE PRÉLÈVEMENT
 *
 * Un abonnement à carte n'a besoin de personne : le marchand débite, l'accès
 * suit. Le mobile money ne permet pas cela — chaque débit exige que l'abonné
 * valide sur son téléphone. Ce passage est donc le seul mécanisme qui empêche
 * un abonnement de mourir en silence : il relance, puis il coupe, puis il clôt.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IL PEUT RATER SON TOUR SANS DÉGÂT
 *
 * L'état d'un abonnement se **déduit** de ses dates, il n'est jamais stocké : un
 * jour sauté ne laisse rien de faux derrière lui. Et les relances portent une
 * clé par cycle et par palier — le passage peut tourner dix fois dans la
 * journée sans qu'un seul message parte deux fois.
 *
 * Une fois par jour suffit donc. Plus souvent ne changerait rien ; moins
 * souvent laisserait passer des paliers.
 */

export const dynamic = "force-dynamic";

export const maxDuration = 60;

export async function GET(requete: Request) {
  if (!ordonnanceurAutorise(requete)) {
    return reponseIntrouvable();
  }

  const bilan = await passer(PORTS_BAOBART, {
    lien: lienDeValidation,
    montant: montantLisible,
  });

  // Un passage vide est le cas normal. Ne journaliser que ce qui s'est passé
  // évite de noyer les incidents sous la routine.
  if (bilan.relances > 0 || bilan.suspendus > 0 || bilan.clos > 0) {
    journal.info("passage Ndank", { ...bilan });
  }

  // Celui-ci est un incident, pas une statistique : on va couper l'accès de
  // quelqu'un qu'on ne sait plus joindre. Sans courriel valide, sans numéro et
  // sans application, la suspension arrivera sans prévenir.
  if (bilan.injoignables > 0) {
    journal.erreur("abonnés injoignables avant suspension", {
      nombre: bilan.injoignables,
      remede:
        "Vérifie que la file d'e-mails part, et que ces comptes ont une adresse valide.",
    });
  }

  return NextResponse.json(bilan);
}
