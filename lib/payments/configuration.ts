import "server-only";

import { db } from "@/lib/db";
import { masquerCompte } from "@/lib/payments/gains";
import {
  CADENCE_PAR_DEFAUT,
  cadenceValide,
  type CodeCadence,
} from "@/lib/payments/cadences";
import { CONFIG_PAR_DEFAUT, RAILS_BAOBART } from "@/lib/payments/payout-schedule";

/**
 * Ce que le vendeur a réglé, et ce que cela implique pour lui.
 *
 * L'écran ne se contente pas de montrer un formulaire : il dit **quel jour**
 * l'argent partira et **ce qu'un remboursement lui coûtera**. Un réglage dont
 * on ne voit pas la conséquence se fait au hasard.
 */

export {
  CADENCES,
  CADENCE_PAR_DEFAUT,
  cadenceValide,
  MOYENS_VERSEMENT,
  moyenDe,
  type CodeCadence,
} from "@/lib/payments/cadences";

const JOURS = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
] as const;

export interface CompteEnregistre {
  id: string;
  railId: string;
  railLabel: string;
  /** Jamais la référence entière : « ···· 4821 ». */
  referenceMasquee: string;
  titulaire: string | null;
  verifie: boolean;
  enregistreLe: Date;
  retireLe: Date | null;
}

export interface ConfigurationVendeur {
  actuel: CompteEnregistre | null;
  /** Comptes remplacés, du plus récent au plus ancien. */
  anciens: CompteEnregistre[];
  cadence: CodeCadence;
  /** Jour de la semaine où le rail choisi paie, en toutes lettres. */
  jourDeVersement: string | null;
  /** Sous ce montant, la somme roule sur le cycle suivant. */
  seuil: number;
  /** Jours de rétention avant qu'une vente devienne versable. */
  retentionJours: number;
  versementsSuspendus: boolean;
  motifSuspension: string | null;
}

function versCompte(ligne: {
  id: string;
  provider: string;
  accountRef: string;
  holderName: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  deletedAt: Date | null;
}): CompteEnregistre {
  return {
    id: ligne.id,
    railId: ligne.provider,
    railLabel: RAILS_BAOBART[ligne.provider]?.label ?? ligne.provider,
    referenceMasquee: masquerCompte(ligne.accountRef),
    titulaire: ligne.holderName,
    verifie: ligne.verifiedAt !== null,
    enregistreLe: ligne.createdAt,
    retireLe: ligne.deletedAt,
  };
}

export async function configurationDe(
  userId: string,
): Promise<ConfigurationVendeur> {
  const [compte, comptes] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        payoutFrequency: true,
        payoutRail: true,
        payoutsPausedAt: true,
        payoutsPausedReason: true,
      },
    }),
    db.payoutAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        provider: true,
        accountRef: true,
        holderName: true,
        verifiedAt: true,
        createdAt: true,
        deletedAt: true,
      },
    }),
  ]);

  const actuel = comptes.find((c) => c.deletedAt === null) ?? null;
  const rail = actuel ? RAILS_BAOBART[actuel.provider] : null;

  return {
    actuel: actuel ? versCompte(actuel) : null,
    anciens: comptes.filter((c) => c.deletedAt !== null).map(versCompte),
    // Le quotidien existe au schéma mais aucun cycle ne le sert : l'offrir
    // promettrait un versement le lendemain que rien ne déclencherait.
    cadence: cadenceValide(compte.payoutFrequency) ?? CADENCE_PAR_DEFAUT,
    jourDeVersement: rail ? JOURS[rail.weekday]! : null,
    seuil: CONFIG_PAR_DEFAUT.minimumAmount,
    retentionJours: CONFIG_PAR_DEFAUT.delayDays,
    versementsSuspendus: compte.payoutsPausedAt !== null,
    motifSuspension: compte.payoutsPausedReason,
  };
}
