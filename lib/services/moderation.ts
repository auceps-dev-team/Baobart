import "server-only";

import { consigner, ressource } from "@/lib/admin/audit";
import { annoncerLaDecision } from "@/lib/cms/annonce";
import { appliquer, type Geste } from "@/lib/cms/cycle";
import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";

/**
 * Trancher sur un service.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * MÊME MÉCANIQUE QUE JOBS, MÊMES INVARIANTS
 *
 * La machine à états vit dans `lib/cms/cycle.ts` — pure, éprouvée, partagée.
 * Ici on relit l'état, on demande la transition, on écrit — avec la condition
 * dans le `WHERE`, parce que deux modérateurs peuvent ouvrir la même fiche.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * PAS DE BADGE « SERVICE VÉRIFIÉ »
 *
 * Sur Jobs, `isVerified` répond au vecteur d'arnaque le plus direct du
 * projet : une URL d'hameçonnage déposée sous couvert d'offre d'emploi. Un
 * service n'ouvre pas d'URL externe — la commande passe par un `mailto:`
 * sur l'adresse publique du créateur, et le badge « Créateur vérifié » (déjà
 * sur `Profile`) dit qui il est. Ajouter un badge par service diluerait
 * celui du créateur, et donnerait un signal de plus à confondre.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN REFUS SANS MOTIF EST INDÉFENDABLE
 *
 * Comme sur Jobs. Le motif est la seule trace de ce qu'on a vu — et le seul
 * message qu'on pourra montrer au créateur qui écrira pour comprendre.
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
  const offre = await db.serviceOffer.findUnique({
    where: { id: input.offreId },
    select: { id: true, state: true, title: true, creatorId: true },
  });

  if (!offre) return { ok: false, motif: "INTROUVABLE" };

  const transition = appliquer(offre.state, input.geste);
  if (!transition.ok) return { ok: false, motif: "TRANSITION_INTERDITE" };

  const motif = (input.motif ?? "").trim();
  if (input.geste === "refuser" && motif.length < MOTIF_MIN) {
    return { ok: false, motif: "MOTIF_REQUIS" };
  }

  // Condition dans le `WHERE` : deux modérateurs peuvent avoir ouvert la même
  // fiche, seul le premier tranche. Le second repart sans rien casser.
  const ecrit = await db.serviceOffer.updateMany({
    where: { id: offre.id, state: offre.state },
    data: {
      state: transition.vers,
      moderatedAt: new Date(),
      moderatorId: input.moderateurId,
      // Le motif n'est écrit que sur un refus, et effacé sur toute autre
      // décision : garder l'ancien afficherait « refusé pour X » sur un
      // service finalement publié.
      refusedReason: input.geste === "refuser" ? motif : null,
    },
  });

  if (ecrit.count !== 1) return { ok: false, motif: "TRANSITION_INTERDITE" };

  await consigner({
    acteurId: input.moderateurId,
    action:
      input.geste === "publier"
        ? "contenu.approuver"
        : input.geste === "refuser"
          ? "contenu.refuser"
          : "contenu.retirer",
    ressource: ressource("service", offre.id),
    details: {
      de: offre.state,
      vers: transition.vers,
      titre: offre.title,
      auteur: offre.creatorId,
      ...(motif ? { motif } : {}),
    },
  });

  await annoncerLaDecision({
    auteurId: offre.creatorId,
    acteurId: input.moderateurId,
    geste: input.geste,
    nature: "service",
    id: offre.id,
    titre: offre.title,
    motif,
    lien: input.geste === "publier" ? `/services/${offre.id}` : "/services/deposer",
  });

  journal.info("service tranché", {
    offre: offre.id,
    de: offre.state,
    vers: transition.vers,
  });

  return { ok: true, vers: transition.vers };
}

export const MESSAGES: Record<
  Exclude<Suite, { ok: true }>["motif"],
  string
> = {
  INTROUVABLE: "Ce service n'existe plus.",
  TRANSITION_INTERDITE:
    "Quelqu'un vient de trancher sur ce service. Rafraîchis la file.",
  MOTIF_REQUIS:
    "Écris pourquoi tu refuses : c'est la seule chose qu'on pourra montrer au créateur.",
};
