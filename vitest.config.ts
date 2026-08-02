import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // lib/domain/ et lib/i18n/ doivent rester testables sans React ni DOM
    // (BLUEPRINT §7 : « garder lib/domain sans dépendances React »).
    include: ["lib/**/*.test.ts", "jobs/**/*.test.ts"],
  },
});
