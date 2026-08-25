import type { ReactNode } from "react";

import { exigerAdministrateur } from "@/lib/auth/acces-administration";

/**
 * Première barrière de l'espace d'administration.
 *
 * Elle ne suffit pas, et ce n'est pas un oubli : Next.js réutilise un layout
 * lors d'une navigation entre pages sœurs plutôt que de le réexécuter. Chaque
 * page appelle donc `exigerAdministrateur()` pour son propre compte. Celle-ci
 * couvre l'arrivée directe sur une URL — le cas de loin le plus courant quand
 * quelqu'un essaie une adresse au hasard.
 */
export default async function LayoutSysteme({
  children,
}: {
  children: ReactNode;
}) {
  await exigerAdministrateur();
  return <>{children}</>;
}
