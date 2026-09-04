/**
 * Comment on écrit une invitation à contacter un créateur.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * PAS DE MESSAGERIE ICI
 *
 * Même arbitrage que pour les candidatures reçues sur Jobs (§22.6) : ouvrir
 * un fil interne rien que pour Services demanderait un système de
 * notifications, un historique cherchable, une modération. Le courrier est
 * déjà tout cela.
 *
 * Le prix à payer : l'adresse du créateur est exposée en clair sur la
 * fiche. C'est aussi le sens d'une fiche publique — un créateur qui publie
 * un service accepte d'être joignable, sans quoi il n'y aurait personne à
 * contacter.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX INTENTIONS, DEUX SUJETS DIFFÉRENTS
 *
 * Sur la maquette, deux boutons voisinent : « Commander » et « Poser une
 * question ». Les fondre en un seul obligerait le créateur à deviner l'intention
 * à la lecture — précisément ce qu'un sujet de mail est fait pour éviter. Deux
 * fonctions ici, une par bouton.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE MODULE EST PUR
 *
 * Il compose une URL. La partie « lecture de l'offre » vit dans `queries.ts` ;
 * la partie « rendu » vit dans la page. On peut donc éprouver l'échappement
 * sans monter ni React ni base — et sans quoi la moindre apostrophe dans un
 * titre casserait le `mailto:`.
 */

export type Intention = "commander" | "question";

export interface OffrePourContact {
  titre: string;
  courrielCreateur: string;
  /** L'URL publique de la fiche, pour aider le créateur à s'y retrouver. */
  urlFiche: string;
}

/**
 * L'URL `mailto:` complète, prête à poser dans un `href`.
 *
 * Trois choix explicites :
 *
 *   — le titre du service est repris dans le sujet — un créateur qui a
 *     plusieurs offres n'a pas à demander « à quoi tu réponds » ;
 *   — l'URL de la fiche est dans le corps — sinon un mail cité en réponse
 *     perd le contexte au premier rebond ;
 *   — l'encodage est fait avec `encodeURIComponent`, à la main sur chaque
 *     paramètre. `URLSearchParams` remplace les espaces par `+`, ce que la
 *     plupart des clients de mail interprètent mal dans un `mailto:` (Outlook
 *     en fait un caractère littéral).
 */
export function urlDeContact(
  offre: OffrePourContact,
  intention: Intention,
): string {
  const sujet = intention === "commander"
    ? `Commande — ${offre.titre}`
    : `Question — ${offre.titre}`;

  const salutation =
    intention === "commander"
      ? "Bonjour,\n\nJe souhaite te commander la prestation suivante :"
      : "Bonjour,\n\nJ'ai une question à propos de la prestation suivante :";

  const corps = [
    salutation,
    "",
    `« ${offre.titre} »`,
    offre.urlFiche,
    "",
    "— envoyé depuis Baobart",
  ].join("\n");

  const params = [
    `subject=${encodeURIComponent(sujet)}`,
    `body=${encodeURIComponent(corps)}`,
  ].join("&");

  return `mailto:${encodeURIComponent(offre.courrielCreateur)}?${params}`;
}
