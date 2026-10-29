/**
 * Les calculs du tableau de bord qui ne demandent pas la base — mois
 * glissants, série complétée, variation d'un mois sur l'autre.
 *
 * En UTC, et c'est juste : Baobart est à Abidjan, où l'heure légale est
 * l'heure universelle toute l'année. Un mois UTC est un mois ivoirien.
 */

const NOMS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « 2026-10 » : la clé d'un mois, celle que rend `to_char(…, 'YYYY-MM')`. */
export function cleDuMois(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Le premier instant du mois de `date`, décalé de `decalage` mois. */
export function debutDuMois(date: Date, decalage = 0): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + decalage, 1));
}

export interface Barre {
  cle: string;
  libelle: string;
  montant: number;
}

/**
 * Les `n` derniers mois, le courant compris, du plus ancien au plus récent —
 * un mois sans vente vaut zéro au lieu de disparaître : un graphique à trous
 * ferait croire à des mois consécutifs qui ne le sont pas.
 */
export function serieMensuelle(lignes: ReadonlyArray<{ mois: string; montant: number }>, maintenant: Date, n = 6): Barre[] {
  const parMois = new Map(lignes.map((l) => [l.mois, l.montant]));
  return Array.from({ length: n }, (_, i) => {
    const debut = debutDuMois(maintenant, i - (n - 1));
    const cle = cleDuMois(debut);
    return { cle, libelle: NOMS[debut.getUTCMonth()]!, montant: parMois.get(cle) ?? 0 };
  });
}

/**
 * « +22 % » d'un mois sur l'autre, ou `null` quand le mois précédent est
 * nul : une hausse depuis zéro n'a pas de pourcentage, et « +∞ % » ne
 * renseigne personne.
 */
export function variation(actuel: number, precedent: number): number | null {
  if (precedent === 0) return null;
  return Math.round(((actuel - precedent) / Math.abs(precedent)) * 100);
}

/** Le nom du mois précédent, pour « +22 % vs sept. ». */
export function nomDuMoisPrecedent(maintenant: Date): string {
  return NOMS[debutDuMois(maintenant, -1).getUTCMonth()]!;
}
