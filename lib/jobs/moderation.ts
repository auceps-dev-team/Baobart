import "server-only";

import { consigner, ressource } from "@/lib/admin/audit";
import { appliquer, type Geste } from "@/lib/cms/cycle";
import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";

/**
 * Trancher sur une offre d'emploi.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA MACHINE DÉCIDE, PAS CE FICHIER
 *
 * Les transitions permises vivent dans `lib/cms/cycle.ts`, purement. Ici on
 * relit l'état, on demande la transition, et on écrit — avec la condition dans
 * le `WHERE`, parce que deux modérateurs peuvent ouvrir la même offre.
 *
 * Écrire les règles ici les aurait rendues inéprouvables sans base, et
 * différentes de celles des trois autres CMS au premier oubli.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN REFUS SANS MOTIF EST INDÉFENDABLE
 *
 * Trois mois plus tard, devant l'annonceur qui écrit pour comprendre, un refus
 * sans raison écrite ne se justifie pas. Le motif est donc exigé — pas par
 * politesse, mais parce que c'est la seule trace de ce qu'on a vu.
 */

export type Suite =
  | { ok: true; vers: string }
  | { ok: false; motif: "INTROUVABLE" | "TRANSITION_INTERDITE" | "MOTIF_REQUIS" };

const MOTIF_MIN = 8;

export async function trancher(input: {
  offreId: string;
  geste: Geste;
  moderateurId: string;
  motif?: string;
}): Promise<Suite> {
  const offre = await db.jobPosting.findUnique({
    where: { id: input.offreId },
    select: { id: true, state: true, title: true, recruiterId: true },
  });

  if (!offre) return { ok: false, motif: "INTROUVABLE" };

  const transition = appliquer(offre.state, input.geste);
  if (!transition.ok) return { ok: false, motif: "TRANSITION_INTERDITE" };

  const motif = (input.motif ?? "").trim();
  if (input.geste === "refuser" && motif.length < MOTIF_MIN) {
    return { ok: false, motif: "MOTIF_REQUIS" };
  }

  // La condition d'état est dans le `WHERE` : deux modérateurs peuvent avoir
  // ouvert la même offre, et seul le premier doit trancher. Le second repart
  // sans rien casser, et sa page se rafraîchira.
  const ecrit = await db.jobPosting.updateMany({
    where: { id: offre.id, state: offre.state },
    data: {
      state: transition.vers,
      moderatedAt: new Date(),
      moderatorId: input.moderateurId,
      // Le motif n'est écrit que sur un refus, et effacé sur toute autre
      // décision : garder l'ancien ferait afficher « refusée pour X » sur une
      // offre finalement publiée.
      refusedReason: input.geste === "refuser" ? motif : null,
    },
  });

  if (ecrit.count !== 1) return { ok: false, motif: "TRANSITION_INTERDITE" };

  // Consigné après l'acte, et seulement s'il a eu lieu. Une décision refusée
  // par la machine ne doit pas apparaître comme appliquée à la relecture.
  await consigner({
    acteurId: input.moderateurId,
    action:
      input.geste === "publier"
        ? "contenu.approuver"
        : input.geste === "refuser"
          ? "contenu.refuser"
          : "contenu.retirer",
    ressource: ressource("job", offre.id),
    details: {
      de: offre.state,
      vers: transition.vers,
      titre: offre.title,
      auteur: offre.recruiterId,
      ...(motif ? { motif } : {}),
    },
  });

  journal.info("offre d'emploi tranchée", {
    offre: offre.id,
    de: offre.state,
    vers: transition.vers,
  });

  return { ok: true, vers: transition.vers };
}

/**
 * Poser ou retirer le badge « Offre vérifiée ».
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IL DIT « QUELQU'UN A CONTRÔLÉ », PAS « ÇA A ÉTÉ PUBLIÉ »
 *
 * Toute offre en ligne a été relue — c'est le minimum. Le badge distingue ce
 * qu'un humain est allé **vérifier** : que l'entreprise existe, que l'adresse
 * de candidature lui appartient, qu'on ne demande pas d'argent au candidat.
 *
 * Le confondre avec la publication le viderait de son sens : un badge que tout
 * le monde porte ne protège plus personne. C'est pourquoi il se pose à part, et
 * pourquoi il se retire.
 */
export async function marquerVerifiee(input: {
  offreId: string;
  moderateurId: string;
  verifiee: boolean;
}): Promise<Suite> {
  const ecrit = await db.jobPosting.updateMany({
    where: { id: input.offreId },
    data: { isVerified: input.verifiee },
  });

  if (ecrit.count !== 1) return { ok: false, motif: "INTROUVABLE" };

  await consigner({
    acteurId: input.moderateurId,
    // Poser le badge est une approbation renforcée ; le retirer est un retrait.
    action: input.verifiee ? "contenu.approuver" : "contenu.retirer",
    ressource: ressource("job", input.offreId),
    details: { badge: "offre-verifiee", pose: input.verifiee },
  });

  return { ok: true, vers: input.verifiee ? "VERIFIEE" : "NON_VERIFIEE" };
}

export const MESSAGES: Record<
  Exclude<Suite, { ok: true }>["motif"],
  string
> = {
  INTROUVABLE: "Cette offre n'existe plus.",
  TRANSITION_INTERDITE:
    "Quelqu'un vient de trancher sur cette offre. Rafraîchis la file.",
  MOTIF_REQUIS:
    "Écris pourquoi tu refuses : c'est la seule chose qu'on pourra montrer à l'annonceur.",
};
