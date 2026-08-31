import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

/**
 * Remet la base du navigateur à neuf avant la campagne.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI ICI, ET PAS ENTRE CHAQUE TEST
 *
 * Les tests d'intégration vident les tables entre chaque cas : ils appellent
 * des fonctions, ils peuvent se le permettre.
 *
 * Un parcours au navigateur, non. Il tient une session dans un cookie, une page
 * ouverte, parfois un rendu déjà en cache côté serveur. Vider la base sous ses
 * pieds produirait des échecs qui n'ont rien à voir avec ce qu'on teste.
 *
 * On repart donc d'une base propre **une fois**, et chaque parcours crée ses
 * propres comptes sous un nom unique. C'est un peu plus de discipline dans les
 * tests, et beaucoup moins d'échecs inexplicables.
 */
export default async function preparer(): Promise<void> {
  if (existsSync(".env")) {
    process.loadEnvFile(".env");
  }

  console.log("Préparation de la base du navigateur…");

  execFileSync(process.execPath, ["scripts/setup-test-db.mjs", "e2e"], {
    stdio: "inherit",
  });
}
