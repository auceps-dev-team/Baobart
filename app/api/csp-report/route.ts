import { NextResponse } from "next/server";

import { journal } from "@/lib/observabilite/journal";
import { TAILLE_MAX_OCTETS, lireRapports } from "@/lib/securite/csp-rapport";
import { reponseTropDeGestes, verifierLimiteHttp } from "@/lib/securite/garde";

/**
 * Collecteur des violations CSP (Content Security Policy).
 *
 * Reçoit ce que les navigateurs signalent quand une ressource enfreint la
 * politique (`report-uri`, posé par `lib/securite/entetes.ts` quand
 * `CSP_REPORT_URI` est renseignée). Ce qui part au journal est trié par
 * `lib/securite/csp-rapport.ts` : la directive, l'origine bloquée, le chemin
 * de la page sans ses segments variables — jamais l'adresse complète, qui
 * porte parfois un jeton.
 *
 * Le corps est lu en texte et borné AVANT d'être analysé : `requete.json()`
 * lirait d'abord tout ce qu'on lui envoie.
 */

export const dynamic = "force-dynamic";

export async function POST(requete: Request): Promise<Response> {
  const passage = await verifierLimiteHttp("csp.rapport", requete);
  if (!passage.autorise) {
    return reponseTropDeGestes(passage);
  }

  const annonce = Number(requete.headers.get("content-length") ?? "0");
  if (annonce > TAILLE_MAX_OCTETS) return new NextResponse(null, { status: 413 });

  const brut = await requete.text();
  if (Buffer.byteLength(brut) > TAILLE_MAX_OCTETS) return new NextResponse(null, { status: 413 });

  let corps: unknown;
  try {
    corps = JSON.parse(brut);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  for (const violation of lireRapports(corps)) {
    journal.avertissement("csp: violation signalee", { ...violation });
  }
  return new NextResponse(null, { status: 204 });
}
