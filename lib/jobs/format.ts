import { formatMoney, type Currency } from "@/lib/i18n/money";

/**
 * Les deux formats d'affichage propres aux offres d'emploi.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI CE FICHIER EXISTE
 *
 * `budget` et `ilYA` vivaient dans `app/jobs/page.tsx`, et la fiche
 * `app/jobs/[id]/page.tsx` les importait de là. Ça marchait au développement
 * et **cassait la construction** : Next vérifie qu'un `page.tsx` n'exporte
 * que ce qu'il reconnaît — `default`, `metadata`, `dynamic`… — et refuse le
 * reste. L'erreur ne se voit qu'une fois `.next/types/` engendré, c'est-à-dire
 * après un premier `next dev` ou `next build` : elle est restée invisible
 * tant que la vérification de types tournait sur un dossier `.next` vide.
 *
 * La leçon vaut pour les trois autres CMS : **une fonction partagée entre deux
 * écrans ne vit jamais dans l'un des deux**.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * `ilYA` EXISTE DÉJÀ AILLEURS, ET CE N'EST PAS UN DOUBLON
 *
 * `lib/social/regles.ts` en porte un autre, à la granularité fine — « à
 * l'instant », « il y a 12 min » — parce qu'un commentaire se lit à la minute.
 * Une offre d'emploi non : « il y a 3 jours » suffit, et afficher « il y a
 * 14 h » sur une annonce donnerait une précision que personne n'utilise.
 *
 * Les fondre obligerait l'un des deux appelants à accepter la mauvaise
 * échelle.
 */

/**
 * Le budget, tel qu'on peut l'annoncer.
 *
 * Beaucoup d'offres n'en donnent aucun, et c'est légitime. Écrire « 0 F »
 * plutôt que « non précisé » ferait croire à du travail gratuit.
 */
export function budget(
  min: number | null,
  max: number | null,
  devise: string,
): string {
  const d = devise as Currency;
  if (min !== null && max !== null && min !== max) {
    return `${formatMoney(min, d)} – ${formatMoney(max, d)}`;
  }
  const seul = min ?? max;
  return seul === null ? "Budget non précisé" : formatMoney(seul, d);
}

/** « il y a 3 jours ». Approximatif à dessein : une date exacte n'aide pas ici. */
export function ilYA(quand: Date, maintenant = new Date()): string {
  const jours = Math.floor((maintenant.getTime() - quand.getTime()) / 86_400_000);
  if (jours <= 0) return "aujourd'hui";
  if (jours === 1) return "hier";
  if (jours < 30) return `il y a ${jours} jours`;
  const mois = Math.floor(jours / 30);
  return `il y a ${mois} mois`;
}
