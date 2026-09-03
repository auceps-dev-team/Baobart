import "server-only";

import { urlDuSite } from "@/lib/config/site";
import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";
import { pointeVersNous, valider, type Refus, type Saisie } from "@/lib/jobs/validation";

/**
 * Déposer une offre d'emploi.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ELLE NAÎT EN RELECTURE, JAMAIS EN LIGNE
 *
 * C'est la seule chose qui protège vraiment. Jobs est ouvert à tout inscrit, et
 * un compte se crée en deux minutes : l'authentification donne quelqu'un à qui
 * imputer une arnaque, elle ne l'empêche pas.
 *
 * Le schéma pose `BROUILLON` par défaut ; ce module écrit `SOUMIS` en une seule
 * écriture. Déposer, c'est demander une relecture — un brouillon qu'on oublie
 * d'envoyer n'aide personne, et l'écran de dépôt n'a pas d'étape « enregistrer
 * pour plus tard ».
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'AUTEUR N'EST PAS UN PARAMÈTRE
 *
 * Il est lu de la session par l'action qui appelle ce module. Le recevoir ici
 * suffirait à déposer une offre au nom de quelqu'un d'autre — et c'est ce nom
 * qui apparaîtrait dans la file de modération, puis dans la suspension.
 */

export type Echec =
  | { motif: "REFUS"; refus: Refus }
  /** L'adresse « externe » renvoie chez nous. */
  | { motif: "URL_INTERNE" }
  /** Une offre identique vient d'être déposée. */
  | { motif: "DOUBLON" };

export type Suite = { ok: true; offreId: string } | { ok: false } & Echec;

/**
 * Deux offres au même titre du même compte, dans la même heure.
 *
 * Ce n'est pas la limitation de débit — celle-ci vit dans `lib/securite` et
 * borne le rythme. C'est la protection contre le double envoi : un formulaire
 * soumis deux fois par impatience, qui produirait deux lignes à relire.
 */
const FENETRE_DOUBLON_MS = 60 * 60_000;

export async function deposerUneOffre(input: {
  auteurId: string;
  saisie: Saisie;
}): Promise<Suite> {
  const verdict = valider(input.saisie);
  if (!verdict.ok) return { ok: false, motif: "REFUS", refus: verdict.refus };

  const offre = verdict.offre;

  // ── L'adresse externe ne doit pas renvoyer chez nous ──────────────────────
  //
  // La validation ne peut pas le savoir : elle est pure, et le domaine du site
  // vient de l'environnement. Une offre « externe » qui pointe sur Baobart
  // emprunte notre nom pour rassurer un candidat.
  if (offre.urlExterne) {
    const notre = hoteDuSite();
    if (pointeVersNous(offre.urlExterne, notre)) {
      return { ok: false, motif: "URL_INTERNE" };
    }
  }

  const recent = await db.jobPosting.findFirst({
    where: {
      recruiterId: input.auteurId,
      title: offre.titre,
      createdAt: { gte: new Date(Date.now() - FENETRE_DOUBLON_MS) },
    },
    select: { id: true },
  });

  if (recent) return { ok: false, motif: "DOUBLON" };

  const creee = await db.jobPosting.create({
    data: {
      recruiterId: input.auteurId,
      title: offre.titre,
      description: offre.description,
      type: offre.type,
      mode: offre.mode,
      country: offre.pays,
      city: offre.ville,
      salaryMin: offre.salaireMin,
      salaryMax: offre.salaireMax,
      deadline: offre.echeance,
      applyMode: offre.commentPostuler,
      applyUrl: offre.urlExterne,
      // Déposer, c'est demander une relecture. Écrire BROUILLON obligerait à un
      // second geste que l'écran ne propose pas — et l'offre resterait invisible
      // sans que son auteur comprenne pourquoi.
      state: "SOUMIS",
    },
    select: { id: true },
  });

  journal.info("offre d'emploi déposée", {
    offre: creee.id,
    externe: offre.commentPostuler === "EXTERNE",
  });

  return { ok: true, offreId: creee.id };
}

/** L'hôte de notre propre site, ou `null` s'il n'est pas configuré. */
function hoteDuSite(): string | null {
  const base = urlDuSite();
  if (!base) return null;
  try {
    return new URL(base).host;
  } catch {
    return null;
  }
}

export const MESSAGES_ECHEC: Record<Echec["motif"], string> = {
  REFUS: "",
  URL_INTERNE:
    "Cette adresse renvoie vers Baobart. Choisis « candidature sur Baobart » plutôt qu'un lien externe.",
  DOUBLON:
    "Tu viens de déposer une offre au même intitulé. Elle est déjà en relecture.",
};
