import { NextResponse } from "next/server";
import type { RefusAcces } from "@/lib/domain/delivery";

import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { autoriserTelechargement } from "@/lib/domain/downloads";
import { rediriger } from "@/lib/http/redirection";
import { adresseDe } from "@/lib/securite/adresse";
import { signerTelechargement, stockageConfigure } from "@/lib/upload/storage";

/**
 * Retrait d'un fichier acheté.
 *
 * Le fichier n'est **jamais** servi par Next : on décide, on enregistre, puis on
 * renvoie vers une URL signée valable le temps du transfert. Faire transiter
 * deux cents mégaoctets par le serveur pour finir au même endroit coûterait la
 * bande passante deux fois, et bloquerait un processus pendant toute la durée.
 *
 * Un fichier hébergé ailleurs (lien externe) passe par la même porte et la
 * même inscription, puis la route y redirige au lieu de signer.
 *
 * L'ordre compte : la consommation est inscrite **avant** que le lien parte.
 * L'inverse laisserait passer des téléchargements non comptés à la moindre
 * erreur, ce qui fausse à la fois la facture du créateur et le quota de
 * l'abonné.
 */

/**
 * Ce que la personne peut corriger, dit dans ses mots.
 *
 * Typé sur `RefusAcces` et non sur `string` : un motif ajouté sans message
 * tomberait autrement dans le texte par défaut, qui ne dit rien d'utile — et
 * personne ne s'en apercevrait avant de lire un rapport d'incident.
 */
const MESSAGES: Record<RefusAcces, string> = {
  COMMANDE_NON_PAYEE:
    "Cette ressource n'est pas dans tes achats. Achète-la pour la télécharger.",
  REMBOURSE:
    "Cette commande a été remboursée : le fichier n'est plus accessible.",
  LITIGE:
    "Le paiement de cette commande est contesté. L'accès reprendra si la contestation est levée.",
  ACCES_RETIRE:
    "L'accès à cette ressource a été retiré par son créateur. Écris-lui si tu penses que c'est une erreur.",
  RETRAIT_JURIDIQUE:
    "Cette ressource fait l'objet d'une notification juridique et n'est plus distribuée le temps que le dossier soit tranché. Son créateur n'y peut rien.",
  ABONNEMENT_INACTIF:
    "Ton abonnement n'est plus actif. Renouvelle-le pour reprendre tes téléchargements.",
  ACCES_EXPIRE: "Ton accès à cette ressource est arrivé à terme.",
  QUOTA_EPUISE:
    "Tu as utilisé tous les téléchargements de ton forfait ce mois-ci.",
};

export async function GET(
  requete: Request,
  { params }: { params: Promise<{ fichierId: string }> },
) {
  const utilisateur = await sessionCourante();
  if (!utilisateur) {
    // Relatif : mesuré le 08/10 sous `next start`, `new URL("/connexion",
    // requete.url)` donnait http://localhost:3300/connexion — l'hôte d'écoute.
    // Voir lib/http/redirection.ts. 307, comme avant.
    return rediriger("/connexion", 307);
  }

  const { fichierId } = await params;

  const existe = await db.productFile.findUnique({
    where: { id: fichierId },
    select: { id: true, externalUrl: true, media: { select: { s3Key: true } } },
  });

  if (!existe) {
    return refus("Ce fichier n'existe pas.", 404);
  }

  // Un lien externe ne passe pas par notre stockage : une panne de celui-ci
  // n'a pas à le fermer.
  if (existe.externalUrl === null && !stockageConfigure()) {
    return refus("Le téléchargement n'est pas disponible pour le moment.", 503);
  }

  const resultat = await autoriserTelechargement({
    userId: utilisateur.id,
    productFileId: fichierId,
    userAgent: requete.headers.get("user-agent"),
    // L'en-tête vient du proxy et n'est pas une preuve d'identité — elle sert
    // au journal d'accès, jamais à décider.
    // `adresseDe`, pas le premier élément de `x-forwarded-for` : celui-là, le
    // client l'écrit lui-même, et le journal de consommation garderait
    // l'adresse qu'il a choisie. Voir `lib/securite/adresse.ts`.
    ipAddress: adresseDe(requete),
  });

  if (!resultat.decision.autorise || !resultat.fichier) {
    const raison = resultat.decision.autorise
      ? "COMMANDE_NON_PAYEE"
      : resultat.decision.raison;
    return refus(MESSAGES[raison] ?? "Téléchargement refusé.", 403);
  }

  // Un fichier hébergé ailleurs (décidé le 15/10/2026, voir
  // lib/products/lien-externe.ts) : la porte est passée, on y envoie. Le lien
  // vient de la transaction qui a décidé, pas de la lecture ci-dessus — un lien
  // changé entre les deux mènerait sinon là où la décision n'a pas regardé.
  //
  // `no-store` : cette réponse ne vaut que pour cette personne. Un cache
  // partagé qui la garderait servirait l'adresse au suivant, sans contrôle.
  if (resultat.fichier.externalUrl !== null) {
    const reponse = rediriger(resultat.fichier.externalUrl, 302);
    reponse.headers.set("Cache-Control", "private, no-store");
    return reponse;
  }

  // Impossible par la contrainte `ProductFile_un_seul_emplacement` ; dit ici
  // plutôt que d'appeler le stockage avec une clé vide.
  if (!existe.media) {
    return refus("Ce fichier n'existe pas.", 404);
  }

  const url = await signerTelechargement({
    cle: existe.media.s3Key,
    nomFichier: resultat.fichier.filename,
    dureeSecondes: resultat.dureeUrlSecondes ?? 600,
  });

  // 302 et non 307 : le navigateur suit le lien et déclenche la sauvegarde,
  // sans réémettre la requête vers notre route.
  return NextResponse.redirect(url, 302);
}

function refus(message: string, statut: number) {
  return new NextResponse(message, {
    status: statut,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
