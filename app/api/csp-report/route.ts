import { NextResponse } from "next/server";

import { journal } from "@/lib/observabilite/journal";
import { reponseTropDeGestes, verifierLimiteHttp } from "@/lib/securite/garde";

/**
 * Collecteur d'incidents CSP (Content Security Policy).
 *
 * Reçoit les signalements émis par les navigateurs des visiteurs lorsqu'une
 * ressource enfreint la politique de contenu (mode Report-Only ou Enforce).
 * Les incidents sont consignés dans le journal d'observabilité sans divulguer
 * de données personnelles.
 */

export const dynamic = "force-dynamic";

export async function POST(requete: Request): Promise<Response> {
  const passage = await verifierLimiteHttp("csp.rapport", requete);
  if (!passage.autorise) {
    return reponseTropDeGestes(passage);
  }

  try {
    const corps = await requete.json();
    const rapport = (corps && typeof corps === "object" && "csp-report" in corps)
      ? (corps as Record<string, unknown>)["csp-report"]
      : corps;

    journal.avertissement("csp: violation signalee", {
      rapport: typeof rapport === "object" ? JSON.stringify(rapport) : String(rapport),
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 400 });
  }
}
