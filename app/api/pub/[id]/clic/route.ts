import { NextResponse } from "next/server";

import { ajouterClic } from "@/lib/publicites/attribution";
import { parMinute } from "@/lib/publicites/limites";
import { sousLePlafond } from "@/lib/publicites/plafond";
import { enregistrerClic, jourDe, lienDe, reglagesEnCache } from "@/lib/publicites/service";
import { COOKIE_CLICS, DUREE_ATTRIBUTION_S } from "@/lib/publicites/types";
import { sujetAnonyme } from "@/lib/securite/adresse";
import { verifierLimiteHttp } from "@/lib/securite/garde";

/**
 * Un clic sur une bannière : on le compte, puis on part.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA DESTINATION N'EST PAS DANS L'ADRESSE
 *
 * On redirige vers le lien rangé avec la pub, jamais vers un paramètre de la
 * requête. Une route « /clic?vers=… » serait une redirection ouverte : un lien
 * baobart.ci qui mène n'importe où, l'outil préféré de l'hameçonnage.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN CLIC REFUSÉ MÈNE QUAND MÊME À DESTINATION
 *
 * Au-delà de la limite, le clic n'est pas compté — mais le visiteur arrive
 * là où la bannière promettait. Le punir d'un écran d'erreur pour un compteur
 * serait inverser les priorités.
 *
 * Même chose au-delà du plafond du jour (un clic compté par adresse et par pub,
 * par défaut — réglable depuis l'écran des publicités) : le second clic d'une
 * même adresse ne compte pas, et mène quand même où il doit.
 */
export async function GET(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { limites } = await reglagesEnCache();
  const passage = await verifierLimiteHttp("pub.clic", requete, parMinute(limites.clicsParMinute));

  const maintenant = new Date();
  const aCompter =
    passage.autorise &&
    (await sousLePlafond({
      nature: "clic",
      sujet: sujetAnonyme(requete),
      ids: [id],
      plafond: limites.clicsParVisiteurJour,
      jour: jourDe(maintenant),
    })).length > 0;

  const lien = aCompter ? await enregistrerClic(id, maintenant) : await lienDe(id);
  if (!lien) return NextResponse.redirect(new URL("/", requete.url), 303);

  const reponse = NextResponse.redirect(new URL(lien, requete.url), 303);

  if (passage.autorise) {
    const precedent = requete.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${COOKIE_CLICS}=([^;]*)`))?.[1];
    reponse.cookies.set(COOKIE_CLICS, ajouterClic(precedent, id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DUREE_ATTRIBUTION_S,
    });
  }

  // Un navigateur ou un relais ne doit pas garder la redirection : le clic
  // suivant ne serait jamais compté.
  reponse.headers.set("Cache-Control", "no-store");
  return reponse;
}
