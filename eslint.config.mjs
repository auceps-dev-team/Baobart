import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "Baobart Design/**",
      "Doc/**",
      // Scripts de recette jetables, gardés hors de git sur certains postes
      // (`require()`, variables globales) : ils cassaient `pnpm lint` en local
      // sans que la CI, qui ne les a pas, le voie jamais.
      "qa/**",
      // Copies de travail des sessions d'agent : chacune porte son propre
      // `.next/` et ses fichiers générés, que `pnpm lint` lisait en double.
      ".claude/**",
      // Les mêmes, pour les agents d'autres éditeurs (`.agents/worktrees/…`,
      // relevé le 27/10 : deux erreurs dans la copie de Gemini, aucune ici).
      ".agents/**",
      ".next/**",
      "node_modules/**",
      "next-env.d.ts", // fichier généré par Next.js
    ],
  },
];

export default eslintConfig;
