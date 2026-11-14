/**
 * Écrire `lib/icones/donnees.ts` à partir des deux fichiers de la maquette.
 *
 * Séparé du script (`scripts/generer-icones.ts`) pour que le test puisse
 * refaire la génération et la comparer au fichier présent : un tracé modifié
 * dans la maquette sans régénération fait échouer `icones.test.ts`.
 */

import { lireLibellesPlanche, lireSourceIcones, type Forme } from "@/lib/icones/source";

export const CHEMIN_SOURCE = "Baobart Design/baobart-icons.js";
export const CHEMIN_PLANCHE = "Baobart Design/Baobart Icons.dc.html";
export const CHEMIN_DONNEES = "lib/icones/donnees.ts";

function formes(liste: Forme[]): string {
  if (liste.length === 0) return "[]";
  const lignes = liste.map((f) => `      { t: "${f.t}", a: ${JSON.stringify(f.a)} },`);
  return `[\n${lignes.join("\n")}\n    ]`;
}

/**
 * Le texte complet du module de données.
 *
 * Lève si la source et la planche ne s'accordent pas : une icône sans
 * libellé, un libellé sans icône, ou un groupe différent des deux côtés.
 * Mieux vaut un générateur qui refuse qu'un jeu d'icônes à moitié nommé.
 */
export function genererModule(source: string, planche: string): string {
  const icones = lireSourceIcones(source);
  const libelles = lireLibellesPlanche(planche);

  const ecarts: string[] = [];
  for (const i of icones) {
    const l = libelles.get(i.nom);
    if (!l) ecarts.push(`« ${i.nom} » n'a pas de libellé sur la planche`);
    else if (l.groupe !== i.groupe) ecarts.push(`« ${i.nom} » : groupe « ${i.groupe} » dans la source, « ${l.groupe} » sur la planche`);
  }
  const noms = new Set(icones.map((i) => i.nom));
  for (const nom of libelles.keys()) {
    if (!noms.has(nom)) ecarts.push(`« ${nom} » est sur la planche mais pas dans la source`);
  }
  if (ecarts.length > 0) {
    throw new Error(`La source et la planche ne s'accordent pas :\n- ${ecarts.join("\n- ")}`);
  }

  const entrees = icones.map((i) => {
    const { libelle } = libelles.get(i.nom)!;
    return [
      `  ${i.nom}: {`,
      `    groupe: ${JSON.stringify(i.groupe)},`,
      `    libelle: ${JSON.stringify(libelle)},`,
      `    formes: ${formes(i.formes)},`,
      `    lignes: ${formes(i.lignes)},`,
      `  },`,
    ].join("\n");
  });

  return `/**
 * Les ${icones.length} icônes Baobart — FICHIER GÉNÉRÉ, ne pas modifier à la main.
 *
 * Tracés : \`${CHEMIN_SOURCE}\`. Libellés : \`${CHEMIN_PLANCHE}\`.
 * Régénérer : \`pnpm icones:generer\`. \`lib/icones/icones.test.ts\` échoue si
 * ce fichier ne correspond plus à la maquette.
 *
 * Les identifiants sont ceux de la maquette (\`<bb-icon name="home">\` →
 * \`<Icone nom="home" />\`) : les traduire obligerait chaque lecteur à tenir
 * une table de correspondance entre les deux.
 */

import type { DefinitionIcone } from "@/lib/icones/source";

export const ICONES = {
${entrees.join("\n")}
} as const satisfies Record<string, DefinitionIcone>;

export type NomIcone = keyof typeof ICONES;
`;
}
