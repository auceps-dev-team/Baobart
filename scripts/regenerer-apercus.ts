/**
 * Refait les aperçus publiés avant le filigrane — point d'entrée.
 *
 *   pnpm apercus:regenerer                 → dit ce qu'il ferait, sans rien toucher
 *   pnpm apercus:regenerer -- --appliquer  → refait, repointe, supprime les anciens
 *
 * À lancer une fois, juste après le déploiement de v1.86.0. Il se rejoue sans
 * risque : un aperçu déjà refait n'a plus d'ancienne clé, il n'est pas revu.
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
    console.log(`${i.issue.padEnd(18)} ${i.cle}  ${detail}`);
  }

  const echecs = issues.filter((i) => i.issue === "ECHEC").length;
  console.log(
    `\n${issues.length} ancien(s) aperçu(s) — ${appliquer ? "appliqué" : "SIMULATION, rien n'a changé (ajouter --appliquer)"}` +
      (echecs ? ` — ${echecs} échec(s) : ces aperçus restent publics, sans filigrane.` : ""),
  );
  process.exit(echecs ? 1 : 0);
}

principal().catch((cause) => {
  console.error(cause);
  process.exit(2);
});
