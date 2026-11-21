/**
 * Les pays qu'un profil peut déclarer — une liste, plus un champ libre.
 *
 * Q-32 (recette du 14/11/2026) : le profil attendait « CI, SN, ML… » dans un
 * champ de texte ; l'offre d'emploi, elle, proposait une liste. La valeur
 * enregistrée ne change pas : le code ISO 3166-1 alpha-2 que
 * `lib/profil/validation.ts` vérifie déjà.
 *
 * Pas la liste des paiements (`PAYS`, lib/payments/rails.ts) : elle compte les
 * quatre pays où l'on encaisse, et un créateur du Mali ou de Paris doit pouvoir
 * dire d'où il est. Ici : les 54 pays d'Afrique, et ceux de la diaspora.
 * Les noms viennent du navigateur (`Intl.DisplayNames`), en français.
 */
export const CODES_PAYS = [
  // Afrique de l'Ouest
  "BJ", "BF", "CV", "CI", "GM", "GH", "GN", "GW", "LR", "ML", "MR", "NE", "NG", "SN", "SL", "TG",
  // Afrique centrale
  "AO", "CM", "CF", "TD", "CG", "CD", "GQ", "GA", "ST",
  // Afrique de l'Est
  "BI", "KM", "DJ", "ER", "ET", "KE", "MG", "MW", "MU", "MZ", "RW", "SC", "SO", "SS", "SD", "TZ", "UG", "ZM", "ZW",
  // Afrique du Nord
  "DZ", "EG", "LY", "MA", "TN",
  // Afrique australe
  "BW", "SZ", "LS", "NA", "ZA",
  // Diaspora
  "FR", "BE", "CH", "LU", "DE", "GB", "IT", "ES", "PT", "NL", "CA", "US", "BR", "HT", "AE", "CN",
] as const;

export function nomDuPays(code: string): string {
  try {
    return new Intl.DisplayNames(["fr"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Triés par nom français, pour une liste qui se parcourt. */
export function paysTries(): { code: string; nom: string }[] {
  return CODES_PAYS.map((code) => ({ code, nom: nomDuPays(code) })).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}
