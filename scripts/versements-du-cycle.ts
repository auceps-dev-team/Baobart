/**
 * Passage des versements — point d'entrée.
 *
 * À brancher sur un ordonnanceur (cron, tâche planifiée de l'hébergeur) une
 * fois par jour ouvré. Chaque rail a son jour : le script ne traite que les
 * créateurs dont le rail tombe aujourd'hui, ce qui étale la charge et respecte
 * les fenêtres de compensation des opérateurs.
 *
 *   pnpm versements                      → prépare le cycle courant
 *   pnpm versements -- --simulation      → dit ce qu'il ferait, sans rien faire
 *   pnpm versements -- --rails=wave,om   → restreint aux rails donnés
 *   pnpm versements -- --cycle=2026-07-31
 *
 * Il **prépare** seulement : les versements sortent en état CREATING, soldes
 * réservés. L'appel à l'opérateur, qui les fait passer en PROCESSING, n'existe
 * pas encore. Préparer sans envoyer est sans danger — un versement CREATING
 * s'annule et rend ses soldes.
 */

import { db } from "@/lib/db";
import { RAILS_BAOBART } from "@/lib/payments/payout-schedule";
import { preparerLeCycle } from "@/lib/payments/cycle";

function argument(nom: string): string | undefined {
  const trouve = process.argv.find((a) => a.startsWith(`--${nom}=`));
  return trouve?.split("=")[1];
}

/** Rails dont le jour d'exécution tombe aujourd'hui. */
function railsDuJour(aujourdhui: Date): string[] {
  const jourSemaine = aujourdhui.getUTCDay();
  return Object.values(RAILS_BAOBART)
    .filter((r) => r.weekday === jourSemaine)
    .map((r) => r.id);
}

async function main() {
  const simulation = process.argv.includes("--simulation");
  const cycleBrut = argument("cycle");
  const railsBrut = argument("rails");

  const aujourdhui = new Date();
  const rails = railsBrut
    ? railsBrut.split(",").map((r) => r.trim()).filter(Boolean)
    : railsDuJour(aujourdhui);

  if (rails.length === 0) {
    console.log(
      `Aucun rail n'est exécuté aujourd'hui (${aujourdhui.toISOString().slice(0, 10)}). Rien à faire.`,
    );
    return;
  }

  const resultat = await preparerLeCycle({
    cycleDate: cycleBrut ? new Date(`${cycleBrut}T00:00:00Z`) : undefined,
    rails,
    simulation,
  });

  const total = resultat.prepares.reduce((s, p) => s + p.montant, 0);

  console.log(
    `${simulation ? "[simulation] " : ""}Cycle du ${resultat.cycleDate.toISOString().slice(0, 10)} — rails : ${rails.join(", ")}`,
  );
  console.log(
    `  ${resultat.prepares.length} versement(s) préparé(s), ${total.toLocaleString("fr-FR")} F au total`,
  );

  // Les écartés sont groupés par motif : trente lignes « sous le seuil » ne
  // disent rien de plus qu'une, et noieraient le motif qui compte.
  const parMotif = new Map<string, number>();
  for (const e of resultat.ecartes) {
    parMotif.set(e.raison, (parMotif.get(e.raison) ?? 0) + 1);
  }

  if (parMotif.size > 0) {
    console.log(`  ${resultat.ecartes.length} écarté(s) :`);
    for (const [motif, nombre] of parMotif) {
      console.log(`    ${motif.padEnd(22)} ${nombre}`);
    }
  }

  // Une erreur technique n'est pas un motif d'écart ordinaire : elle se lit
  // en entier, sinon elle passe pour un refus normal et personne n'enquête.
  for (const e of resultat.ecartes.filter((x) => x.raison === "ERREUR")) {
    console.error(`  ERREUR ${e.userId} : ${e.message}`);
  }
}

main()
  .catch((erreur) => {
    console.error("Le passage a échoué :", erreur);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
