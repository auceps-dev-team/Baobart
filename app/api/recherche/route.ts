import { NextResponse } from "next/server";

import { rechercher, rechercherCreateurs } from "@/lib/feed/queries";

/** Suggestions du champ de recherche de l'en-tête. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  // Les créateurs aussi (Q-12), à côté des ressources, sans changer `items`.
  const [items, createurs] = await Promise.all([rechercher(q), rechercherCreateurs(q)]);
  return NextResponse.json({ items, createurs });
}
