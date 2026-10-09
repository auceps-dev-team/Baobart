/**
 * Refait les aperçus d'une recette périmée — point d'entrée.
 *
 *   pnpm apercus:regenerer                 → dit ce qu'il ferait, sans rien toucher
 *   pnpm apercus:regenerer -- --appliquer  → refait, repointe, supprime les anciens
 *
 * À lancer une fois après chaque déploiement qui change `VERSION_APERCU`
 * (v1.86.0, v1.87.0). Il se rejoue sans risque : un média déjà refait n'a plus
 * de clé périmée, il n'est pas revu.
 * Voir `lib/upload/regeneration.ts`.
 */

import { regenererApercus } from "@/lib/upload/regeneration";

async function principal(): Promise<void> {
  const appliquer = process.argv.includes("--appliquer");
  const issues = await regenererApercus({ appliquer });

  for (const i of issues) {
    const detail =
      i.issue === "REFAIT"
        ? `${i.couvertures} couverture(s)`
        : i.issue === "ECHEC"
          ? i.raison
          : "";
    console.log(`${i.issue.padEnd(18)} ${i.media}  ${detail}\n${" ".repeat(19)}${i.cles.join(", ")}`);
  }

  const echecs = issues.filter((i) => i.issue === "ECHEC").length;
  console.log(
    `\n${issues.length} média(s) à aperçu périmé — ${appliquer ? "appliqué" : "SIMULATION, rien n'a changé (ajouter --appliquer)"}` +
      (echecs ? ` — ${echecs} échec(s) : ces aperçus restent publics, sans filigrane.` : ""),
  );
  process.exit(echecs ? 1 : 0);
}

principal().catch((cause) => {
  console.error(cause);
  process.exit(2);
});
