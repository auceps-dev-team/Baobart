import { NextResponse } from "next/server";

import { verifierLicence } from "@/lib/licences/verification";
import { reponseTropDeGestes, verifierLimiteHttp } from "@/lib/securite/garde";

/**
 * POST /api/licences/verifier — la vérification d'une clé, pour les programmes.
 *
 *   curl "$APP_URL/api/licences/verifier" \
 *     -d "produit=<identifiant de la ressource>" \
 *     -d "cle=XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
 *
 * Paramètres, en formulaire ou en JSON : `produit`, `cle`, et `incrementer`
 * (« false » pour ne pas compter cette vérification). Réponse 200 quand la clé
 * vaut pour cette ressource, 404 sinon — la forme de Gumroad
 * (`lib/licences/verification.ts`).
 */
export async function POST(requete: Request) {
  const passage = await verifierLimiteHttp("licence.verification", requete);
  if (!passage.autorise) return reponseTropDeGestes(passage);

  let p: Record<string, unknown> = {};
  try {
    p = (requete.headers.get("content-type") ?? "").includes("application/json")
      ? ((await requete.json()) as Record<string, unknown>)
      : Object.fromEntries((await requete.formData()).entries());
  } catch {
    // Un corps illisible tombe sur le refus ci-dessous.
  }

  const produitId = typeof p.produit === "string" ? p.produit : "";
  const cle = typeof p.cle === "string" ? p.cle : "";
  if (!produitId || !cle) {
    return NextResponse.json({ succes: false, message: "Donne « produit » et « cle »." }, { status: 400 });
  }

  const v = await verifierLicence({ produitId, cle, incrementer: String(p.incrementer ?? "true") !== "false" });
  if (!v.ok) {
    return NextResponse.json(
      {
        succes: false,
        message: v.motif === "DESACTIVEE" ? "Cette clé a été désactivée." : "Cette clé ne correspond à aucun achat de cette ressource.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ succes: true, utilisations: v.utilisations, achat: v.achat });
}
