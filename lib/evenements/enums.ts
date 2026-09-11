/**
 * Les valeurs que le schéma connaît, recopiées pour rester lisibles sans Prisma.
 *
 * Même raison que `lib/jobs/enums.ts` : `lib/evenements/validation.ts` est pur,
 * il doit s'éprouver sans client Prisma et sans base. Un test confronte les
 * deux listes, parce qu'une valeur ajoutée au schéma et oubliée ici serait
 * refusée par la validation sans qu'aucune erreur ne le dise.
 */

export const GENRES = ["CONTEST", "WORKSHOP", "CONFERENCE", "EXHIBITION"] as const;
export type EventKind = (typeof GENRES)[number];

/** Ce qu'on montre à l'écran. Le code n'est jamais affiché tel quel. */
export const LIBELLE_GENRE: Record<EventKind, string> = {
  CONTEST: "Concours",
  WORKSHOP: "Atelier",
  CONFERENCE: "Conférence",
  EXHIBITION: "Exposition",
};
