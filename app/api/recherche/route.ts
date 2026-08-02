import { NextResponse } from "next/server";

import { rechercher } from "@/lib/feed/queries";

/** Suggestions du champ de recherche de l'en-tête. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json({ items: await rechercher(q) });
}
