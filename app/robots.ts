import type { MetadataRoute } from "next";

import { consignesAuxRobots } from "@/lib/seo/plan";

/**
 * `/robots.txt`. Dynamique pour lire `APP_URL` au démarrage plutôt qu'au
 * build : l'image Docker est construite sans environnement de production.
 */
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return consignesAuxRobots();
}
