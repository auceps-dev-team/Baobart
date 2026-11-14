import { resteAToi, type LigneAchetee } from "@/lib/dashboard/bibliotheque-regles";

/**
 * Les avis notés, sans base de données. Lot 4 de l'inventaire, 09/11/2026.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * QUI PEUT NOTER (décisions du 09/11)
 *
 * Quiconque a OBTENU la ressource : un achat encaissé, ou une ressource gratuite
 * reçue (`NOT_CHARGED`) — « gratuit compris », tranché par l'utilisateur. Le
 * vendeur ne note jamais la sienne. Un avis par compte et par ressource : on
 * modifie le sien, on n'en empile pas (unicité au schéma).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUI COMPTE
 *
 * Un avis ne compte (moyenne, compteurs, « Bien noté ») que tant que la
 * ressource RESTE à son auteur — la règle de la bibliothèque et de la route de
 * téléchargement, `resteAToi` : ni remboursement intégral, ni litige ouvert ou
 * perdu, ni accès retiré. Un litige gagné rend l'avis aux comptes.
 *
 * Gumroad, lu dans son source le 09/11 (`app/modules/purchase/reviews.rb`,
 * `allows_reviews`), exclut tout achat contesté, même gagné
 * (`chargeback_date.nil?`). On s'en écarte exprès : la règle des ventes
 * abouties du lot 2 rend un litige gagné, et les deux doivent dire la même
 * chose.
 *
 * Cette règle existe une seconde fois, en SQL, dans `lib/avis/recompte.ts`
 * (`AVIS_COMPTE`) : le test d'intégration compare les deux sur des achats
 * tirés au hasard.
 */

export const NOTE_MIN = 1;
export const NOTE_MAX = 5;
/** Un avis se lit d'un coup d'œil ; au-delà, c'est une lettre. */
export const TEXTE_MAX = 2_000;
export const REPONSE_MAX = 2_000;

/** Une ligne d'achat, avec son état d'encaissement. */
export interface LigneObtenue extends LigneAchetee {
  state: string;
}

/**
 * La ressource a-t-elle été obtenue, et reste-t-elle à son acheteur ?
 * Une seule ligne suffit : un second achat après un remboursement redonne le
 * droit.
 */
export function aObtenu(lignes: readonly LigneObtenue[]): boolean {
  return lignes.some((l) => (l.state === "SUCCESSFUL" || l.state === "NOT_CHARGED") && resteAToi(l));
}

/** Une note entière de 1 à 5, ou `null`. Une valeur reçue d'un formulaire se contourne. */
export function lireNote(brut: unknown): number | null {
  // Pas `parseInt` : il lit « 3.5 » comme 3, et une note tronquée en silence
  // passerait pour une note voulue (attrapé par le test le 09/11).
  const n = typeof brut === "number" ? brut : /^\s*\d+\s*$/.test(String(brut ?? "")) ? Number(brut) : Number.NaN;
  return Number.isInteger(n) && n >= NOTE_MIN && n <= NOTE_MAX ? n : null;
}

export type LectureTexte = { ok: true; texte: string | null } | { ok: false; motif: "TROP_LONG" };

/** Le texte d'un avis ou d'une réponse : facultatif pour l'avis, borné, sans blancs autour. */
export function lireTexte(brut: unknown, max: number): LectureTexte {
  const texte = String(brut ?? "").trim();
  if (texte.length > max) return { ok: false, motif: "TROP_LONG" };
  return { ok: true, texte: texte.length > 0 ? texte : null };
}

export interface Resume {
  total: number;
  /** Arrondie au dixième, comme Gumroad (`ROUND(…, 1)`). `null` sans avis. */
  moyenne: number | null;
  /** De 5 à 1 étoile, chaque part en pourcentage entier ; leur somme vaut 100. */
  repartition: Array<{ note: number; nombre: number; pourcentage: number }>;
}

/**
 * Le résumé d'une ressource, depuis ses compteurs par étoile
 * (`Product.ratingStars`, [une, deux, trois, quatre, cinq]).
 *
 * Les pourcentages se répartissent au **plus fort reste**, comme
 * `rating_percentages` chez Gumroad : arrondir chaque part séparément peut
 * donner 99 % ou 101 % au total, et une barre de répartition qui ne fait pas
 * 100 se voit.
 */
export function resumeDesNotes(etoiles: readonly number[]): Resume {
  const comptes = [0, 1, 2, 3, 4].map((i) => Math.max(0, Math.trunc(etoiles[i] ?? 0)));
  const total = comptes.reduce((s, n) => s + n, 0);
  const somme = comptes.reduce((s, n, i) => s + n * (i + 1), 0);
  const moyenne = total === 0 ? null : Math.round((somme / total) * 10) / 10;

  let pourcentages = comptes.map(() => 0);
  if (total > 0) {
    const bruts = comptes.map((n) => (n * 100) / total);
    pourcentages = bruts.map(Math.floor);
    let reste = 100 - pourcentages.reduce((s, p) => s + p, 0);
    // Les plus grandes parts fractionnaires reçoivent les points manquants.
    const ordre = bruts.map((b, i) => ({ i, f: b - Math.floor(b) })).sort((a, b) => b.f - a.f || b.i - a.i);
    for (const { i } of ordre) {
      if (reste <= 0) break;
      pourcentages[i] = pourcentages[i]! + 1;
      reste -= 1;
    }
  }

  return {
    total,
    moyenne,
    repartition: [5, 4, 3, 2, 1].map((note) => ({ note, nombre: comptes[note - 1]!, pourcentage: pourcentages[note - 1]! })),
  };
}

/**
 * La moyenne « bayésienne » : la note tirée vers la moyenne du site tant
 * qu'elle repose sur peu d'avis. Deux avis à 5 ne passent pas devant cent
 * vingt-huit avis à 4,8.
 *
 * `aPriori.poids` : combien d'avis « fictifs » à `aPriori.moyenne` on ajoute.
 * Prête pour un classement — **non branchée** : l'utilisateur a décidé le
 * 09/11 que les avis ne pèsent pas encore dans l'ordre de la grille.
 */
export function moyenneBayesienne(etoiles: readonly number[], aPriori: { moyenne: number; poids: number }): number | null {
  const comptes = [0, 1, 2, 3, 4].map((i) => Math.max(0, etoiles[i] ?? 0));
  const total = comptes.reduce((s, n) => s + n, 0);
  if (total + aPriori.poids === 0) return null;
  const somme = comptes.reduce((s, n, i) => s + n * (i + 1), 0);
  return (somme + aPriori.moyenne * aPriori.poids) / (total + aPriori.poids);
}

/** « 4 sur 5 », pour les lecteurs d'écran, là où l'œil lit ★★★★☆. */
export function noteEnToutesLettres(note: number): string {
  return `${note.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} sur ${NOTE_MAX}`;
}
