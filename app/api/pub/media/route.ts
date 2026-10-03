import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { peut } from "@/lib/auth/administration";
import { sessionCourante } from "@/lib/auth/session";
import { journal } from "@/lib/observabilite/journal";
import {
  TAILLE_MAX_IMAGE,
  TAILLE_MAX_VIDEO,
  dimensionsImage,
  reconnaitreMedia,
} from "@/lib/publicites/formats";
import { DOSSIER_MEDIAS } from "@/lib/publicites/service";
import { deposerObjet, stockageConfigure, urlPublique } from "@/lib/upload/storage";

/**
 * Déposer l'image ou la vidéo d'une bannière.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE ROUTE, ET NON UNE ACTION SERVEUR COMME POUR LE BLOG
 *
 * Une action serveur refuse tout corps au-delà d'un mégaoctet tant qu'on ne
 * relève pas `serverActions.bodySizeLimit` — lu dans
 * `next/dist/server/app-render/action-handler.js`. Une vidéo de quinze
 * secondes en pèse dix. Relever la limite l'aurait relevée pour TOUTES les
 * actions du site, connexion comprise ; une route n'ouvre que cette porte-ci.
 *
 * Ce qu'une route ne fait pas d'elle-même et qu'une action faisait : vérifier
 * l'origine. Ici c'est le cookie de session qui s'en charge — `SameSite=Lax`
 * (`lib/auth/session.ts`) ne part pas avec un envoi de formulaire venu d'un
 * autre site, donc un tel envoi arrive sans session et reçoit un 404.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 404 POUR TOUT REFUS D'ACCÈS
 *
 * Comme le reste de l'administration (`lib/auth/acces-administration.ts`) :
 * « accès refusé » confirmerait qu'il y a ici quelque chose à forcer.
 */
export async function POST(requete: Request) {
  const qui = await sessionCourante();
  if (!qui || !peut(qui.role, "promouvoir_du_contenu")) {
    return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
  }

  if (!stockageConfigure()) {
    return refus("Le stockage n'est pas configuré.", 503);
  }

  // Avant de lire le corps : sans ce contrôle, un envoi de deux gigaoctets
  // serait entièrement monté en mémoire pour être refusé ensuite.
  const annonce = Number(requete.headers.get("content-length") ?? "0");
  if (annonce > TAILLE_MAX_VIDEO + 64 * 1024) {
    return refus(`Le fichier dépasse ${mo(TAILLE_MAX_VIDEO)} Mo.`, 413);
  }

  let fichier: FormDataEntryValue | null;
  try {
    fichier = (await requete.formData()).get("fichier");
  } catch {
    return refus("L'envoi ne se lit pas. Réessaie.");
  }
  if (!(fichier instanceof File) || fichier.size === 0) {
    return refus("Choisis un fichier.");
  }

  const octets = Buffer.from(await fichier.arrayBuffer());
  const format = reconnaitreMedia(octets);
  if (!format) {
    return refus(
      "Format non accepté. Images : PNG, JPEG, GIF ou WebP — pas de SVG, qui peut contenir du code. Vidéos : MP4 ou WebM.",
    );
  }

  const plafond = format.nature === "IMAGE" ? TAILLE_MAX_IMAGE : TAILLE_MAX_VIDEO;
  if (octets.length > plafond) {
    return refus(
      `${format.nature === "IMAGE" ? "L'image" : "La vidéo"} dépasse ${mo(plafond)} Mo. Réduis-la avant de l'envoyer.`,
      413,
    );
  }

  const dimensions = format.nature === "IMAGE" ? dimensionsImage(octets) : null;
  if (format.nature === "IMAGE" && !dimensions) {
    return refus("Les dimensions de l'image ne se lisent pas. Réenregistre-la et renvoie-la.");
  }

  // Un nom tiré au sort, jamais celui du fichier : il peut porter un chemin,
  // ou le nom d'un client.
  const cle = `${DOSSIER_MEDIAS}${randomUUID()}.${format.ext}`;
  try {
    await deposerObjet({ cle, corps: octets, contentType: format.mime });
  } catch (cause) {
    journal.erreur("média de publicité non déposé", {
      cause: cause instanceof Error ? cause.message : String(cause),
    });
    return refus("Le dépôt a échoué. Réessaie.", 502);
  }

  return NextResponse.json({
    url: urlPublique(cle),
    nature: format.nature,
    largeur: dimensions?.largeur ?? null,
    hauteur: dimensions?.hauteur ?? null,
  });
}

function refus(message: string, status = 400) {
  return NextResponse.json({ erreur: message }, { status });
}

function mo(octets: number): number {
  return Math.round(octets / 1024 / 1024);
}
