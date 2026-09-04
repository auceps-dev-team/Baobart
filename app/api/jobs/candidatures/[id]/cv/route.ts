import { NextResponse } from "next/server";

import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { signerTelechargement } from "@/lib/upload/storage";

/**
 * Le CV d'un candidat, servi au seul recruteur qui a écrit l'offre.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ELLE NE REND JAMAIS L'URL SIGNÉE AU HTML
 *
 * Une page qui rendrait cinquante URL signées les mettrait toutes en clair dans
 * la source, exportables par n'importe qui les lisant par-dessus l'épaule du
 * recruteur. Ici, la page ne connaît que l'identifiant de la candidature et
 * cette route ; l'URL n'existe que le temps de la redirection.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 404 POUR TOUT REFUS
 *
 * Non connecté, mauvaise offre, candidature d'autrui : la même réponse. Dire
 * « accès refusé » à une personne qui n'est pas propriétaire lui apprendrait
 * qu'un CV existe à cet identifiant, et à quel endroit chercher.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const utilisateur = await sessionCourante();
  if (!utilisateur) return quatreCentQuatre();

  const candidature = await db.jobApplication.findFirst({
    where: { id, job: { recruiterId: utilisateur.id } },
    select: { mediaId: true },
  });

  if (!candidature?.mediaId) return quatreCentQuatre();

  const media = await db.mediaAsset.findUnique({
    where: { id: candidature.mediaId },
    select: { s3Key: true },
  });

  if (!media) return quatreCentQuatre();

  // Cinq minutes suffisent : le recruteur clique, le fichier s'ouvre. Un lien
  // qui traînerait deux jours dans un onglet pourrait servir à quelqu'un
  // d'autre qui aurait accès au navigateur.
  const url = await signerTelechargement({
    cle: media.s3Key,
    nomFichier: "cv.pdf",
    dureeSecondes: 300,
  });

  return NextResponse.redirect(url, { status: 303 });
}

function quatreCentQuatre() {
  return new NextResponse("Not found", { status: 404 });
}
