import "server-only";

import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";
import { valider, type Refus, type Saisie } from "@/lib/services/validation";

/**
 * Déposer un service.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ELLE NAÎT EN RELECTURE, JAMAIS EN LIGNE
 *
 * Le schéma pose `BROUILLON` par défaut ; ce module écrit `SOUMIS` en une
 * seule écriture. Déposer, c'est demander une relecture — un brouillon qu'on
 * oublie d'envoyer n'aide personne, et l'écran de dépôt n'a pas d'étape
 * « enregistrer pour plus tard ».
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'AUTEUR N'EST PAS UN PARAMÈTRE
 *
 * Il est lu de la session par l'action qui appelle ce module. Le recevoir ici
 * suffirait à déposer un service au nom de quelqu'un d'autre.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON VÉRIFIE QUE LA CATÉGORIE EXISTE ET N'EST PAS CACHÉE
 *
 * Le formulaire propose les catégories actives ; mais un envoi rejoué
 * quelques semaines plus tard, ou un client qui déclenche l'action avec un
 * identifiant devinent, pourraient référencer une catégorie retirée. Sans
 * cette garde, `RESTRICT` refuserait l'écriture en tapant à côté — un
 * message d'erreur SQL n'aide personne.
 */

export type Echec =
  | { motif: "REFUS"; refus: Refus }
  /** La catégorie n'existe pas ou a été cachée. */
  | { motif: "CATEGORIE_INTROUVABLE" }
  /** Une offre identique du même créateur, dans la fenêtre. */
  | { motif: "DOUBLON" };

export type Suite = { ok: true; offreId: string } | ({ ok: false } & Echec);

/**
 * Deux offres au même titre du même créateur, dans la même heure.
 *
 * Ce n'est pas la limitation de débit — celle-ci vit dans `lib/securite` et
 * borne le rythme. C'est la protection contre le double envoi.
 */
const FENETRE_DOUBLON_MS = 60 * 60_000;

export async function deposerUnService(input: {
  creatorId: string;
  saisie: Saisie;
}): Promise<Suite> {
  const verdict = valider(input.saisie);
  if (!verdict.ok) return { ok: false, motif: "REFUS", refus: verdict.refus };

  const offre = verdict.offre;

  const categorie = await db.serviceCategory.findFirst({
    where: { id: offre.categoryId, isActive: true },
    select: { id: true },
  });
  if (!categorie) return { ok: false, motif: "CATEGORIE_INTROUVABLE" };

  const recent = await db.serviceOffer.findFirst({
    where: {
      creatorId: input.creatorId,
      title: offre.titre,
      createdAt: { gte: new Date(Date.now() - FENETRE_DOUBLON_MS) },
    },
    select: { id: true },
  });

  if (recent) return { ok: false, motif: "DOUBLON" };

  const creee = await db.serviceOffer.create({
    data: {
      creatorId: input.creatorId,
      categoryId: offre.categoryId,
      title: offre.titre,
      description: offre.description,
      startingPrice: offre.startingPrice,
      deliveryDays: offre.deliveryDays,
      state: "SOUMIS",
    },
    select: { id: true },
  });

  journal.info("service déposé", { offre: creee.id });

  return { ok: true, offreId: creee.id };
}

export const MESSAGES_ECHEC: Record<Echec["motif"], string> = {
  REFUS: "",
  CATEGORIE_INTROUVABLE:
    "Cette catégorie n'est plus disponible. Choisis-en une autre dans la liste.",
  DOUBLON:
    "Tu viens de déposer un service au même intitulé. Il est déjà en relecture.",
};
