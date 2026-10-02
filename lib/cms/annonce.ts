import "server-only";

import type { Geste } from "@/lib/cms/cycle";
import { notifier } from "@/lib/notifications/aiguilleur";

/**
 * Dire à l'auteur ce que la modération a décidé de son contenu.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES ÉVÉNEMENTS LE FAISAIENT, LES TROIS AUTRES NON
 *
 * Mesuré le 25/09 (Qualitytest P9.3, S55) : refuser une offre d'emploi ou un
 * service ne prévenait personne — zéro notification à l'agence, et aucun écran
 * ne lui montrait le motif. Le motif existait en base, aucun canal ne le
 * portait. Seule la rédaction des événements appelait `notifier`. Offres,
 * services et articles passent désormais par ici, avec les mêmes deux gardes :
 *
 *   — on ne se prévient pas soi-même : un rédacteur qui publie son propre
 *     article n'a pas besoin qu'on le lui annonce ;
 *   — `notifier` ne lève jamais : un avis qui échoue ne doit pas défaire la
 *     décision qui vient d'être écrite.
 *
 * CONTENU_REFUSE est impératif au catalogue : c'est le seul canal entre la
 * décision et son auteur.
 */
export async function annoncerLaDecision(input: {
  auteurId: string;
  acteurId: string;
  geste: Geste;
  /** « offre », « service », « article » — pour la clé, qui doit être unique par contenu. */
  nature: string;
  id: string;
  titre: string;
  /** Le motif du refus, tel qu'écrit par le modérateur. */
  motif: string;
  /** Où mène l'avis : la fiche publique une fois publiée, de quoi corriger après un refus. */
  lien: string;
}): Promise<void> {
  if (input.acteurId === input.auteurId) return;

  if (input.geste === "refuser") {
    await notifier({
      destinataireId: input.auteurId,
      evenement: "CONTENU_REFUSE",
      // L'instant dans la clé : un contenu corrigé, resoumis puis refusé de
      // nouveau mérite un second avis. Le rejeu d'un même refus est déjà
      // impossible — la transition est gardée par le WHERE de l'appelant.
      cle: `refus-${input.nature}-${input.id}-${Date.now()}`,
      titre: `« ${input.titre} » n'a pas été retenu`,
      corps: input.motif,
      lien: input.lien,
      charge: { titre: input.titre, motif: input.motif },
    });
  } else if (input.geste === "publier") {
    await notifier({
      destinataireId: input.auteurId,
      evenement: "CONTENU_PUBLIE",
      cle: `publication-${input.nature}-${input.id}`,
      titre: `« ${input.titre} » est en ligne`,
      corps: "Ce que tu as soumis a été relu et publié. Il est désormais visible de tout le monde.",
      lien: input.lien,
      charge: { titre: input.titre },
    });
  }
}
