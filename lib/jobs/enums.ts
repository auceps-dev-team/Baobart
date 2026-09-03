/**
 * Les valeurs que le schéma connaît, recopiées pour rester lisibles sans Prisma.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI RECOPIER
 *
 * `lib/jobs/validation.ts` est pur : il doit s'éprouver sans client Prisma et
 * sans base. Importer les enums générés y ferait entrer tout le client.
 *
 * Le risque du doublon est réel — une valeur ajoutée au schéma et oubliée ici
 * serait refusée par la validation sans qu'aucune erreur ne le dise. Un test
 * confronte donc les deux listes.
 */

export const TYPES = ["FREELANCE", "CDD", "CDI", "INTERN", "APPRENTICE"] as const;
export type JobType = (typeof TYPES)[number];

export const MODES = ["REMOTE", "HYBRID", "ONSITE"] as const;
export type JobMode = (typeof MODES)[number];

export const POSTULER = ["BAOBART", "EXTERNE"] as const;
export type ApplyMode = (typeof POSTULER)[number];

/** Ce qu'on montre à l'écran. Le code n'est jamais affiché tel quel. */
export const LIBELLE_TYPE: Record<JobType, string> = {
  FREELANCE: "Freelance",
  CDD: "CDD",
  CDI: "CDI",
  INTERN: "Stage",
  APPRENTICE: "Alternance",
};

export const LIBELLE_MODE: Record<JobMode, string> = {
  REMOTE: "À distance",
  HYBRID: "Hybride",
  ONSITE: "Sur place",
};
