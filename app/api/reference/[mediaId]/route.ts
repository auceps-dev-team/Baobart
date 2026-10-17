import { NextResponse } from "next/server";

import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { rediriger } from "@/lib/http/redirection";
import { cleDeReference } from "@/lib/upload/provenance";
import { lireObjet, signerTelechargement, stockageConfigure } from "@/lib/upload/storage";

/**
 * La copie de référence d'un fichier vendu — pour le VENDEUR seul, en cas de
 * litige.
 *
 * Elle porte la licence et une qualité réduite ; ce n'est pas le produit, et
 * elle n'est jamais servie à l'acheteur. L'accès est donc fermé à tout autre
 * que le créateur du produit qui contient ce média — une référence directe non
 * protégée (IDOR) laisserait n'importe qui tirer la copie de n'importe quelle
 * œuvre en changeant l'identifiant dans l'URL.
 *
 * Comme le téléchargement d'un achat, le fichier ne transite pas par Next : on
 * décide, puis on redirige vers une URL signée, en `no-store`.
 */
export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  const utilisateur = await sessionCourante();
  if (!utilisateur) return rediriger("/connexion", 307);

  const { mediaId } = await params;

  // Le média doit être un fichier d'un produit DE cette personne. `findFirst`
  // avec le filtre `sellerId` fait toute la garde : rien ne sort sinon.
  const fichier = await db.productFile.findFirst({
    where: { mediaId, deletedAt: null, product: { sellerId: utilisateur.id } },
    select: { filename: true },
  });

  if (!fichier) {
    return texte("Aucune copie de référence accessible pour ce fichier.", 404);
  }

  if (!stockageConfigure()) {
    return texte("Le stockage n'est pas disponible pour le moment.", 503);
  }

  const cle = cleDeReference(mediaId);
  if (!(await lireObjet(cle))) {
    // Pas de référence : format non image, ou fichier envoyé avant cette
    // fonction et pas encore rattrapé (`scripts/poser-provenance.ts`).
    return texte(
      "Pas de copie de référence pour ce fichier (format non image, ou envoyé avant cette fonction).",
      404,
    );
  }

  const url = await signerTelechargement({
    cle,
    nomFichier: `reference-${fichier.filename}.webp`,
    dureeSecondes: 600,
  });

  const reponse = NextResponse.redirect(url, 302);
  reponse.headers.set("Cache-Control", "private, no-store");
  return reponse;
}

function texte(message: string, statut: number) {
  return new NextResponse(message, {
    status: statut,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
