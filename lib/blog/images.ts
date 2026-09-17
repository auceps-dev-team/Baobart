"use server";

import { randomUUID } from "node:crypto";

import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import { journal } from "@/lib/observabilite/journal";
import { TAILLE_MAX, reconnaitre } from "@/lib/blog/formats-image";
import {
  PREFIXE_PUBLIC,
  deposerObjet,
  stockageConfigure,
  urlPublique,
} from "@/lib/upload/storage";

/**
 * Téléverser une image d'article.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUI EST ACCEPTÉ SE DÉCIDE AILLEURS
 *
 * `lib/blog/formats-image.ts` est pur et porte la règle : quatre formats
 * matriciels, reconnus à leurs premiers octets, et **pas de SVG** — un SVG
 * peut contenir un `<script>` et s'exécuterait avec nos droits.
 *
 * Ce fichier-ci ne fait que le câblage : garde, taille, dépôt, adresse.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * RÉSERVÉ À QUI PUBLIE
 *
 * Le blog est fermé (§18.1). Cette action dépose un objet public sur notre
 * stockage : l'ouvrir plus largement donnerait à n'importe qui un hébergement
 * d'images gratuit sous notre nom.
 */

export type Depot =
  | { ok: true; url: string }
  | { ok: false; message: string };

export async function televerserImageArticle(
  donnees: FormData,
): Promise<Depot> {
  await exigerLePouvoir("publier_du_contenu");

  if (!stockageConfigure()) {
    return { ok: false, message: "Le stockage n'est pas configuré." };
  }

  const fichier = donnees.get("image");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, message: "Choisis une image." };
  }

  if (fichier.size > TAILLE_MAX) {
    return {
      ok: false,
      message: `L'image dépasse ${Math.round(TAILLE_MAX / 1024 / 1024)} Mo. Réduis-la avant de l'envoyer.`,
    };
  }

  const octets = Buffer.from(await fichier.arrayBuffer());
  const format = reconnaitre(octets);

  if (!format) {
    return {
      ok: false,
      message:
        "Format non accepté. PNG, JPEG, GIF ou WebP — pas de SVG : un SVG peut contenir du code.",
    };
  }

  // Le nom est tiré au sort, jamais repris du fichier : un nom d'origine peut
  // porter un chemin (`../`), des caractères que le stockage interprète, ou
  // simplement le nom du client dont on parle dans l'article.
  const cle = `${PREFIXE_PUBLIC}blog/${randomUUID()}.${format.ext}`;

  try {
    await deposerObjet({
      cle,
      corps: octets,
      contentType: format.mime,
    });
  } catch (cause) {
    journal.erreur("image d'article non déposée", {
      cause: cause instanceof Error ? cause.message : String(cause),
    });
    return { ok: false, message: "Le dépôt a échoué. Réessaie." };
  }

  return { ok: true, url: urlPublique(cle) };
}
