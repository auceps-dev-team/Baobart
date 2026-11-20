import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next 16 publie directement des configurations « flat » (des
// tableaux d'objets). Jusqu'à la 15, il fallait les traduire depuis l'ancien
// format avec `FlatCompat` (@eslint/eslintrc) ; donner la 16 à `FlatCompat`
// plantait (« Converting circular structure to JSON », relevé sur #47 le
// 14/11/2026). On les étale donc telles quelles.
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Les types (@types/react 19.2) annoncent `useEffectEvent` ; le React que
      // Next 15.5 sert au routeur `app` (19.2.0-canary du 18/08/2025) ne
      // l'exporte pas. Mesuré le 20/11/2026 : `tsc` passe, la construction ne
      // dit qu'un avertissement, et le composant plante à l'ouverture. À
      // retirer au passage à Next 16.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              importNames: ["useEffectEvent"],
              message:
                "Absent du React embarqué par Next 15.5 : la page planterait. Voir eslint.config.mjs.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
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
  ]),
]);
