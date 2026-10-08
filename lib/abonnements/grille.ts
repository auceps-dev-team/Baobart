/**
 * Ce que dit chaque carte de la grille tarifaire.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX SORTES DE PROMESSES, ET ELLES NE SE MÉLANGENT PAS
 *
 * Accès libre est ouvert : sa liste dit ce que le code fait aujourd'hui, et
 * rien d'autre — relue le 05/10 contre `lib/domain/downloads.ts` (ressources
 * offertes), `lib/cms/droits.ts` (services et événements : badge ET
 * abonnement). Elle ne promet ni ressource payante, ni licence que le
 * créateur n'a pas choisie.
 *
 * Les forfaits payants sont grisés (décidé le 05/10) : leur liste reprend ce
 * qui est en base (`Plan.downloadsPerMonth`, `licenseIncluded`, `features`),
 * sous l'étiquette « bientôt ». Résolution, filigrane, badge : rien de cela
 * n'est appliqué aujourd'hui — c'est précisément pourquoi la carte est grisée.
 *
 * Module pur.
 */

export const ACCES_LIBRE: readonly string[] = [
  "Toutes les ressources offertes, sans limite",
  "Les ressources payantes, à l'unité, au prix du créateur",
  "Collections, communautés, commentaires",
  "Pour les pros badgés : publier services et événements",
];

const LICENCE: Record<string, string> = {
  PERSONAL: "Licence personnelle",
  COMMERCIAL: "Licence commerciale",
  EXTENDED: "Licence étendue",
};

/** Les libellés des clés de `Plan.features`, telles que le seed les écrit. */
const FONCTION: Record<string, (v: unknown) => string | null> = {
  resolution: (v) => (typeof v === "string" ? `Résolution ${v}` : null),
  services: (v) => (typeof v === "string" ? `Services : ${v}` : null),
  badge: (v) => (typeof v === "string" ? `Badge « ${v} »` : null),
  earlyAccess: (v) => (v === true ? "Accès anticipé aux nouveautés" : null),
};

export function fonctionsDuForfait(plan: {
  downloadsPerMonth: number | null;
  licenseIncluded: string | null;
  includesPaidResources: boolean;
  features: unknown;
}): string[] {
  const lignes: string[] = [];
  if (plan.includesPaidResources) {
    lignes.push(
      plan.downloadsPerMonth === null
        ? "Ressources payantes sans les acheter, sans limite"
        : `${plan.downloadsPerMonth} ressources payantes par mois sans les acheter`,
    );
  }
  if (plan.licenseIncluded) lignes.push(LICENCE[plan.licenseIncluded] ?? plan.licenseIncluded);
  const f = (plan.features ?? {}) as Record<string, unknown>;
  for (const [cle, dire] of Object.entries(FONCTION)) {
    const ligne = dire(f[cle]);
    if (ligne) lignes.push(ligne);
  }
  return lignes;
}
