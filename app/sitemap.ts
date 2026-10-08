import type { MetadataRoute } from "next";

import { planDuSite } from "@/lib/seo/plan";

/**
 * `/sitemap.xml`. Ce qu'il contient et pourquoi : `lib/seo/plan.ts`.
 *
 * Dynamique, et pas seulement par fraîcheur : prérendu au build, il exigerait
 * une base joignable pendant `next build` — ce que l'intégration continue n'a
 * pas.
 */
export const dynamic = "force-dynamic";

export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return planDuSite();
}
