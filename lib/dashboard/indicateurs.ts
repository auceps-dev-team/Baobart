import "server-only";

import type { Currency } from "@prisma/client";

import { ETATS_ABOUTIS } from "@/lib/dashboard/historique";
import { debutDuMois, serieMensuelle, type Barre } from "@/lib/dashboard/mois";
import { db } from "@/lib/db";

/**
 * Les chiffres du tableau de bord d'un créateur — la rangée de cartes et le
 * graphique de « Baobart Dashboard.dc.html ».
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUE « GAGNÉ » VEUT DIRE ICI
 *
 * La somme du grand livre (`BalanceTransaction.holdingNet`) sur le mois, tous
 * mouvements sauf les versements : ventes, pourboires et redistributions en
 * plus, remboursements et contestations en moins. Mesuré le 27/10 sur la base
 * de développement : `SALE` positif, `REFUND` négatif — la somme dit donc ce
 * qui a été gagné, remboursements déduits. Un versement (`PAYOUT`) n'est pas
 * un gain : c'est le gain qui sort vers Wave.
 *
 * Dans la devise de tenue du compte seulement : additionner des francs CFA et
 * des euros donnerait un nombre qui n'est ni l'un ni l'autre.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUE LA MAQUETTE MONTRE ET QU'ON NE MONTRE PAS
 *
 * « +14 % vs juin » sous les vues de page : on ne garde qu'un compteur cumulé
 * par profil (`Profile.viewCount`, lib/createurs/vues.ts), pas d'historique
 * par jour. Le total s'affiche, la variation non — l'inventer serait pire que
 * l'omettre. « Commissions versées » : ici, `Commission` est une commande sur
 * mesure, pas un frais ; la carte montre le solde à verser à la place.
 */

export interface IndicateursCreateur {
  devise: Currency;
  gainsMois: number;
  gainsMoisPrecedent: number;
  ventesMois: number;
  ventesTotal: number;
  vues: number;
  /**
   * Ventes ÷ vues, en %, à une décimale. `null` sans aucune vue, ou quand le
   * rapport dépasse 100 %. Mesuré le 27/10 : 23 ventes pour 6 vues, soit
   * 383 % — les vues ne se comptent que depuis v1.96.0 (16/10), les ventes
   * depuis toujours. Les deux fenêtres ne se comparent pas ; plutôt rien
   * qu'un chiffre impossible.
   */
  conversion: number | null;
  revenus: Barre[];
}

export async function indicateursCreateur(userId: string, maintenant = new Date()): Promise<IndicateursCreateur> {
  const compte = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { defaultCurrency: true, profile: { select: { viewCount: true } } },
  });
  const devise = compte.defaultCurrency;
  const depuis = debutDuMois(maintenant, -5);
  const ceMois = debutDuMois(maintenant);

  const [parMois, ventesMois, ventesTotal] = await Promise.all([
    // `occurredAt` est un `timestamp` sans fuseau, rangé en UTC : on le tronque
    // tel quel. `holdingCurrency` est une énumération, d'où la conversion —
    // comparée à un paramètre texte, PostgreSQL refuserait (vérifié le 27/10).
    db.$queryRaw<Array<{ mois: string; montant: bigint | number | null }>>`
      SELECT to_char(date_trunc('month', "occurredAt"), 'YYYY-MM') AS mois,
             SUM("holdingNet") AS montant
      FROM "BalanceTransaction"
      WHERE "userId" = ${userId}
        AND "type" <> 'PAYOUT'
        AND "holdingCurrency"::text = ${devise}
        AND "occurredAt" >= ${depuis}
      GROUP BY 1`,
    db.orderItem.count({ where: { product: { sellerId: userId }, state: { in: [...ETATS_ABOUTIS] }, createdAt: { gte: ceMois } } }),
    db.orderItem.count({ where: { product: { sellerId: userId }, state: { in: [...ETATS_ABOUTIS] } } }),
  ]);

  const revenus = serieMensuelle(
    parMois.map((l) => ({ mois: l.mois, montant: Number(l.montant ?? 0) })),
    maintenant,
  );
  const vues = compte.profile?.viewCount ?? 0;

  return {
    devise,
    gainsMois: revenus.at(-1)!.montant,
    gainsMoisPrecedent: revenus.at(-2)!.montant,
    ventesMois,
    ventesTotal,
    vues,
    conversion: vues > 0 && ventesTotal <= vues ? Math.round((ventesTotal / vues) * 1000) / 10 : null,
    revenus,
  };
}
