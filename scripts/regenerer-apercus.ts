/**
 * Refait les aperçus d'une recette périmée — point d'entrée.
 *
 *   pnpm apercus:regenerer                 → dit ce qu'il ferait, sans rien toucher
 *   pnpm apercus:regenerer -- --appliquer  → refait, repointe, supprime les anciens
 *
 * À lancer une fois après chaque déploiement qui change `VERSION_APERCU`
 * (v1.86.0, v1.87.0), et après tout jeu de démonstration : il donne aussi un
 * aperçu filigrané aux couvertures qui n'en ont jamais eu (second passage).
 * Il se rejoue sans risque : un média déjà refait n'a plus de clé périmée, une
 * couverture déjà protégée n'est plus revue.
 * Voir `lib/upload/regeneration.ts`.
 */

import { regenererApercus } from "@/lib/upload/regeneration";

async function principal(): Promise<void> {
  const appliquer = process.argv.includes("--appliquer");
  const issues = await regenererApercus({ appliquer });

  for (const i of issues) {
    if ("produit" in i) {
      const detail = i.issue === "COUVERTURE_ECHEC" ? i.raison : `depuis le média ${i.media}`;
      console.log(`${i.issue.padEnd(20)} produit ${i.produit}  ${detail}\n${" ".repeat(21)}${i.ancienne}`);
      continue;
    }
    const detail =
      i.issue === "REFAIT"
        ? `${i.couvertures} couverture(s)`
        : i.issue === "ECHEC"
          ? i.raison
          : "";
    console.log(`${i.issue.padEnd(20)} ${i.media}  ${detail}\n${" ".repeat(21)}${i.cles.join(", ")}`);
  }

  const echecs = issues.filter((i) => i.issue === "ECHEC" || i.issue === "COUVERTURE_ECHEC").length;
  const medias = issues.filter((i) => !("produit" in i)).length;
  console.log(
    `\n${medias} média(s) à aperçu périmé, ${issues.length - medias} couverture(s) sans aperçu — ` +
      `${appliquer ? "appliqué" : "SIMULATION, rien n'a changé (ajouter --appliquer)"}` +
      (echecs ? ` — ${echecs} échec(s) : ces images restent publiques, sans filigrane.` : ""),
  );
  process.exit(echecs ? 1 : 0);
}

principal().catch((cause) => {
  console.error(cause);
  process.exit(2);
});
