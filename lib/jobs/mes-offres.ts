import "server-only";

import { db } from "@/lib/db";

/**
 * Les offres qu'un recruteur a déposées — toutes, quel que soit leur état.
 *
 * Q-26 (recette du 14/11/2026) : aucune entrée de menu ne menait à ses
 * offres ; seul le lien d'une notification ouvrait leurs candidatures. Le
 * candidat avait « Mes propositions », le recruteur rien.
 *
 * Un auteur voit tous ses contenus, refusés et retirés compris (voir
 * `lib/cms/cycle.ts`) : le filtre est le seul `recruiterId`. Cent au plus,
 * comme « Mes propositions ».
 */
export async function offresDe(recruteurId: string) {
  return db.jobPosting.findMany({
    where: { recruiterId: recruteurId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      state: true,
      deadline: true,
      refusedReason: true,
      createdAt: true,
      applyMode: true,
      _count: { select: { applications: true } },
    },
  });
}

/** A-t-il déposé au moins une offre ? Pour n'afficher « Mes offres » qu'à lui. */
export async function aDeposeUneOffre(recruteurId: string): Promise<boolean> {
  const une = await db.jobPosting.findFirst({ where: { recruiterId: recruteurId }, select: { id: true } });
  return une !== null;
}
