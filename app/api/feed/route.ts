import { NextResponse } from "next/server";

import { compterRessources, listerFeed } from "@/lib/feed/queries";
import { FILTRES, type Filtre } from "@/lib/feed/types";

/**
 * Page suivante du feed, ou première page d'une famille.
 *
 * Le curseur est opaque et vient de la réponse précédente : le client ne
 * calcule jamais de position, il ne fait que rendre ce qu'on lui a donné.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const demande = params.get("filtre");
  const filtre: Filtre =
    demande && (FILTRES as readonly string[]).includes(demande)
      ? (demande as Filtre)
      : "Tous";

  const cursor = params.get("cursor");

  const [page, total] = await Promise.all([
    listerFeed({ cursor, filtre }),
    compterRessources(filtre),
  ]);

  return NextResponse.json({ ...page, total });
}
