import "server-only";

import { db } from "@/lib/db";
import {
  etapesVendeur,
  type CleEtapeVendeur,
  type EtapeVendeur,
  type FaitsVendeur,
  type ProgressionVendeur,
} from "@/lib/dashboard/devenir-vendeur";

export {
  etapesVendeur,
  type CleEtapeVendeur,
  type EtapeVendeur,
  type FaitsVendeur,
  type ProgressionVendeur,
};

/**
 * Lecture en base des faits nécessaires aux trois étapes « Devenir vendeur »
 * (`lib/dashboard/devenir-vendeur.ts`).
 *
 * `verifiedAt` n'est pas lu : aucun code ne l'écrit en base (vérifié le
 * 08/11 et le 09/11/2026) ; c'est `createdAt` + `VERIFICATION_MS` (24 h,
 * `lib/payments/eligibilite.ts:88`) qui régit l'éligibilité au premier départ.
 */
export async function lireProgressionVendeur(
  userId: string,
  maintenant?: Date,
): Promise<ProgressionVendeur> {
  const [profil, compteVersement, ressourcesPubliees] = await Promise.all([
    db.profile.findUnique({
      where: { userId },
      select: {
        avatarUrl: true,
        bio: true,
        speciality: true,
        portfolioUrl: true,
        links: { select: { network: true, url: true } },
      },
    }),
    db.payoutAccount.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    db.product.count({
      where: { sellerId: userId, status: "PUBLISHED" },
    }),
  ]);

  return etapesVendeur({
    profil: profil
      ? {
          avatarUrl: profil.avatarUrl,
          bio: profil.bio,
          speciality: profil.speciality,
          portfolioUrl: profil.portfolioUrl,
          liens: profil.links,
        }
      : null,
    versement: {
      enregistreLe: compteVersement?.createdAt ?? null,
    },
    ressourcesPubliees,
    maintenant,
  });
}
